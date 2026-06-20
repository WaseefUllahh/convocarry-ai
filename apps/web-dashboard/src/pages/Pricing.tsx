import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ChromeStoreCTA } from '../components/ChromeStoreCTA';

const Pricing: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Pricing | ConvoCarry AI</title>
        <meta name="description" content="Simple, transparent pricing for ConvoCarry AI. Free local use requires no account. Pro and Team require Google sign-in." />
      </Helmet>
      
      <div className="container" style={{ paddingBottom: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1>Simple, transparent pricing</h1>
          <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
            Free local use requires no account. Pro and Team require Google sign-in.
          </p>
        </div>

        <div className="grid" style={{ alignItems: 'stretch' }}>
          <div className="card pricing-card">
            <h3>Free</h3>
            <p>For individuals building context locally.</p>
            <div className="price">$0<span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/mo</span></div>
            <ul className="feature-list">
              <li>Local-only Carry Cards</li>
              <li>ChatGPT and Claude support</li>
              <li>Summary and Full Continuation injection</li>
              <li>No account required</li>
              <li>Limited local card count</li>
            </ul>
            <ChromeStoreCTA className="btn btn-secondary" style={{ width: '100%', marginTop: 'auto' }}>
              Add to Chrome
            </ChromeStoreCTA>
          </div>

          <div className="card pricing-card pro">
            <div className="badge">MOST POPULAR</div>
            <h3>Pro</h3>
            <p>For power users crossing devices.</p>
            <div className="price">$8<span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/mo</span></div>
            <ul className="feature-list">
              <li>Unlimited Carry Cards</li>
              <li>Cloud Sync across devices</li>
              <li>Secure, revocable claim links or short codes</li>
              <li>MCP personal API access</li>
              <li>Priority adapter fixes</li>
            </ul>
            {(!import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL === 'DISABLED' || import.meta.env.MODE === 'production') ? (
              <div style={{ width: '100%', marginTop: 'auto', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Pro upgrades are not enabled in this beta yet.
              </div>
            ) : (
              <ChromeStoreCTA className="btn btn-primary" style={{ width: '100%', marginTop: 'auto' }}>Get Pro</ChromeStoreCTA>
            )}
          </div>

          <div className="card pricing-card">
            <h3>Team</h3>
            <p>For organizations sharing context.</p>
            <div className="price">$15<span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/user/mo</span></div>
            <ul className="feature-list">
              <li>Team folders</li>
              <li>Team-scoped MCP keys</li>
              <li>Shared workflows</li>
              <li>Admin controls</li>
              <li>Priority support</li>
            </ul>
            <a href="mailto:support@convocarry.ai" className="btn btn-secondary" style={{ width: '100%', marginTop: 'auto' }}>Contact Sales</a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Pricing;
