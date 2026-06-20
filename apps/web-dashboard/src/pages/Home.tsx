import React from 'react';
import { ChromeStoreCTA } from '../components/ChromeStoreCTA';
import { Helmet } from 'react-helmet-async';

const Home: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>ConvoCarry AI - Carry AI Chat Context</title>
        <meta name="description" content="Capture loaded AI conversation context. Save as Carry Cards. Inject Summary or Full Continuation into ChatGPT, Claude, and more." />
      </Helmet>
      
      <div className="container">
        <section className="hero-section">
          <h1>Carry AI chat context across tools and accounts.</h1>
          <p className="hero-subtitle">
            Save conversations as reusable Carry Cards, then inject them into ChatGPT, Claude, or another account when you need the context back.
          </p>
          <div className="hero-actions">
            <ChromeStoreCTA className="btn btn-primary">
              Add to Chrome
            </ChromeStoreCTA>
            {(!import.meta.env.VITE_DEMO_VIDEO_URL || ['#', 'COMING_SOON'].includes(import.meta.env.VITE_DEMO_VIDEO_URL)) ? (
              <span className="btn btn-secondary" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Demo coming soon</span>
            ) : (
              <a href={import.meta.env.VITE_DEMO_VIDEO_URL} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">Watch demo</a>
            )}
          </div>
        </section>

        <section style={{ margin: '80px 0' }}>
          <div className="grid">
            <div className="card">
              <h3>The Problem</h3>
              <p>You start a deep coding session in ChatGPT, hit a wall, and want to switch to Claude. Or you're doing research on your personal account, but want to move the context to your team's workspace. Right now, you have to manually copy-paste massive blocks of text or start from scratch, losing valuable context and tokens.</p>
            </div>
            <div className="card" style={{ borderColor: 'var(--accent-color)' }}>
              <h3>The Solution</h3>
              <p>ConvoCarry AI bridges the gap. With a single click, capture the current loaded conversation state into a portable "Carry Card". Jump over to any other supported AI platform, and inject the full conversation—or an optimized summary—directly into the chat window.</p>
            </div>
          </div>
        </section>

        <section style={{ margin: '80px 0' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '48px' }}>Core Features</h2>
          <div className="grid">
            <div className="card">
              <h4>Capture Context</h4>
              <p>Securely capture loaded AI conversation context without ever exposing your background tabs.</p>
            </div>
            <div className="card">
              <h4>Carry Cards</h4>
              <p>Save structured snapshots of your conversations locally, ready to be deployed into any supported AI UI.</p>
            </div>
            <div className="card">
              <h4>Structured Injection</h4>
              <p>Inject a concise structured summary or execute a Full Continuation directly into the chat box.</p>
            </div>
            <div className="card">
              <h4>Account Handoff</h4>
              <p>Share a context snapshot via a secure, revocable claim link or short code to seamlessly move between browser profiles.</p>
            </div>
            <div className="card">
              <h4>Cloud Sync</h4>
              <p>Upgrade to Pro to sync your entire Carry Card library across all your active devices.</p>
            </div>
            <div className="card">
              <h4>MCP Integration</h4>
              <p>Connect Claude Desktop and Cursor directly to your context library via our native MCP server.</p>
            </div>
          </div>
        </section>

        <section style={{ margin: '80px 0', textAlign: 'center' }}>
          <h2>Privacy-First & Local-First</h2>
          <p style={{ maxWidth: '800px', margin: '0 auto' }}>
            We never scan your background tabs. Everything is captured strictly on your command. Our Free tier stores your library entirely locally within your browser's IndexedDB. Your data never touches our servers unless you explicitly want it to. Free local use requires no account. Pro and Team features require Google sign-in.
          </p>
        </section>

        <section style={{ margin: '80px 0' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '48px' }}>Frequently Asked Questions</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Does ConvoCarry scan my browser?</h4>
              <p style={{ margin: 0 }}>No. ConvoCarry AI never scans your background tabs or history. Content is extracted strictly when you explicitly click the capture button.</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Where is my data stored?</h4>
              <p style={{ margin: 0 }}>Free tier users store data entirely locally in IndexedDB. Pro/Team users sync to our secure PostgreSQL infrastructure.</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>What happens if ChatGPT/Claude changes their UI?</h4>
              <p style={{ margin: 0 }}>If the DOM updates break our activeTab adapters, we ship rapid patch updates. If an injection fails mid-session, you can always manually copy your structured summaries to the clipboard as a fallback.</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Can I use it without an account?</h4>
              <p style={{ margin: 0 }}>Yes. Free local use requires no account whatsoever.</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>What is Account Handoff?</h4>
              <p style={{ margin: 0 }}>Account Handoff allows you to generate a secure, revocable claim link or short code to safely move context between browser profiles or share with colleagues.</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>What is MCP?</h4>
              <p style={{ margin: 0 }}>The Model Context Protocol allows AI coding assistants like Cursor to securely read your Carry Card library directly.</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Is ConvoCarry affiliated with OpenAI or Anthropic?</h4>
              <p style={{ margin: 0 }}>No. ConvoCarry AI is entirely independent.</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>How do I delete my data?</h4>
              <p style={{ margin: 0 }}>You can delete cards directly from the Dashboard. Synced cards use deletion markers to safely propagate purges across your devices.</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>What happens if injection fails?</h4>
              <p style={{ margin: 0 }}>You can use the "Copy Summary" or "Copy Full Continuation" buttons to copy the formatted text directly to your clipboard and paste it manually.</p>
            </div>
          </div>
        </section>

        <section style={{ margin: '80px 0', textAlign: 'center', padding: '60px 0', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
          <div className="cta-container" style={{ textAlign: 'center', marginTop: '40px' }}>
          <ChromeStoreCTA className="btn btn-primary" style={{ fontSize: '1.25rem', padding: '16px 32px' }}>
            Add to Chrome - It's Free
          </ChromeStoreCTA>
        </div>
        </section>
      </div>
    </>
  );
};

export default Home;
