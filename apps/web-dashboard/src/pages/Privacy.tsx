import React from 'react';
import { Helmet } from 'react-helmet-async';

const Privacy: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | ConvoCarry AI</title>
        <meta name="description" content="ConvoCarry AI Privacy Policy. We never scan background tabs. Free tier is local-only. Read how we protect your data." />
      </Helmet>

      <div className="container" style={{ maxWidth: '800px', paddingBottom: '80px' }}>
        <h1>Privacy Policy</h1>
        <p><strong>Effective Date:</strong> 2026-06-19</p>
        
        <div className="card" style={{ marginTop: '32px' }}>
          <h3>What ConvoCarry AI Does</h3>
          <p>ConvoCarry AI is a browser extension designed to help users manually capture, store, and inject text context between different AI chat platforms.</p>

          <h3 style={{ marginTop: '32px' }}>What Data We Collect & How It Is Stored</h3>
          <ul style={{ paddingLeft: '24px', marginBottom: '24px', color: 'var(--text-secondary)' }}>
            <li style={{ marginBottom: '12px' }}><strong>Explicit Capture Only:</strong> We NEVER scan your background tabs or browsing history. AI conversation content is extracted from the DOM <em>only</em> when you explicitly click the capture button.</li>
            <li style={{ marginBottom: '12px' }}><strong>Local By Default:</strong> For Free tier users, all Carry Cards are stored locally on your device using standard browser storage (IndexedDB). This data never leaves your device unless explicitly shared.</li>
            <li style={{ marginBottom: '12px' }}><strong>Cloud Sync (Pro/Team):</strong> If you subscribe to our paid tiers and enable Cloud Sync, your Carry Cards are securely transmitted to our database to synchronize across your devices.</li>
            <li style={{ marginBottom: '12px' }}><strong>Account Labels:</strong> When capturing a conversation, we record the visible account label solely to warn you if you attempt to inject the data into a different account later, protecting you from accidental cross-contamination.</li>
            <li style={{ marginBottom: '12px' }}><strong>Account Handoff:</strong> If you utilize the Account Handoff feature to share a card, a duplicated snapshot of that specific card is temporarily hosted on our servers to facilitate the transfer.</li>
            <li style={{ marginBottom: '12px' }}><strong>Usage & API Logs:</strong> We collect limited operational logs linked to your account where necessary for security, billing, rate limiting, abuse prevention, and debugging. These logs do not include full Carry Card content. For MCP API keys, we store only the cryptographic hash of your key.</li>
            <li style={{ marginBottom: '12px' }}><strong>Billing:</strong> Stripe processes all payments. We only store subscription entitlement status; we do not store credit card numbers.</li>
          </ul>

          <h3 style={{ marginTop: '32px' }}>Data Retention & Deletion</h3>
          <p>When you delete a synced Carry Card, we first mark it as deleted so the deletion can sync across your devices. Conversation content is scheduled for permanent deletion after the retention window. A lightweight deletion marker may be retained temporarily to prevent deleted cards from reappearing from offline devices. Local-only Carry Cards can be deleted from your browser storage by you.</p>

          <h3 style={{ marginTop: '32px' }}>Third Parties</h3>
          <p><strong>No Sale of Data:</strong> We do not sell your data. We do not serve advertisements.<br/>
          <strong>Third-Party Processors:</strong> We utilize Stripe (payments), Supabase/Google (OAuth), and Vercel (infrastructure).</p>
        </div>
      </div>
    </>
  );
};

export default Privacy;
