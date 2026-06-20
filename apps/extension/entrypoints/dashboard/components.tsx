import React from 'react';

// PlatformBadge
export const PlatformBadge: React.FC<{ platform: string }> = ({ platform }) => (
  <span className="badge badge-platform">
    {platform.charAt(0).toUpperCase() + platform.slice(1)}
  </span>
);

// AccountLabelChip
export const AccountLabelChip: React.FC<{ label?: string }> = ({ label }) => {
  if (!label) return null;
  return (
    <span className="badge badge-account">
      👤 {label}
    </span>
  );
};

// EmptyState
export const EmptyState: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className="empty-state">
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
    <h2>{title}</h2>
    <p>{message}</p>
  </div>
);

// UpgradeBanner
export const UpgradeBanner: React.FC = () => (
  <div className="upgrade-banner">
    <h3>Upgrade to Pro</h3>
    <p style={{ fontSize: '0.85rem', margin: '0 0 12px 0' }}>Unlock cross-device cloud sync, smart LLM summaries, and team sharing.</p>
    <button className="btn btn-primary" onClick={() => alert('Upgrade modal coming soon!')}>View Plans</button>
  </div>
);

// VersionTimeline
export const VersionTimeline: React.FC<{ versions: any[]; currentId: string; onRollback: (id: string) => void }> = ({ versions, currentId, onRollback }) => (
  <div className="section-box">
    <h3 className="section-title">Version History</h3>
    <div className="timeline">
      {versions.map((v, i) => (
        <div className="timeline-item" key={v.id}>
          <div className={`timeline-dot ${v.id === currentId ? 'active' : ''}`}></div>
          <div style={{ flex: 1 }}>
            <strong>Version {versions.length - i}</strong> — {new Date(v.createdAt).toLocaleString()}
          </div>
          {v.id !== currentId && (
            <button className="btn" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => onRollback(v.id)}>
              Rollback
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
);
