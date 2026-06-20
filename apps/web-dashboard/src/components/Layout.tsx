import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../providers/AuthProvider';
import { ChromeStoreCTA } from './ChromeStoreCTA';

const Layout: React.FC = () => {
  const { user, loginAsDevFree, logout } = useAuth();
  return (
    <div className="page-wrapper">
      <Helmet>
        <title>ConvoCarry AI - Carry AI Chat Context</title>
        <meta name="description" content="Save AI conversations as reusable Carry Cards, then inject them into ChatGPT, Claude, or another account when you need the context back." />
      </Helmet>

      <nav className="navbar">
        <div className="container nav-container">
          <Link to="/" className="nav-brand">ConvoCarry AI</Link>
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/support">Support</Link>
            {!user ? (
              <button 
                onClick={loginAsDevFree} 
                className="btn btn-secondary" 
                style={{ padding: '6px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Sign in
              </button>
            ) : (
              <button 
                onClick={logout} 
                className="btn btn-secondary" 
                style={{ padding: '6px 16px', background: 'transparent', border: 'none', color: '#a1a1aa' }}
                title={user.email}
              >
                Sign out
              </button>
            )}
            <ChromeStoreCTA className="btn btn-primary" style={{ padding: '6px 16px' }}>
              Add to Chrome
            </ChromeStoreCTA>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <footer>
        <div className="container">
          <div className="footer-content">
            <div style={{ flex: '1 1 300px' }}>
              <div className="nav-brand" style={{ marginBottom: '16px', display: 'inline-block' }}>ConvoCarry AI</div>
              <p style={{ maxWidth: '300px', fontSize: '0.9rem' }}>Capture loaded conversation context. Save it. Inject it anywhere.</p>
            </div>
            <div className="footer-links">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ color: 'var(--text-primary)' }}>Product</h4>
                <Link to="/pricing">Pricing</Link>
                <Link to="/changelog">Changelog</Link>
                <Link to="/status">Status</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ color: 'var(--text-primary)' }}>Legal & Support</h4>
                <Link to="/support">Support</Link>
                <Link to="/privacy">Privacy Policy</Link>
                <Link to="/terms">Terms of Service</Link>
              </div>
            </div>
          </div>
          <div className="disclaimer">
            ConvoCarry AI is an independent tool and is not affiliated with, endorsed by, or sponsored by OpenAI, Anthropic, Google, Perplexity, DeepSeek, Cursor, Claude Desktop, or any other AI platform.
            <br />
            &copy; {new Date().getFullYear()} ConvoCarry AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
