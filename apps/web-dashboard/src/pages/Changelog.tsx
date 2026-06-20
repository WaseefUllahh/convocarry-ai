import React from 'react';
import { Helmet } from 'react-helmet-async';

const Changelog: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Changelog | ConvoCarry AI</title>
        <meta name="description" content="Latest updates, features, and adapter fixes for ConvoCarry AI." />
      </Helmet>

      <div className="container" style={{ maxWidth: '800px', paddingBottom: '80px' }}>
        <h1>Changelog</h1>
        <p>All notable changes to ConvoCarry AI will be documented here.</p>

        <div className="card" style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>v1.0.0-beta</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>2026-06-19</span>
          </div>

          <h3 style={{ marginTop: '24px', fontSize: '1.1rem', color: 'var(--accent-color)' }}>Added</h3>
          <ul style={{ paddingLeft: '24px', color: 'var(--text-secondary)' }}>
            <li style={{ marginBottom: '8px' }}><strong>Core Capture/Injection</strong>: Support for extracting context from ChatGPT and Claude, and injecting it directly via activeTab scripting.</li>
            <li style={{ marginBottom: '8px' }}><strong>Carry Cards Library</strong>: A local-first dashboard (IndexedDB) to search, browse, and organize captured conversations.</li>
            <li style={{ marginBottom: '8px' }}><strong>Cloud Sync</strong>: For Pro users, automatic synchronization of the Carry Card library across browser profiles via Supabase/PostgreSQL.</li>
            <li style={{ marginBottom: '8px' }}><strong>Account Handoff</strong>: Generate secure, revocable short-codes to claim a snapshot of a Carry Card on another profile/machine.</li>
            <li style={{ marginBottom: '8px' }}><strong>Model Context Protocol (MCP)</strong>: Native Streamable HTTP server for Cursor/Claude Desktop to access the Carry Card library programmatically.</li>
            <li style={{ marginBottom: '8px' }}><strong>Stripe Integration</strong>: Secure backend webhook subscription management for Free, Pro, and Team tiers.</li>
            <li style={{ marginBottom: '8px' }}><strong>Feedback & Diagnostics</strong>: In-app feedback form, diagnostic JSON export, and manual clipboard fallback injection.</li>
            <li style={{ marginBottom: '8px' }}><strong>Privacy-First Architecture</strong>: Strictly requires explicit user clicks to execute, enforces deletedAt tombstones, and explicitly excludes rawSnapshot from MCP endpoints.</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default Changelog;
