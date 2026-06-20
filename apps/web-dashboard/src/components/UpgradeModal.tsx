import React, { useEffect, useCallback, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpgradeTrigger = 'sync' | 'handoff' | 'mcp' | 'card_limit' | 'team';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: UpgradeTrigger;
}

// ─── Trigger-specific copy ────────────────────────────────────────────────────

const TRIGGER_CONTEXT: Record<UpgradeTrigger, { label: string; note: string }> = {
  sync: {
    label: '☁️ Cloud Sync',
    note:"You tried to sync across browser profiles — that's a Pro feature.",
  },
  handoff: {
    label: '🤝 Account Handoff',
    note: 'Account Handoff with secure claim links requires a Pro plan.',
  },
  mcp: {
    label: '🔌 MCP Access',
    note: 'MCP access for compatible AI clients is available on Pro.',
  },
  card_limit: {
    label: '📦 Card Limit Reached',
    note:"You tried to sync across browser profiles — that's a Pro feature.",
  },
  team: {
    label: '👥 Team Features',
    note: 'Team sharing and collaboration features are available on Pro.',
  },
};

const PRO_BULLETS: Array<{ icon: string; text: string }> = [
  { icon: '☁️', text: 'Cloud Sync across browser profiles' },
  { icon: '🤝', text: 'Account Handoff with secure claim links' },
  { icon: '🔌', text: 'MCP access for compatible AI clients' },
  { icon: '⚡', text: 'Priority adapter fixes' },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
    animation: 'um-fade-in 0.2s ease forwards',
  },
  card: {
    background: 'rgba(24, 24, 27, 0.92)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    borderRadius: '20px',
    padding: '40px 36px 32px',
    maxWidth: '500px',
    width: '100%',
    position: 'relative',
    boxShadow: '0 0 40px rgba(139, 92, 246, 0.15), 0 24px 64px rgba(0,0,0,0.6)',
    animation: 'um-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#a1a1aa',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    lineHeight: 1,
    transition: 'background 0.15s ease, color 0.15s ease',
    flexShrink: 0,
  },
  triggerBadge: {
    display: 'inline-block',
    background: 'rgba(139, 92, 246, 0.15)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '999px',
    padding: '4px 12px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#a78bfa',
    letterSpacing: '0.02em',
    marginBottom: '16px',
  },
  headline: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#f4f4f5',
    lineHeight: 1.3,
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  },
  subheadline: {
    fontSize: '0.9rem',
    color: '#a1a1aa',
    marginBottom: '28px',
    lineHeight: 1.6,
  },
  divider: {
    borderColor: 'rgba(255,255,255,0.08)',
    margin: '0 0 24px 0',
  },
  bulletList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 28px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  bulletItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#d4d4d8',
    fontSize: '0.9rem',
  },
  bulletIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  primaryCta: {
    display: 'block',
    width: '100%',
    padding: '13px 20px',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: 700,
    textAlign: 'center',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'opacity 0.2s ease, transform 0.15s ease',
    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
    letterSpacing: '0.01em',
  },
  secondaryCta: {
    display: 'block',
    width: '100%',
    padding: '12px 20px',
    background: 'transparent',
    color: '#a1a1aa',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: 500,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s ease, color 0.2s ease',
    letterSpacing: '0.01em',
  },
  noteText: {
    fontSize: '0.78rem',
    color: '#71717a',
    textAlign: 'center',
    marginTop: '12px',
    lineHeight: 1.5,
  },
};

// ─── Keyframe injection ───────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes um-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes um-slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
`;

function injectKeyframes() {
  const id = 'upgrade-modal-keyframes';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, trigger }) => {
  const { user, token, loginAsDevFree } = useAuth();
  const [isCheckoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => { injectKeyframes(); }, []);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const ctx = TRIGGER_CONTEXT[trigger];

  return (
    <div
      id="upgrade-modal-overlay"
      style={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div id="upgrade-modal-card" style={styles.card}>

        {/* Close button */}
        <button
          id="upgrade-modal-close-btn"
          style={styles.closeBtn}
          onClick={onClose}
          aria-label="Close upgrade modal"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
            (e.currentTarget as HTMLButtonElement).style.color = '#f4f4f5';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
          }}
        >
          &#x2715;
        </button>

        {/* Trigger-specific context badge */}
        <div id="upgrade-modal-trigger-badge" style={styles.triggerBadge}>
          {ctx.label}
        </div>

        {/* Main headline */}
        <h2 id="upgrade-modal-title" style={styles.headline}>
          Take your Carry Cards across devices and accounts.
        </h2>
        <p style={styles.subheadline}>
          Keep local use free, or upgrade when you need sync, handoff, and MCP access.
        </p>

        <hr style={styles.divider} />

        {/* Pro feature list */}
        <ul style={styles.bulletList} aria-label="Pro plan features">
          {PRO_BULLETS.map((b) => (
            <li key={b.text} style={styles.bulletItem}>
              <span style={styles.bulletIcon} aria-hidden="true">{b.icon}</span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>

        {/* CTAs — secondary is always rendered (no dark patterns) */}
        <div style={styles.actions}>
          {import.meta.env.MODE === 'production' ? (
            <div style={{ ...styles.primaryCta, opacity: 0.6, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
              Pro upgrades are not enabled in this beta yet.
            </div>
          ) : !user ? (
            <button
              id="upgrade-modal-login-btn"
              style={styles.primaryCta}
              onClick={async () => {
                await loginAsDevFree();
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              Sign in to upgrade
            </button>
          ) : (
            <button
              id="upgrade-modal-upgrade-btn"
              style={styles.primaryCta}
              disabled={isCheckoutLoading}
              onClick={async () => {
                setCheckoutLoading(true);
                try {
                  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/billing/checkout`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ plan: 'PRO' })
                  });
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url;
                  } else {
                    alert('Checkout failed: ' + (data.message || 'Unknown error'));
                  }
                } catch (_e) {
                  alert('Checkout failed.');
                } finally {
                  setCheckoutLoading(false);
                }
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              {isCheckoutLoading ? 'Starting Checkout...' : 'Upgrade to Pro'}
            </button>
          )}

          <button
            id="upgrade-modal-free-btn"
            style={styles.secondaryCta}
            onClick={onClose}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLButtonElement).style.color = '#d4d4d8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
            }}
          >
            Continue with local-only Free
          </button>
        </div>

        {/* Trigger-specific note (below fold, small) */}
        <p style={styles.noteText}>{ctx.note}</p>
      </div>
    </div>
  );
};

export default UpgradeModal;
