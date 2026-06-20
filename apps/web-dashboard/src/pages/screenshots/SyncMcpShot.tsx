import React from 'react';

const SyncMcpShot: React.FC = () => {
  return (
    <>
      <div className="shot-header">
        <h1 className="shot-title">Sync across devices with Pro</h1>
        <p className="shot-subtitle">Keep Carry Cards available across profiles and compatible MCP clients.</p>
      </div>

      <div style={{ position: 'absolute', top: '350px', left: '100px', display: 'flex', gap: '80px', alignItems: 'center' }}>
         {/* Laptop 1 (Browser) */}
         <div className="mock-card" style={{ width: '300px', background: '#18181b', position: 'relative' }}>
            <div style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '16px', textAlign: 'center' }}>Chrome Profile A</div>
            <div className="mock-card" style={{ background: 'var(--accent-color)', borderColor: 'var(--accent-color)' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Project X Specs</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Synced just now</p>
            </div>
         </div>

         {/* Sync Icon */}
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '50%', border: '2px solid var(--success)' }}>
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M21 2v6h-6"></path>
                 <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                 <path d="M3 22v-6h6"></path>
                 <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
               </svg>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--success)' }}>CLOUD SYNC</div>
         </div>

         {/* Laptop 2 (MCP Client) */}
         <div className="mock-card" style={{ width: '300px', background: '#18181b', position: 'relative' }}>
            <div style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '16px', textAlign: 'center' }}>Compatible MCP Agent</div>
            <div className="mock-card" style={{ background: '#27272a', borderStyle: 'dashed' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Project X Specs</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>Available via MCP Server</p>
            </div>
         </div>
      </div>
    </>
  );
};

export default SyncMcpShot;
