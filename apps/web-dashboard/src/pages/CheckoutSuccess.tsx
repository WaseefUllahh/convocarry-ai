import React, { useEffect, useState } from 'react';
import { trackActivation } from '../lib/activationTracker';

const CheckoutSuccess: React.FC = () => {
  const [status, setStatus] = useState<'polling' | 'success' | 'timeout'>('polling');

  useEffect(() => {
    let isMounted = true;
    let pollCount = 0;
    const maxPolls = 15; // e.g., 30 seconds total (2s interval)

    // 1. Fire returned success immediately
    trackActivation('checkout_returned_success', { platform: 'dashboard' });

    // 2. Polling loop for webhook confirmation
    const pollInterval = setInterval(async () => {
      if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
        if (isMounted) setStatus('timeout');
        return;
      }

      try {
        const token = localStorage.getItem('cc_access_token');
        const API_URL = import.meta.env.VITE_API_URL || 'https://api.convocarry.ai/api/v1';
        
        const res = await fetch(`${API_URL}/billing/plan`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          // Stripe webhook has updated the backend entitlement
          if (data.plan === 'PRO' || data.plan === 'TEAM') {
            localStorage.setItem('cc_plan', data.plan); // Sync local cache
            clearInterval(pollInterval);
            if (isMounted) setStatus('success');
          }
        }
      } catch (err) {
        console.warn('Polling error', err);
      }
      
      pollCount++;
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', color: '#f4f4f5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.3)', textAlign: 'center', maxWidth: '400px' }}>
        
        {status === 'polling' && (
          <>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Activating your plan...</h2>
            <p style={{ color: '#a1a1aa' }}>Please wait while we confirm your subscription with Stripe. This usually takes just a few seconds.</p>
            <div style={{ marginTop: '24px', color: '#8b5cf6', animation: 'dash-pulse-glow 1.5s infinite' }}>⏳</div>
          </>
        )}

        {status === 'success' && (
          <>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#34d399' }}>✅ Subscription Active!</h2>
            <p style={{ color: '#a1a1aa' }}>Your Pro features are now unlocked. You can securely sync and handoff Carry Cards.</p>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              style={{ marginTop: '24px', padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              Go to Dashboard
            </button>
          </>
        )}

        {status === 'timeout' && (
          <>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#eab308' }}>Taking a moment...</h2>
            <p style={{ color: '#a1a1aa' }}>Stripe is taking a little longer than usual to process the webhook. Your account will automatically upgrade once it lands.</p>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#f4f4f5', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}
              >
                Refresh Status
              </button>
              <button 
                onClick={() => window.location.href = '/dashboard'}
                style={{ padding: '10px 20px', background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer' }}
              >
                Return to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutSuccess;
