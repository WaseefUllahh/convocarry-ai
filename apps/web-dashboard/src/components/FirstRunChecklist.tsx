import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

interface FirstRunChecklistProps {
  /** Called when the checklist is fully dismissed (manually or auto-collapsed). */
  onDismiss?: () => void;
}

// ─── Checklist data ───────────────────────────────────────────────────────────

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'capture_first_card',
    label: 'Capture your first Carry Card',
    description: 'Open any AI chat and click the ConvoCarry extension icon to save your first card.',
    required: true,
  },
  {
    id: 'inject_summary',
    label: 'Inject a structured summary',
    description: 'Open a new AI chat, select a saved card, and inject a structured summary into the context.',
    required: true,
  },
  {
    id: 'try_full_continuation',
    label: 'Try Full Continuation',
    description: 'Use the Full Continuation mode to restore an entire conversation thread.',
    required: true,
  },
  {
    id: 'try_copy_fallback',
    label: 'Use the Copy fallback',
    description: 'Copy a card\'s text to clipboard as a fallback when direct injection isn\'t available.',
    required: true,
  },
  {
    id: 'enable_cloud_sync',
    label: 'Enable Cloud Sync',
    description: 'Sign in and turn on Cloud Sync to access your cards from any browser profile.',
    required: false,
  },
  {
    id: 'try_handoff',
    label: 'Try Account Handoff',
    description: 'Generate a secure claim link to hand off a conversation to another account.',
    required: false,
  },
  {
    id: 'join_community',
    label: 'Join the ConvoCarry community',
    description: 'Connect with other users, share workflows, and get early feature previews.',
    required: false,
  },
];

const STORAGE_KEY = 'convocarry_checklist_v1';
const DISMISSED_KEY = 'convocarry_checklist_dismissed_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveCompleted(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

function loadDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch { return false; }
}

function saveDismissed(): void {
  try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* ignore */ }
}

