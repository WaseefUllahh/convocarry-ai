import React, { useEffect, useState, useCallback, useRef } from 'react';
import UpgradeModal, { UpgradeTrigger } from '../components/UpgradeModal';
import FirstRunChecklist from '../components/FirstRunChecklist';
import { trackActivation } from '../lib/activationTracker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CarryCard {
  id: string;
  title: string;
  tags: string[];
  hoursAgo: number;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_CARDS: CarryCard[] = [
  { id: 'card-1', title: 'Refactor Auth Context', tags: ['React', 'Auth', 'Refactor'], hoursAgo: 2 },
  { id: 'card-2', title: 'API Design Notes', tags: ['API', 'REST', 'Design'], hoursAgo: 5 },
  { id: 'card-3', title: 'Marketing Strategy Draft', tags: ['Marketing', 'Growth', 'Draft'], hoursAgo: 11 },
];

const TAG_COLORS: Record<string, string> = {
  React: '#61dafb22',
  Auth: '#8b5cf622',
  Refactor: '#f59e0b22',
  API: '#10b98122',
  REST: '#06b6d422',
  Design: '#a78bfa22',
  Marketing: '#ec489922',
  Growth: '#f97316',
  Draft: '#71717a22',
};

function getTagBg(tag: string): string {
  return TAG_COLORS[tag] ?? 'rgba(255,255,255,0.06)';
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState {
  id: number;
  message: string;
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next tick
    const showTimer = setTimeout(() => setVisible(true), 16);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300); // wait for exit animation
    }, 3000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '12px 20px',
        background: 'rgba(24,24,27,0.95)',
        border: '1px solid rgba(139,92,246,0.45)',
        borderRadius: '12px',
        color: '#f4f4f5',
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.2)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: '240px',
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: '16px' }}>✓</span>
      {message}
    </div>
  );
}

function ToastContainer() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const counterRef = useRef(0);

  // Expose a push method via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      const id = ++counterRef.current;
      setToasts(prev => [...prev, { id, message: detail }]);
    };
    window.addEventListener('cc:toast', handler);
    return () => window.removeEventListener('cc:toast', handler);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <div
      aria-label="Toast notifications"
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 10000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} onDone={() => remove(t.id)} />
      ))}
    </div>
  );
}

function showToast(message: string) {
  window.dispatchEvent(new CustomEvent('cc:toast', { detail: message }));
}

