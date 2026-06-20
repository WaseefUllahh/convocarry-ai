import React from 'react';

const DashboardShot: React.FC = () => {
  return (
    <>
      <div className="shot-header">
        <h1 className="shot-title">Save AI conversations as Carry Cards</h1>
        <p className="shot-subtitle">Capture useful context once and reuse it anywhere.</p>
      </div>

      <div className="mock-browser">
        <div className="mock-browser-bar">
          <div className="mock-dot" style={{background: '#ef4444'}}></div>
          <div className="mock-dot" style={{background: '#f59e0b'}}></div>
          <div className="mock-dot" style={{background: '#10b981'}}></div>
        </div>
        <div className="mock-browser-content" style={{ flexDirection: 'row' }}>
          {/* Sidebar */}
          <div style={{ width: '200px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '16px' }}>
            <h3 style={{ marginBottom: '16px', color: '#a1a1aa' }}>Library</h3>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>All Cards</div>
            <div style={{ padding: '8px', color: '#a1a1aa' }}>Work Sync</div>
          </div>
          
          {/* Main Area */}
          <div style={{ flex: 1, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>My Carry Cards</h2>
              <div style={{ padding: '6px 12px', background: 'var(--accent-color)', borderRadius: '4px', fontWeight: 'bold' }}>Sync All</div>
            </div>

            <div className="mock-card">
              <h3 style={{ margin: 0 }}>Refactor Auth Context</h3>
              <p style={{ color: '#a1a1aa', margin: 0 }}>Captured 2 hours ago • 15 messages</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px' }}>React</span>
                <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px' }}>Next.js</span>
              </div>
            </div>

            <div className="mock-card" style={{ opacity: 0.7 }}>
              <h3 style={{ margin: 0 }}>Marketing Copy Ideas</h3>
              <p style={{ color: '#a1a1aa', margin: 0 }}>Captured yesterday • 4 messages</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardShot;
