// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { getAdapterForUrl, detectPlatformFromUrl } from '@convocarry/adapters';
import { cardStorage, LocalCarryCard } from '../../lib/storage/cards';
import { generateStructuredSummary, generateTitle, generateInjectionText } from '../../lib/heuristics';
import { trackActivation } from '../../lib/activationTracker';
import { ConversationNode } from '@convocarry/shared-types';

type Platform = 'chatgpt' | 'claude' | 'unsupported';
type AppState = 'idle' | 'capturing' | 'injecting' | 'success' | 'error' | 'account_warning';
type InjectionMode = 'summary' | 'full_continuation';

const MAX_INJECTION_CHARS = 100000; // 100k chars ~ 25k tokens

const App: React.FC = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unsupported');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [appState, setAppState] = useState<AppState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Selection State
  const [cards, setCards] = useState<LocalCarryCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [injectionMode, setInjectionMode] = useState<InjectionMode>('summary');
  
  // Warning State
  const [warningDetails, setWarningDetails] = useState({ source: '', destination: '', payloadText: '' });

  // Post-capture state
  const [capturedCardId, setCapturedCardId] = useState('');
  const [editableTitle, setEditableTitle] = useState('');

  useEffect(() => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) setIsSignedIn(true);
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      setCurrentUrl(url);
      setPlatform(detectPlatformFromUrl(url) as Platform);
    });

    loadCards();
  }, []);

  const loadCards = async () => {
    const list = await cardStorage.listCards();
    setCards(list);
    if (list.length > 0 && !selectedCardId) {
      setSelectedCardId(list[0].id);
    }
  };

  const handleSignIn = () => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (token) setIsSignedIn(true);
    });
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
        sourceAccountLabel: accountLabel || undefined,
      });

      setCapturedCardId(card.id);
      setEditableTitle(card.title);
      setAppState('success');
      loadCards();
      
      // Wire: Fire only after real success
      await trackActivation('first_carry_card_captured', { platform: adapter.platform, success: true });

    } catch (e) {
      setErrorMessage((e as Error).message);
      setAppState('error');
    }
  };

  const saveEditedTitle = async () => {
    if (!capturedCardId || !editableTitle.trim()) return;
    await cardStorage.updateCard(capturedCardId, { title: editableTitle.trim() });
    alert('Title updated successfully!');
    loadCards();
  };

  const handleInject = async () => {
    setAppState('injecting');
    setErrorMessage('');

    try {
      if (!selectedCardId) throw new Error('Please select a Carry Card to inject.');

      const { card, version } = await cardStorage.getCardWithCurrentVersion(selectedCardId);
      if (!card || !version) throw new Error('Carry Card data is missing or corrupted.');

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
        setWarningDetails({ source: sourceLabel, destination: destLabel, payloadText: injectionText });
        setAppState('account_warning');
        return;
      }

      await executeInjection(tab.id, adapter.platform, injectionText);

      // Wire: Fire only after real success based on mode
      if (injectionMode === 'summary') {
        await trackActivation('first_summary_injected', { platform: adapter.platform as any, success: true });
      } else {
        await trackActivation('first_full_continuation_injected', { platform: adapter.platform as any, success: true });
      }

    } catch (e) {
      setErrorMessage((e as Error).message);
      setAppState('error');
    }
  };

  const executeInjection = async (tabId: number, targetPlatform: string, text: string) => {
    try {
      if (targetPlatform === 'chatgpt') {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (injectText) => {
            const target = document.querySelector('#prompt-textarea') || document.querySelector('div[contenteditable="true"].ProseMirror');
            if (!target) { alert('ConvoCarry: Composer not found.'); return; }
            if (target.tagName.toLowerCase() === 'textarea') {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
              if (nativeInputValueSetter) nativeInputValueSetter.call(target, injectText);
              else (target as HTMLTextAreaElement).value = injectText;
            } else {
              target.textContent = injectText;
            }
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
          },
          args: [text]
        });
      } else if (targetPlatform === 'claude') {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (injectText) => {
            const target = document.querySelector('div[contenteditable="true"]');
            if (!target) { alert('ConvoCarry: Composer not found.'); return; }
            (target as HTMLElement).focus();
            try {
              if (!document.execCommand('insertText', false, injectText)) throw new Error('fallback');
            } catch(e) {
              const dt = new DataTransfer(); dt.setData('text/plain', injectText);
              target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
              // We rely on the external popup context for copy_fallback tracking normally, 
              // but we can signal it if needed. Here paste fallback is automated.
            }
            target.dispatchEvent(new Event('input', { bubbles: true }));
          },
          args: [text]
        });
      }

      setAppState('idle');
      window.close(); // Close popup on success
    } catch (e) {
      setErrorMessage('Failed to execute script on page. Make sure the page has fully loaded.');
      setAppState('error');
    }
  };

  const confirmWarningAndInject = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await executeInjection(tab.id, platform, warningDetails.payloadText);
    }
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

      {!isSignedIn ? (
        <div className="card">
          <h2 className="title">Welcome</h2>
          <p className="subtitle">Sign in to sync your Carry Cards across accounts and devices.</p>
          <button className="btn btn-primary" onClick={handleSignIn}>Sign in with Google</button>
          <button className="btn btn-secondary" onClick={() => setIsSignedIn(true)}>Continue locally (Free)</button>
        </div>
      ) : appState === 'account_warning' ? (
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
                </div>
                
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Card Title (Editable)</label>
                <input 
                  type="text" 
                  value={editableTitle} 
                  onChange={(e) => setEditableTitle(e.target.value)}
                  onBlur={saveEditedTitle}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: 'white', marginBottom: '16px' }}
                />
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
          <div className={`auth-dot ${isSignedIn ? 'active' : ''}`}></div>
          {isSignedIn ? 'Pro Sync Active' : 'Local Storage Only'}
        </div>
        {isSignedIn && (
          <a className="text-link" onClick={() => setIsSignedIn(false)}>Sign out</a>
        )}
      </div>
    </div>
  );
};

export default App;