// ─── Keyframes ───────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes dash-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes dash-card-in {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes dash-pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); }
  50%       { box-shadow: 0 0 0 6px rgba(139,92,246,0.15); }
}
`;

function injectKeyframes() {
  const id = 'dash-keyframes';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }
}

// ─── CarryCard component ──────────────────────────────────────────────────────

function CarryCardUI({ card, index }: { card: CarryCard; index: number }) {
  const [summaryHovered, setSummaryHovered] = useState(false);
  const [fullHovered, setFullHovered] = useState(false);

  const handleInjectSummary = () => {
    trackActivation('first_summary_injected', { platform: 'dashboard', success: true });
    showToast('Summary copied to clipboard!');
  };

  const handleInjectFull = () => {
    trackActivation('first_full_continuation_injected', { platform: 'dashboard', success: true });
    showToast('Full continuation copied to clipboard!');
  };

  return (
    <div
      id={`carry-card-${card.id}`}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: `dash-card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.07}s both`,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.3)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(139,92,246,0.08)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: '#f4f4f5',
              marginBottom: '6px',
              lineHeight: 1.3,
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#71717a',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '12px' }}>🕐</span>
            Captured {card.hoursAgo} hour{card.hoursAgo !== 1 ? 's' : ''} ago
          </div>
        </div>
        {/* Carry icon */}
        <div
          aria-hidden="true"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
          }}
        >
          🗂️
        </div>
      </div>

      {/* Tag badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {card.tags.map(tag => (
          <span
            key={tag}
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#a1a1aa',
              background: getTagBg(tag),
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '3px 8px',
              letterSpacing: '0.02em',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button
          id={`btn-inject-summary-${card.id}`}
          onClick={handleInjectSummary}
          onMouseEnter={() => setSummaryHovered(true)}
          onMouseLeave={() => setSummaryHovered(false)}
          style={{
            flex: 1,
            padding: '9px 14px',
            background: summaryHovered
              ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
              : 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.35)',
            borderRadius: '9px',
            color: summaryHovered ? '#fff' : '#a78bfa',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>⚡</span> Inject Summary
        </button>

        <button
          id={`btn-inject-full-${card.id}`}
          onClick={handleInjectFull}
          onMouseEnter={() => setFullHovered(true)}
          onMouseLeave={() => setFullHovered(false)}
          style={{
            flex: 1,
            padding: '9px 14px',
            background: fullHovered
              ? 'rgba(255,255,255,0.1)'
              : 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '9px',
            color: fullHovered ? '#f4f4f5' : '#a1a1aa',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>🔄</span> Inject Full
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  useEffect(() => {
    injectKeyframes();
    trackActivation('dashboard_opened', { platform: 'dashboard' });
  }, []);

  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    trigger: UpgradeTrigger;
  }>({ open: false, trigger: 'sync' });

  const getUserPlan = () => localStorage.getItem('convocarry_user_plan') ?? 'FREE';

  const openUpgradeModal = (trigger: UpgradeTrigger) => {
    trackActivation('upgrade_modal_opened', { platform: 'dashboard' });
    setUpgradeModal({ open: true, trigger });
  };

  const handleSyncClick = () => {
    if (getUserPlan() === 'FREE') {
      openUpgradeModal('sync');
    }
    // PRO users: real sync logic goes here
  };

  const handleHandoffClick = () => {
    if (getUserPlan() === 'FREE') {
      openUpgradeModal('handoff');
    }
    // PRO users: real handoff logic goes here
  };

  const closeModal = () => setUpgradeModal(prev => ({ ...prev, open: false }));

  return (
    <>
      {/* Toast system */}
      <ToastContainer />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={closeModal}
        trigger={upgradeModal.trigger}
      />

      {/* Page wrapper */}
      <div
        id="dashboard-page"
        style={{
          minHeight: '100vh',
          background: '#09090b',
          color: '#f4f4f5',
          fontFamily:
            "'Inter', 'Outfit', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* ── Header ── */}
        <header
          id="dashboard-header"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(9,9,11,0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              padding: '0 24px',
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            {/* Logo + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>🃏</span>
              <span
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.02em',
                }}
              >
                ConvoCarry
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: 'rgba(139,92,246,0.15)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  color: '#a78bfa',
                  letterSpacing: '0.04em',
                }}
              >
                DASHBOARD
              </span>
            </div>

            {/* Header actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HeaderButton
                id="header-btn-sync"
                icon="☁️"
                label="Cloud Sync"
                onClick={handleSyncClick}
              />
              <HeaderButton
                id="header-btn-handoff"
                icon="🤝"
                label="Account Handoff"
                onClick={handleHandoffClick}
              />
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '40px 24px 80px',
            display: 'flex',
            flexDirection: 'column',
            gap: '40px',
            animation: 'dash-fade-in 0.4s ease forwards',
          }}
        >
          {/* First Run Checklist */}
          <FirstRunChecklist />

          {/* Carry Cards library section */}
          <section id="carry-cards-section" aria-labelledby="carry-cards-heading">
            {/* Section header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2
                  id="carry-cards-heading"
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#f4f4f5',
                    margin: '0 0 4px 0',
                    letterSpacing: '-0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span aria-hidden="true">🗂️</span>
                  Carry Cards Library
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      color: '#34d399',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {DEMO_CARDS.length} cards
                  </span>
                </h2>
                <p
                  style={{
                    fontSize: '0.82rem',
                    color: '#71717a',
                    margin: 0,
                  }}
                >
                  Your saved AI conversation contexts — ready to inject anywhere.
                </p>
              </div>
            </div>

            {/* Cards grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px',
              }}
            >
              {DEMO_CARDS.map((card, idx) => (
                <CarryCardUI key={card.id} card={card} index={idx} />
              ))}
            </div>
          </section>

          {/* Empty state hint */}
          <div
            style={{
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '32px',
              textAlign: 'center',
              color: '#52525b',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔌</div>
            <div style={{ fontWeight: 600, marginBottom: '6px', color: '#71717a' }}>
              Install the browser extension to capture real cards
            </div>
            <div style={{ fontSize: '0.78rem' }}>
              The demo cards above show how injections work. Your actual captured conversations will appear here.
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

// ─── Small reusable header button ────────────────────────────────────────────

function HeaderButton({
  id,
  icon,
  label,
  onClick,
}: {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      id={id}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '8px 14px',
        background: hovered ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
        border: hovered
          ? '1px solid rgba(139,92,246,0.4)'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '9px',
        color: hovered ? '#c4b5fd' : '#a1a1aa',
        fontSize: '0.82rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '14px' }}>{icon}</span>
      {label}
    </button>
  );
}

export default Dashboard;
