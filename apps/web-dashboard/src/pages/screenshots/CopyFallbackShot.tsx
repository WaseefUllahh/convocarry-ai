import React from 'react';

const CopyFallbackShot: React.FC = () => {
  return (
    <>
      <div className="shot-header">
        <h1 className="shot-title">Copy fallback always works</h1>
        <p className="shot-subtitle">If injection fails, copy your Carry Card and paste manually.</p>
      </div>

      <div style={{ position: 'absolute', top: '220px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '40px' }}>
         <div className="mock-card" style={{ width: '400px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '20px' }}>Marketing Brainstorm</div>
            </div>
            
            <div style={{ background: '#1f1f22', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', color: '#a1a1aa' }}>
              Contains 4 conversation turns...
            </div>

            <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
               </svg>
               Copy to Clipboard
            </button>
         </div>

         <div className="mock-card" style={{ width: '500px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '24px', fontSize: '18px', fontWeight: 'bold', color: '#e4e4e7' }}>
              Any Chat Box
            </div>
            
            <div style={{ flex: 1, background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'flex-end' }}>
               <div style={{ width: '100%', background: '#27272a', padding: '12px 16px', borderRadius: '24px', color: '#e4e4e7', fontSize: '15px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ opacity: 0.5 }}>Paste your context here...</span>
                  <div style={{ marginLeft: 'auto', width: '2px', height: '20px', background: 'var(--primary)', animation: 'blink 1s step-end infinite' }} />
               </div>
            </div>
         </div>
      </div>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </>
  );
};

export default CopyFallbackShot;
