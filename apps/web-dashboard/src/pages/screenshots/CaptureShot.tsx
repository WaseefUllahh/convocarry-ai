import React from 'react';

const CaptureShot: React.FC = () => {
  return (
    <>
      <div className="shot-header">
        <h1 className="shot-title">Capture only when you click</h1>
        <p className="shot-subtitle">No background scanning. No automatic history scraping.</p>
      </div>

      {/* Abstract AI Chat Background */}
      <div className="mock-browser" style={{ opacity: 0.5, right: '100px', top: '250px', transform: 'scale(0.8)' }}>
        <div className="mock-browser-bar">
          <div className="mock-dot" style={{background: '#ef4444'}}></div>
          <div className="mock-dot" style={{background: '#f59e0b'}}></div>
          <div className="mock-dot" style={{background: '#10b981'}}></div>
          <span style={{ color: '#a1a1aa', marginLeft: '16px', fontSize: '14px' }}>AI Chat Interface</span>
        </div>
        <div className="mock-browser-content">
          <div className="mock-chat-bubble user">Can you help me rewrite this auth flow?</div>
          <div className="mock-chat-bubble ai">Sure! Here is the updated code...</div>
        </div>
      </div>

      {/* ConvoCarry Popup Overlapping */}
      <div className="mock-popup">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--accent-color)', borderRadius: '8px' }}></div>
          <h3 style={{ margin: 0 }}>ConvoCarry AI</h3>
        </div>
        <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '16px' }}>Ready to capture context.</p>
        
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Active Tab</div>
          <div style={{ fontSize: '12px', color: '#a1a1aa' }}>AI Chat UI (Loaded state)</div>
        </div>

        <div className="mock-btn" style={{ boxShadow: '0 0 20px var(--accent-color)' }}>
          Capture Context
        </div>
      </div>
    </>
  );
};

export default CaptureShot;
