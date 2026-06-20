import React from 'react';

const InjectionShot: React.FC = () => {
  return (
    <>
      <div className="shot-header">
        <h1 className="shot-title">Inject Summary or Full Continuation</h1>
        <p className="shot-subtitle">Move context into supported AI chats without copy-paste chaos.</p>
      </div>

      <div className="mock-browser">
        <div className="mock-browser-bar">
          <div className="mock-dot" style={{background: '#ef4444'}}></div>
          <div className="mock-dot" style={{background: '#f59e0b'}}></div>
          <div className="mock-dot" style={{background: '#10b981'}}></div>
          <span style={{ color: '#a1a1aa', marginLeft: '16px', fontSize: '14px' }}>AI Chat B (New Platform)</span>
        </div>
        <div className="mock-browser-content" style={{ justifyContent: 'space-between' }}>
          <div>
             <div className="mock-chat-bubble ai" style={{ marginBottom: '16px' }}>Hello! How can I help you today?</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             {/* Text input area mock */}
             <div style={{ background: '#27272a', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                <div style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontSize: '14px', marginBottom: '8px' }}>
                  {`<CONVOCARRY_CONTEXT_SUMMARY>`}
                </div>
                <div style={{ color: '#a1a1aa', fontSize: '14px' }}>
                  Injecting structured summary...
                </div>

                {/* Floating Injection UI */}
                <div style={{ position: 'absolute', top: '-60px', right: '16px', display: 'flex', gap: '8px' }}>
                  <div style={{ padding: '8px 16px', background: 'var(--accent-color)', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }}>Inject Summary</div>
                  <div style={{ padding: '8px 16px', background: '#3f3f46', borderRadius: '8px', fontSize: '14px' }}>Inject Full</div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InjectionShot;
