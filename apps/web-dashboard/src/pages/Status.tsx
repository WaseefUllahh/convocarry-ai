import React from 'react';
import { Helmet } from 'react-helmet-async';

const Status: React.FC = () => {
  // Mock status data for MVP
  const services = [
    { name: 'ChatGPT Adapter', status: 'operational', label: 'Operational' },
    { name: 'Claude Adapter', status: 'operational', label: 'Operational' },
    { name: 'Cloud Sync', status: 'operational', label: 'Operational' },
    { name: 'Account Handoff', status: 'operational', label: 'Operational' },
    { name: 'MCP Server', status: 'operational', label: 'Operational' },
    { name: 'Billing', status: 'operational', label: 'Operational' }
  ];

  return (
    <>
      <Helmet>
        <title>System Status | ConvoCarry AI</title>
        <meta name="description" content="Live system status and uptime for ConvoCarry AI adapters and cloud services." />
      </Helmet>

      <div className="container" style={{ maxWidth: '800px', paddingBottom: '80px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '16px' }}>System Status</h1>
        <p style={{ textAlign: 'center', color: 'var(--warning)', marginBottom: '48px', fontWeight: 500 }}>
          Status is manually updated during beta.
        </p>

        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {services.map((svc, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: idx !== services.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{svc.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className={`status-indicator status-${svc.status}`}></span>
                  <span style={{ fontWeight: 600 }}>{svc.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Status;
