import React from 'react';

const PrivacyBackupShot: React.FC = () => {
  return (
    <>
      <div className="shot-header">
        <h1 className="shot-title">Total Privacy Control</h1>
        <p className="shot-subtitle">Free local use requires no account. No background scanning.</p>
      </div>

      <div style={{ position: 'absolute', top: '250px', left: '0', right: '0', display: 'flex', justifyContent: 'center' }}>
         <div className="mock-card" style={{ width: '600px', background: '#18181b', padding: '48px', alignItems: 'center', textAlign: 'center', boxShadow: '0 40px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ width: '80px', height: '80px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px' }}>
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
               </svg>
            </div>
            
            <h2 style={{ fontSize: '32px', margin: '0 0 16px 0' }}>Local-First Architecture</h2>
            <p style={{ fontSize: '18px', color: '#a1a1aa', margin: '0 0 32px 0', lineHeight: 1.6 }}>
              Your Carry Cards are stored securely within your browser's IndexedDB. They never leave your device unless you explicitly upgrade and enable Cloud Sync.
            </p>

            <div style={{ display: 'flex', gap: '24px', width: '100%', justifyContent: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span style={{ fontWeight: 'bold' }}>No background tracking</span>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span style={{ fontWeight: 'bold' }}>No telemetry payload</span>
               </div>
            </div>
         </div>
      </div>
    </>
  );
};

export default PrivacyBackupShot;
