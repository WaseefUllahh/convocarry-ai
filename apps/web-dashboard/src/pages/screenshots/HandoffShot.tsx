import React from 'react';

const HandoffShot: React.FC = () => {
  return (
    <>
      <div className="shot-header">
        <h1 className="shot-title">Send context to another account</h1>
        <p className="shot-subtitle">Use secure, revocable claim links or short codes.</p>
      </div>

      {/* Abstract Split Screen or Modal */}
      <div className="mock-browser" style={{ right: '50px', top: '250px', transform: 'scale(0.85)', background: 'var(--surface-color)' }}>
        <div className="mock-browser-bar">
          <span style={{ color: '#a1a1aa', fontSize: '14px' }}>Dashboard | ConvoCarry AI</span>
        </div>
        <div className="mock-browser-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
          
          <div style={{ width: '400px', background: '#18181b', padding: '32px', borderRadius: '16px', border: '1px solid var(--accent-color)', boxShadow: '0 0 40px rgba(139, 92, 246, 0.2)' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>Account Handoff</h2>
            <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '24px' }}>Share a snapshot of "Refactor Auth Context".</p>
            
            <div style={{ background: '#27272a', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '8px' }}>CLAIM LINK</div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--accent-color)' }}>https://convocarry.ai/claim/cc_hand_1A2B3C...</div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
               <div style={{ flex: 1, padding: '12px', background: 'var(--accent-color)', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>Copy Link</div>
               <div style={{ flex: 1, padding: '12px', background: '#3f3f46', borderRadius: '8px', textAlign: 'center' }}>Revoke</div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default HandoffShot;
