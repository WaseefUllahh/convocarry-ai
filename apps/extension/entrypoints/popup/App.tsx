import React, { useEffect, useState } from 'react';
import { getAdapterForUrl, detectPlatformFromUrl, insertConversationText } from '@convocarry/adapters';
import { cardStorage, LocalCarryCard } from '../../lib/storage/cards';
import { generateStructuredSummary, generateTitle, generateInjectionText } from '../../lib/heuristics';
import { trackActivation } from '../../lib/activationTracker';
import { auth, isGoogleSignInConfigured, type Session } from '../../lib/auth';
import type { ActivationEventName } from '@convocarry/shared-types';

type Platform = 'chatgpt' | 'claude' | 'unsupported';
type AppState = 'idle' | 'capturing' | 'injecting' | 'success' | 'error' | 'account_warning';
type InjectionMode = 'summary' | 'full_continuation';

const MAX_INJECTION_CHARS = 100000; // 100k chars ~ 25k tokens

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const googleConfigured = isGoogleSignInConfigured();
  const [platform, setPlatform] = useState<Platform>('unsupported');
  const [appState, setAppState] = useState<AppState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Selection State
  const [cards, setCards] = useState<LocalCarryCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [injectionMode, setInjectionMode] = useState<InjectionMode>('summary');
  
  // Warning State
  const [warningDetails, setWarningDetails] = useState<{ source: string; destination: string; payloadText: string; tabId: number; url: string; platform: string; mode: InjectionMode } | null>(null);

  // Post-capture state
  const [capturedCardId, setCapturedCardId] = useState('');
  const [editableTitle, setEditableTitle] = useState('');

  useEffect(() => {
    const initialize = async () => {
      try {
        const [storedSession, preferences, tabs] = await Promise.all([
          auth.getSession(),
          chrome.storage.local.get('localModeEnabled'),
          chrome.tabs.query({ active: true, currentWindow: true }),
        ]);
        setSession(storedSession);
        setLocalMode(preferences.localModeEnabled === true);
        setPlatform(detectPlatformFromUrl(tabs[0]?.url || '') as Platform);
        await loadCards();
      } catch (error) {
        setErrorMessage((error as Error).message);
        setAppState('error');
      } finally { setInitializing(false); }
    };
    void initialize();
  }, []);

  const loadCards = async () => {
    const list = await cardStorage.listCards();
    setCards(list);
    setSelectedCardId(previous => list.some(card => card.id === previous) ? previous : list[0]?.id || '');
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    setErrorMessage('');
    try { setSession(await auth.signIn()); setAppState('idle'); }
    catch (error) { setErrorMessage((error as Error).message); setAppState('error'); }
    finally { setSigningIn(false); }
  };

  const continueLocally = async () => {
    try {
      await chrome.storage.local.set({ localModeEnabled: true });
      setLocalMode(true);
    } catch (error) { setErrorMessage((error as Error).message); setAppState('error'); }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      setSession(null);
      await continueLocally();
    } catch (error) { setErrorMessage((error as Error).message); setAppState('error'); }
  };

  const recordSuccess = async (event: ActivationEventName, targetPlatform: string) => {
    // Telemetry must not turn a successful capture/insertion into an error.
    try { await trackActivation(event, { platform: targetPlatform === 'claude' ? 'claude' : 'chatgpt', success: true }); }
    catch { /* Local work is already saved. */ }
  };

  const handleCapture = async () => {
    setAppState('capturing');
    setErrorMessage('');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) throw new Error('Could not identify active tab.');

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.outerHTML
      });

      const rawHtml = results[0]?.result;
      if (!rawHtml) throw new Error('Failed to read page content. Permission denied or empty page.');

      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');

      const adapter = getAdapterForUrl(tab.url);
      if (adapter.id === 'unsupported-fallback') {
        throw new Error('This page is not supported for extraction.');
      }

      const nodes = await adapter.extractConversation(doc, tab.url);
      if (!nodes || nodes.length === 0) {
        throw new Error('No conversation messages found. The chat might be empty.');
      }

      const accountLabel = await adapter.getActiveAccountLabel(doc);

      const defaultTitle = generateTitle(nodes);
      const contextBody = generateStructuredSummary(adapter.platform, accountLabel, nodes);

      const { card } = await cardStorage.createCard({
        title: defaultTitle,
        platform: adapter.platform,
        contextBody,
        rawSnapshot: nodes,
        sourceAccountLabel: accountLabel || undefined,
      });

      setCapturedCardId(card.id);
      setSelectedCardId(card.id);
      setEditableTitle(card.title);
      setAppState('success');
      await loadCards();
      
      // Wire: Fire only after real success
      await recordSuccess('first_carry_card_captured', adapter.platform);

    } catch (e) {
      setErrorMessage((e as Error).message);
      setAppState('error');
    }
  };

  const saveEditedTitle = async () => {
    if (!capturedCardId || !editableTitle.trim()) return;
    try {
      await cardStorage.updateCard(capturedCardId, { title: editableTitle.trim() });
      await loadCards();
    } catch (error) { setErrorMessage((error as Error).message); setAppState('error'); }
  };

  const handleInject = async () => {
    setAppState('injecting');
    setErrorMessage('');

    try {
      if (!selectedCardId) throw new Error('Please select a Carry Card to inject.');

      const saved = await cardStorage.getCardWithCurrentVersion(selectedCardId);
      const version = saved?.version;
      if (!saved?.card || !version) throw new Error('Carry Card data is missing or corrupted.');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) throw new Error('Could not identify active tab.');

      // Extract Destination Label
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.outerHTML
      });
      const rawHtml = results[0]?.result || '';
      const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
      
      const adapter = getAdapterForUrl(tab.url);
      const destLabel = await adapter.getActiveAccountLabel(doc);
      const sourceLabel = version.sourceAccountLabel;

      const injectionText = generateInjectionText(injectionMode, version.contextBody, version.rawSnapshot);

      if (injectionText.length > MAX_INJECTION_CHARS) {
        const proceed = confirm(`Warning: This injection is very large (${injectionText.length} chars). It may freeze the page or exceed the AI's token limit. Continue?`);
        if (!proceed) {
          setAppState('idle');
          return;
        }
      }

      // Check for Account Mismatch
      if (sourceLabel && destLabel && sourceLabel !== destLabel) {
        setWarningDetails({ source: sourceLabel, destination: destLabel, payloadText: injectionText, tabId: tab.id, url: tab.url, platform: adapter.platform, mode: injectionMode });
        setAppState('account_warning');
        return;
      }

      await executeInjection(tab.id, tab.url, adapter.platform, injectionText, injectionMode);

    } catch (e) {
      setErrorMessage((e as Error).message);
      setAppState('error');
    }
  };

  const executeInjection = async (tabId: number, url: string, targetPlatform: string, text: string, mode: InjectionMode) => {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: insertConversationText,
      args: [text, targetPlatform, url],
    });
    const result = results[0]?.result;
    if (!result?.ok) throw new Error(result?.error || 'The page did not confirm insertion. Please try again.');
    await recordSuccess(mode === 'summary' ? 'first_summary_injected' : 'first_full_continuation_injected', targetPlatform);
    setAppState('idle');
    window.close();
  };

  const confirmWarningAndInject = async () => {
    if (!warningDetails) return;
    setAppState('injecting');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== warningDetails.tabId || tab.url !== warningDetails.url) {
        throw new Error('The destination changed. Please select the chat again.');
      }
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.body.outerHTML });
      const doc = new DOMParser().parseFromString(results[0]?.result || '', 'text/html');
      const label = await getAdapterForUrl(tab.url).getActiveAccountLabel(doc);
      if (label !== warningDetails.destination) throw new Error('The destination account changed. Please retry insertion.');
      await executeInjection(tab.id, tab.url, warningDetails.platform, warningDetails.payloadText, warningDetails.mode);
    } catch (error) { setErrorMessage((error as Error).message); setAppState('error'); }
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('/dashboard.html') });
  };

  return (
    <div className="popup-container fade-in">
      <div className="header">
        <div className="brand">
          <div className="brand-icon"></div>
          <span className="brand-title">ConvoCarry</span>
        </div>
      </div>

      {initializing ? <p className="subtitle">Loading Carry Cards...</p> : !session && !localMode ? (
        <div className="card">
          <h2 className="title">Welcome</h2>
          <p className="subtitle">Sign in to sync your Carry Cards across accounts and devices.</p>
          {errorMessage && <p role="alert" className="subtitle">{errorMessage}</p>}
          {googleConfigured ? <button className="btn btn-primary" disabled={signingIn} onClick={handleSignIn}>{signingIn ? 'Signing in...' : 'Sign in with Google'}</button>
            : <p className="subtitle">Google sign-in is not configured in this build. Local capture and insertion are available.</p>}
          <button className="btn btn-secondary" onClick={continueLocally}>Continue locally (Free)</button>
        </div>
      ) : appState === 'account_warning' && warningDetails ? (
        <div className="card fade-in" style={{ border: '1px solid #eab308' }}>
          <h2 className="title" style={{ color: '#eab308' }}>Account Mismatch</h2>
          <p className="subtitle">
            This Carry Card was captured from <strong>{warningDetails.source}</strong>. 
            You are currently signed in as <strong>{warningDetails.destination}</strong>.
          </p>
          <p className="subtitle">Inject anyway?</p>
          <button className="btn btn-primary" onClick={confirmWarningAndInject}>Yes, Inject</button>
          <button className="btn btn-secondary" onClick={() => setAppState('idle')}>Cancel</button>
        </div>
      ) : (
        <>
          <div className="card">
            {appState === 'error' && (
              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                <strong>Error: </strong> {errorMessage}
                <button className="btn btn-outline" style={{ marginTop: '10px', padding: '6px' }} onClick={() => setAppState('idle')}>Try Again</button>
              </div>
            )}

            {appState === 'success' && (
              <div className="fade-in">
                <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', textAlign: 'center' }}>
                  <strong>✅ Chat Captured Successfully!</strong>
                  <p>Saved the messages currently loaded on this page. Load older messages before capturing a long chat.</p>
                </div>
                
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Card Title (Editable)</label>
                <input 
                  type="text" 
                  value={editableTitle} 
                  onChange={(e) => setEditableTitle(e.target.value)}
                  onBlur={saveEditedTitle}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: 'white', marginBottom: '16px' }}
                />
                <button className="btn btn-primary" onClick={() => setAppState('idle')}>Use saved card</button>
              </div>
            )}

            {(appState === 'idle' || appState === 'capturing' || appState === 'injecting') && platform === 'unsupported' && (
              <>
                <div className="platform-badge unsupported">Unsupported Page</div>
                <p className="subtitle">Navigate to ChatGPT or Claude to capture or inject context.</p>
              </>
            )}

            {(appState === 'idle' || appState === 'capturing' || appState === 'injecting') && platform !== 'unsupported' && (
              <>
                <div className="platform-badge">
                  <span style={{ textTransform: 'capitalize' }}>{platform}</span> Detected
                </div>
                
                <button className="btn btn-outline" onClick={handleCapture} disabled={appState !== 'idle'}>
                  {appState === 'capturing' ? 'Capturing...' : 'Capture Chat'}
                </button>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Select Card</label>
                  <select 
                    value={selectedCardId} 
                    onChange={e => setSelectedCardId(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: 'white', marginBottom: '10px' }}
                  >
                    {cards.length === 0 ? <option value="">No cards saved yet</option> : null}
                    {cards.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="radio" checked={injectionMode === 'summary'} onChange={() => setInjectionMode('summary')} /> Summary
                    </label>
                    <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="radio" checked={injectionMode === 'full_continuation'} onChange={() => setInjectionMode('full_continuation')} /> Full
                    </label>
                  </div>

                  <button className="btn btn-primary" onClick={handleInject} disabled={appState !== 'idle' || cards.length === 0}>
                    {appState === 'injecting' ? 'Injecting...' : 'Inject Carry Card'}
                  </button>
                </div>
              </>
            )}
          </div>
          
          <button className="btn btn-outline" onClick={openDashboard}>
            Open Dashboard
          </button>
        </>
      )}

      <div className="footer">
        <div className="auth-status">
          <div className={`auth-dot ${session ? 'active' : ''}`}></div>
          {session ? `Signed in · ${session.user.plan}` : 'Local Storage Only'}
        </div>
        {session ? <a className="text-link" onClick={handleSignOut}>Sign out</a>
          : localMode && googleConfigured ? <button className="text-link" disabled={signingIn} onClick={handleSignIn}>Sign in</button> : null}
      </div>
    </div>
  );
};

export default App;
