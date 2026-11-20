import React, { useEffect, useState, useMemo } from 'react';
import { cardStorage, LocalCarryCard, LocalCarryCardVersion } from '../../lib/storage/cards';
import { db } from '../../lib/storage/db';
import { trackActivation } from '../../lib/activationTracker';
import { syncEngine } from '../../lib/storage/sync';
import { PlatformBadge, AccountLabelChip, EmptyState, UpgradeBanner, VersionTimeline } from './components';
import './dashboard.css';

const App: React.FC = () => {
  const [cards, setCards] = useState<LocalCarryCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Detail View State
  const [activeVersion, setActiveVersion] = useState<LocalCarryCardVersion | null>(null);
  const [allVersions, setAllVersions] = useState<LocalCarryCardVersion[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleVal, setEditTitleVal] = useState('');
  const [billingInfo, setBillingInfo] = useState<any>(null);

  // Handoff State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareResult, setShareResult] = useState<any>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [claimPreview, setClaimPreview] = useState<any>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const loadBilling = async () => {
    const { billingApi } = await import('../../lib/api/billing');
    const info = await billingApi.getPlan();
    if (info) setBillingInfo(info);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleCheckoutSuccess();
    } else {
      loadBilling();
    }
    loadData();
  }, []);

  const handleCheckoutSuccess = async () => {
    setBillingInfo({ plan: 'Activating your plan...', hasCustomerRecord: false, status: 'PROCESSING' });
    
    let attempts = 0;
    const { billingApi } = await import('../../lib/api/billing');
    
    const poll = setInterval(async () => {
      attempts++;
      const info = await billingApi.getPlan();
      
      if (info && (info.plan === 'PRO' || info.plan === 'TEAM') && info.status === 'ACTIVE') {
        clearInterval(poll);
        setBillingInfo(info);
        alert('Subscription successful! Your account has been upgraded.');
      } else if (attempts >= 10) {
        clearInterval(poll);
        setBillingInfo({ plan: 'Still processing, refresh shortly', hasCustomerRecord: true, status: 'PROCESSING' });
      }
    }, 3000);
  };

  const loadData = async () => {
    const data = await cardStorage.listCards();
    setCards(data);
    if (data.length > 0 && !selectedCardId) {
      setSelectedCardId(data[0].id);
    }
  };

  useEffect(() => {
    if (selectedCardId) loadDetail(selectedCardId);
  }, [selectedCardId]);

  const loadDetail = async (id: string) => {
    const res = await cardStorage.getCardWithCurrentVersion(id);
    if (res?.version) setActiveVersion(res.version);
    
    const versions = await db.carryCardVersions.where('carryCardId').equals(id).reverse().sortBy('createdAt');
    setAllVersions(versions);
  };

  const filteredCards = useMemo(() => {
    if (!searchQuery) return cards;
    const q = searchQuery.toLowerCase();
    return cards.filter(c => c.title.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q)));
  }, [cards, searchQuery]);

  const selectedCard = cards.find(c => c.id === selectedCardId);

  const handleDelete = async () => {
    if (!selectedCardId || !confirm('Are you sure you want to delete this Carry Card?')) return;
    await cardStorage.deleteCard(selectedCardId);
    setSelectedCardId(null);
    setActiveVersion(null);
    loadData();
  };

  const handleExport = async () => {
    const json = await cardStorage.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convocarry_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleSaveTitle = async () => {
    if (selectedCardId && editTitleVal.trim()) {
      await cardStorage.updateCard(selectedCardId, { title: editTitleVal.trim() });
      setIsEditingTitle(false);
      loadData();
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!selectedCardId) return;
    await cardStorage.setCurrentVersion(selectedCardId, versionId);
    loadDetail(selectedCardId);
    loadData();
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await syncEngine.syncAll();
      await loadData();
      if (selectedCardId) await loadDetail(selectedCardId);
    } catch (e: any) {
      if (e.message.includes('Pro or Team')) {
        setShowUpgradeModal(true);
      } else {
        setSyncError(e.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpgradeToPro = async () => {
    try {
      const { billingApi } = await import('../../lib/api/billing');
      const res = await billingApi.createCheckoutSession('PRO');
      window.location.href = res.url;
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { billingApi } = await import('../../lib/api/billing');
      const res = await billingApi.createPortalSession();
      window.location.href = res.url;
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateShare = async () => {
    try {
      const { handoffApi } = await import('../../lib/api/handoff');
      if (!selectedCardId) return;
      const res = await handoffApi.shareCard(selectedCardId);
      setShareResult(res);
    } catch (e: any) {
      if (e.message.includes('Requires PRO')) setShowUpgradeModal(true);
      else alert(e.message);
    }
  };

  const handlePreviewClaim = async () => {
    setClaimError(null);
    try {
      const { handoffApi } = await import('../../lib/api/handoff');
      const res = await handoffApi.previewClaim(claimToken);
      setClaimPreview(res);
    } catch (e: any) {
      setClaimError(e.message);
    }
  };

  const handleConfirmClaim = async () => {
    try {
      const { handoffApi } = await import('../../lib/api/handoff');
      await handoffApi.confirmClaim(claimToken);
      await trackActivation('first_handoff_claim_completed', { platform: 'dashboard', success: true });
      alert('Card successfully claimed! It will appear after the next sync.');
      setShowClaimModal(false);
      setClaimPreview(null);
      setClaimToken('');
      handleSyncAll(); // Trigger sync immediately to pull the new card
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="dashboard-layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="brand" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="brand-icon"></div>
              ConvoCarry
            </div>
            <button className="btn btn-primary" onClick={handleSyncAll} disabled={isSyncing}>
              {isSyncing ? 'Syncing...' : 'Sync All'}
            </button>
          </div>
          <div className="privacy-badge">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Local by default. You choose what syncs.
          </div>
          {syncError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '8px' }}>{syncError}</div>}
          
          {billingInfo && (
            <div style={{ marginTop: '12px', fontSize: '0.8rem', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Plan: <strong>{billingInfo.plan}</strong></span>
                {billingInfo.hasCustomerRecord ? (
                  <a href="#" onClick={handleManageSubscription} style={{ color: 'var(--primary)' }}>Manage</a>
                ) : (
                  <a href="#" onClick={() => setShowUpgradeModal(true)} style={{ color: 'var(--primary)' }}>Upgrade</a>
                )}
              </div>
              {['PAST_DUE', 'INCOMPLETE', 'CANCELED'].includes(billingInfo.status) && (
                <div style={{ color: 'var(--warning)', marginTop: '4px', fontWeight: 500 }}>
                  Subscription is {billingInfo.status.replace('_', ' ').toLowerCase()}. Features limited.
                </div>
              )}
            </div>
          )}
        </div>
        
        <div style={{ padding: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search cards..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: '1 1 100%' }}
          />
          <button className="btn" onClick={() => setShowClaimModal(true)}>Claim</button>
          <button className="btn" onClick={() => setSelectedCardId('view-diagnostics')}>Diagnostics</button>
          <button className="btn" onClick={() => setSelectedCardId('view-feedback')}>Feedback</button>
        </div>

        <div className="card-list">
          {filteredCards.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No cards found.</div>
          ) : (
            filteredCards.map(card => (
              <div 
                key={card.id} 
                className={`card-item ${selectedCardId === card.id ? 'selected' : ''}`}
                onClick={() => setSelectedCardId(card.id)}
              >
                <h4 className="card-item-title">{card.title}</h4>
                <div className="card-item-meta">
                  <span>{new Date(card.updatedAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span style={{ color: card.syncStatus === 'local_only' ? 'inherit' : card.syncStatus === 'sync_error' ? 'var(--danger)' : 'var(--primary)' }}>
                    {card.syncStatus === 'local_only' ? 'Local' : card.syncStatus === 'pending_sync' ? 'Pending Sync' : card.syncStatus === 'sync_error' ? 'Sync Error' : 'Synced'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="detail-panel">
        {!selectedCard || !activeVersion ? (
          <EmptyState title="No Card Selected" message="Select a Carry Card from the sidebar or capture a new one from the extension popup." />
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="detail-header">
              <div className="badges">
                <PlatformBadge platform={activeVersion.platform} />
                <AccountLabelChip label={activeVersion.sourceAccountLabel} />
              </div>
              
              <div className="detail-title">
                {isEditingTitle ? (
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <input 
                      type="text" 
                      className="search-input" 
                      style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}
                      value={editTitleVal} 
                      onChange={e => setEditTitleVal(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-primary" onClick={handleSaveTitle}>Save</button>
                    <button className="btn" onClick={() => setIsEditingTitle(false)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span>{selectedCard.title}</span>
                    <div className="detail-actions">
                      <button className="btn" onClick={() => { setEditTitleVal(selectedCard.title); setIsEditingTitle(true); }}>Edit Title</button>
                      <button className="btn" onClick={handleExport}>Export JSON</button>
                      <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
                    </div>
                  </>
                )}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Created: {new Date(selectedCard.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="section-box">
              <h3 className="section-title">Context Body (Summary)</h3>
              <div className="node-list">
                {activeVersion.contextBody.map((node, idx) => (
                  <div key={idx} className={`node-item ${node.role}`}>
                    <div className="node-role">{node.role}</div>
                    <div className="node-text">{node.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <VersionTimeline versions={allVersions} currentId={activeVersion.id} onRollback={handleRollback} />
              
              <div>
                <UpgradeBanner />
                <div className="section-box">
                  <h3 className="section-title">Quick Actions</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p>To insert into a chat, open ChatGPT or Claude and use the ConvoCarry toolbar popup.</p>
                    <button className="btn" onClick={async () => {
                      try {
                        const { generateInjectionText } = await import('../../lib/heuristics');
                        await navigator.clipboard.writeText(generateInjectionText('summary', activeVersion.contextBody));
                        alert('Summary copied to clipboard!');
                      } catch (error) { alert((error as Error).message); }
                    }}>Copy Summary (Fallback)</button>
                    <button className="btn" onClick={async () => {
                      try {
                        const { generateInjectionText } = await import('../../lib/heuristics');
                        await navigator.clipboard.writeText(generateInjectionText('full_continuation', activeVersion.contextBody, activeVersion.rawSnapshot));
                        alert('Full Continuation copied to clipboard!');
                      } catch (error) { alert((error as Error).message); }
                    }}>Copy Full Continuation (Fallback)</button>

                    <button className="btn btn-outline" onClick={handleCreateShare}>Generate Handoff Link</button>
                    <button className="btn" onClick={() => {
                      cardStorage.updateCard(selectedCard.id, { }).then(() => {
                        loadData();
                      })
                    }}>Mark for Sync</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {shareResult && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '450px', background: 'var(--bg-surface)' }}>
            <h2 className="title">Handoff Link Created</h2>
            <p className="subtitle">Share this link or short code to hand off this Carry Card context.</p>
            
            <div style={{ margin: '16px 0' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Share Link</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" className="search-input" style={{ flex: 1 }} value={shareResult.claimUrl} readOnly onClick={e => (e.target as HTMLInputElement).select()} />
                <button className="btn" onClick={() => navigator.clipboard.writeText(shareResult.claimUrl)}>Copy</button>
              </div>
            </div>

            <div style={{ margin: '16px 0' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Short Code (for extension popup)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" className="search-input" style={{ flex: 1 }} value={shareResult.shortCode} readOnly onClick={e => (e.target as HTMLInputElement).select()} />
                <button className="btn" onClick={() => navigator.clipboard.writeText(shareResult.shortCode)}>Copy</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={() => setShareResult(null)}>Done</button>
              {shareResult.id && (
                <button className="btn btn-outline" onClick={async () => {
                  if (confirm('Are you sure you want to revoke this share?')) {
                    const { handoffApi } = await import('../../lib/api/handoff');
                    await handoffApi.revokeShare(shareResult.id);
                    setShareResult(null);
                    alert('Share link revoked successfully.');
                  }
                }}>Revoke Link</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showClaimModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '450px', background: 'var(--bg-surface)' }}>
            <h2 className="title">Claim Carry Card</h2>
            <p className="subtitle">Paste a Handoff Link or Short Code to securely claim a copy.</p>
            
            <div style={{ margin: '16px 0' }}>
              <input 
                type="text" 
                className="search-input" 
                placeholder="Link or Code..." 
                value={claimToken}
                onChange={e => setClaimToken(e.target.value)}
              />
            </div>

            {claimError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{claimError}</div>}

            {claimPreview ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0' }}>{claimPreview.title}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Captured from {claimPreview.sourcePlatform} by {claimPreview.createdByDisplayName}
                </div>
                {claimPreview.targetEmailRestricted && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '8px' }}>
                    * Restricted to your email address
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {!claimPreview ? (
                <button className="btn btn-primary" onClick={handlePreviewClaim} disabled={!claimToken}>Preview</button>
              ) : (
                <button className="btn btn-primary" onClick={handleConfirmClaim}>Confirm Claim</button>
              )}
              <button className="btn" onClick={() => { setShowClaimModal(false); setClaimPreview(null); setClaimToken(''); setClaimError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '400px', background: 'var(--bg-surface)' }}>
            <h2 className="title" style={{ color: 'var(--primary)' }}>Upgrade to Pro</h2>
            <p className="subtitle">Cloud sync and Account Handoff are Pro features. Upgrade to securely share your Carry Cards across accounts.</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={handleUpgradeToPro}>Proceed to Checkout</button>
              <button className="btn btn-outline" onClick={() => setShowUpgradeModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selectedCardId === 'view-diagnostics' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-body)', zIndex: 900, overflowY: 'auto', padding: '40px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="title">System Diagnostics</h2>
              <button className="btn" onClick={() => setSelectedCardId(null)}>Close</button>
            </div>
            <div className="section-box" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <div><strong>Extension Version:</strong> 1.0.0-beta</div>
              <div><strong>Browser Agent:</strong> {navigator.userAgent}</div>
              <div><strong>Current Plan:</strong> {billingInfo?.plan || 'FREE'}</div>
              <div><strong>Billing Status:</strong> {billingInfo?.status || 'N/A'}</div>
              <div><strong>Sync Status:</strong> {isSyncing ? 'Syncing...' : 'Idle'}</div>
              <div><strong>API Status:</strong> Online</div>
              <div><strong>MCP Enabled:</strong> {['PRO', 'TEAM'].includes(billingInfo?.plan) ? 'Yes' : 'No'}</div>
              <div><strong>Supported Adapters:</strong> ChatGPT (v1.2), Claude (v1.1)</div>
              
              <div style={{ marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={() => {
                  const data = JSON.stringify({ version: '1.0.0-beta', nav: navigator.userAgent, plan: billingInfo?.plan }, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `convocarry_diagnostics_${Date.now()}.json`;
                  a.click();
                }}>Export Diagnostics JSON</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCardId === 'view-feedback' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-body)', zIndex: 900, overflowY: 'auto', padding: '40px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="title">Submit Feedback</h2>
              <button className="btn" onClick={() => setSelectedCardId(null)}>Close</button>
            </div>
            <div className="section-box" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Issue Type</label>
                <select className="search-input" style={{ width: '100%' }}>
                  <option>Report a bug</option>
                  <option>Request a feature</option>
                  <option>Adapter broken?</option>
                  <option>General feedback</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Platform Area</label>
                <select className="search-input" style={{ width: '100%' }}>
                  <option>ChatGPT</option>
                  <option>Claude</option>
                  <option>Dashboard</option>
                  <option>Sync</option>
                  <option>Billing</option>
                  <option>Handoff</option>
                  <option>MCP</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Message</label>
                <textarea className="search-input" style={{ width: '100%', minHeight: '120px', resize: 'vertical' }} placeholder="Please describe the issue or suggestion..."></textarea>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input type="checkbox" defaultChecked />
                  Include anonymous technical diagnostics (Browser, Extension Version, Plan)
                </label>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>We never include Carry Card content in feedback automatically.</div>
              </div>
              <div>
                <button className="btn btn-outline" onClick={() => alert('Screenshot attachment is currently a placeholder for MVP.')}>Attach Screenshot (Optional)</button>
              </div>
              <div style={{ marginTop: '8px' }}>
                <button className="btn btn-primary" onClick={() => { alert('Feedback submitted! Thank you.'); setSelectedCardId(null); }}>Submit Feedback</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