// ─── Keyframe injection ───────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes frc-fade-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes frc-check-pop {
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1);   opacity: 1; }
}
@keyframes frc-bar-grow {
  from { width: 0%; }
}
`;

function injectKeyframes() {
  const id = 'frc-keyframes';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(24, 24, 27, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '0',
    overflow: 'hidden',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.08)',
    animation: 'frc-fade-in 0.3s ease forwards',
    maxWidth: '540px',
    width: '100%',
  },
  header: {
    padding: '20px 24px 0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#f4f4f5',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  titleIcon: {
    fontSize: '16px',
  },
  subtitle: {
    fontSize: '0.78rem',
    color: '#71717a',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  collapseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#71717a',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'color 0.15s ease',
  },
  dismissBtn: {
    background: 'transparent',
    border: 'none',
    color: '#52525b',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: '6px',
    transition: 'color 0.15s ease, background 0.15s ease',
    whiteSpace: 'nowrap',
  },
  progressSection: {
    padding: '12px 24px 0',
  },
  progressLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  progressLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#a1a1aa',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  progressCount: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#8b5cf6',
  },
  progressTrack: {
    height: '5px',
    background: 'rgba(255,255,255,0.07)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #8b5cf6 0%, #10b981 100%)',
    borderRadius: '999px',
    transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    animation: 'frc-bar-grow 0.6s ease forwards',
  },
  list: {
    listStyle: 'none',
    padding: '16px 24px 20px',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '8px 10px',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    border: '1px solid transparent',
  },
  itemCompleted: {
    opacity: 0.55,
  },
  checkCircle: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '1px',
    transition: 'border-color 0.2s ease, background 0.2s ease',
  },
  checkCircleDone: {
    background: '#10b981',
    border: '2px solid #10b981',
    animation: 'frc-check-pop 0.3s ease forwards',
  },
  checkMark: {
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: 1,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#e4e4e7',
    lineHeight: 1.4,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  requiredDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#8b5cf6',
    flexShrink: 0,
    display: 'inline-block',
  },
  optionalChip: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#52525b',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px',
    padding: '1px 5px',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  itemDesc: {
    fontSize: '0.78rem',
    color: '#71717a',
    marginTop: '2px',
    lineHeight: 1.5,
  },
  divider: {
    margin: '0 24px',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  successBanner: {
    margin: '0 24px 20px',
    padding: '12px 16px',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    borderRadius: '10px',
    fontSize: '0.82rem',
    color: '#34d399',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

const FirstRunChecklist: React.FC<FirstRunChecklistProps> = ({ onDismiss }) => {
  useEffect(() => { injectKeyframes(); }, []);

  const [completed, setCompleted] = useState<Set<string>>(() => loadCompleted());
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(() => loadDismissed());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Persist completed state
  useEffect(() => { saveCompleted(completed); }, [completed]);

  // Required item IDs
  const requiredIds = CHECKLIST_ITEMS.filter(i => i.required).map(i => i.id);
  const allRequiredDone = requiredIds.every(id => completed.has(id));
  const totalCompleted = CHECKLIST_ITEMS.filter(i => completed.has(i.id)).length;
  const total = CHECKLIST_ITEMS.length;
  const progressPct = (totalCompleted / total) * 100;

  // Auto-collapse when all required steps are done
  useEffect(() => {
    if (allRequiredDone && !collapsed) {
      const t = setTimeout(() => setCollapsed(true), 1200);
      return () => clearTimeout(t);
    }
  }, [allRequiredDone, collapsed]);

  const handleDismiss = useCallback(() => {
    saveDismissed();
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const toggleItem = useCallback((id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  // Listen for real product events dispatched from the rest of the app/extension
  useEffect(() => {
    const handleActivationEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ event: string }>;
      const eventName = customEvent.detail.event;
      
      const eventMap: Record<string, string> = {
        'first_carry_card_captured': 'capture_first_card',
        'first_summary_injected': 'inject_summary',
        'first_full_continuation_injected': 'try_full_continuation',
        'first_copy_fallback_used': 'try_copy_fallback',
        'first_cloud_sync_completed': 'enable_cloud_sync',
        'first_handoff_link_created': 'try_handoff',
        'first_handoff_claim_completed': 'try_handoff',
        'first_mcp_key_created': 'join_community' // Just as an example mapping
      };

      const checklistItemId = eventMap[eventName];
      if (checklistItemId) {
        setCompleted(prev => {
          const next = new Set(prev);
          next.add(checklistItemId);
          return next;
        });
      }
    };

    window.addEventListener('cc_activation_event', handleActivationEvent);
    return () => window.removeEventListener('cc_activation_event', handleActivationEvent);
  }, []);

  // Community item only visible after inject_summary is completed
  const visibleItems = CHECKLIST_ITEMS.filter(item => {
    if (item.id === 'join_community') return completed.has('inject_summary');
    return true;
  });

  if (dismissed) return null;

  return (
    <section
      id="first-run-checklist"
      style={s.container}
      aria-label="Onboarding checklist"
    >
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.title}>
            <span style={s.titleIcon}>🚀</span>
            Get started with ConvoCarry
          </div>
          <p style={s.subtitle}>
            Complete the steps below to unlock the full workflow.
          </p>
        </div>
        <div style={s.headerRight}>
          <button
            id="frc-dismiss-btn"
            style={s.dismissBtn}
            onClick={handleDismiss}
            aria-label="Dismiss onboarding checklist"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#52525b';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            Dismiss
          </button>
          <button
            id="frc-collapse-btn"
            style={s.collapseBtn}
            onClick={() => setCollapsed(c => !c)}
            aria-expanded={!collapsed}
            aria-controls="frc-body"
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#d4d4d8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#71717a'; }}
          >
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
      </div>

      {/* ── Progress bar (always visible) ── */}
      <div style={s.progressSection}>
        <div style={s.progressLabelRow}>
          <span style={s.progressLabel}>Progress</span>
          <span style={s.progressCount}>{totalCompleted}/{total} steps completed</span>
        </div>
        <div style={s.progressTrack} role="progressbar" aria-valuenow={totalCompleted} aria-valuemin={0} aria-valuemax={total}>
          <div style={{ ...s.progressFill, width: `${progressPct}%` }} />
        </div>
      </div>

      {/* ── Body (collapsible) ── */}
      {!collapsed && (
        <div id="frc-body">
          {/* Success banner after all required steps */}
          {allRequiredDone && (
            <div style={{ padding: '12px 24px 0' }}>
              <div style={s.successBanner} role="status">
                <span aria-hidden="true">✅</span>
                <span>Core workflow complete! Explore the optional steps when you're ready.</span>
              </div>
            </div>
          )}

          <ul style={s.list} aria-label="Onboarding steps">
            {visibleItems.map((item) => {
              const isDone = completed.has(item.id);
              const isHovered = hoveredId === item.id;
              return (
                <li
                  key={item.id}
                  id={`frc-item-${item.id}`}
                  style={{
                    ...s.item,
                    ...(isDone ? s.itemCompleted : {}),
                    background: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                    borderColor: isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}
                  onClick={() => toggleItem(item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  role="checkbox"
                  aria-checked={isDone}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleItem(item.id); } }}
                >
                  {/* Check circle */}
                  <div
                    style={{
                      ...s.checkCircle,
                      ...(isDone ? s.checkCircleDone : {}),
                    }}
                    aria-hidden="true"
                  >
                    {isDone && <span style={s.checkMark}>✓</span>}
                  </div>

                  {/* Text content */}
                  <div style={s.itemContent}>
                    <div style={s.itemLabel}>
                      {item.required && !isDone && (
                        <span style={s.requiredDot} title="Required step" aria-hidden="true" />
                      )}
                      <span style={{ textDecoration: isDone ? 'line-through' : 'none' }}>
                        {item.label}
                      </span>
                      {!item.required && (
                        <span style={s.optionalChip} aria-label="optional">opt</span>
                      )}
                    </div>
                    <div style={s.itemDesc}>{item.description}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export default FirstRunChecklist;
