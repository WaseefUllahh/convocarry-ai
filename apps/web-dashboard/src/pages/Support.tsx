import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';

const Support: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'bug',
    message: '',
    diagnosticsOptIn: true
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.message) {
      setErrorMsg('Email and Message are required.');
      setStatus('error');
      return;
    }
    
    setStatus('loading');
    try {
      const payload = {
        ...formData,
        browserVersion: navigator.userAgent,
        extensionVersion: '1.0.0-beta'
      };

      // Ensure no card content is included.
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api.convocarry.ai'}/api/v1/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        throw new Error('Failed to submit support request. Please try again later.');
      }
      
      setStatus('success');
      setFormData({ name: '', email: '', category: 'bug', message: '', diagnosticsOptIn: true });
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  return (
    <>
      <Helmet>
        <title>Support | ConvoCarry AI</title>
        <meta name="description" content="Get help with ConvoCarry AI. Submit bug reports, feature requests, or billing inquiries." />
      </Helmet>

      <div className="container" style={{ maxWidth: '800px', paddingBottom: '80px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>Support & Troubleshooting</h1>
        <p style={{ textAlign: 'center', marginBottom: '48px' }}>
          During beta, we aim to respond to support requests within 24–48 business hours. You can also reach us directly at <a href="mailto:support@convocarry.ai">support@convocarry.ai</a>.
        </p>

        <div className="card">
          <h2 style={{ marginBottom: '24px' }}>Contact Support</h2>
          
          {status === 'success' && (
            <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--success)' }}>
              Your message has been sent successfully. We will get back to you soon.
            </div>
          )}

          {status === 'error' && (
            <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--danger)' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name (Optional)</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            
            <div className="form-group">
              <label>Email *</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="bug">Report a Bug</option>
                <option value="adapter_issue">Adapter Issue (Capture/Inject Failed)</option>
                <option value="billing">Billing Inquiry</option>
                <option value="account_handoff">Account Handoff</option>
                <option value="mcp">MCP Access</option>
                <option value="feature_request">Feature Request</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Message *</label>
              <textarea rows={5} required value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})}></textarea>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={formData.diagnosticsOptIn} onChange={e => setFormData({...formData, diagnosticsOptIn: e.target.checked})} style={{ width: 'auto' }} />
                Include anonymous technical diagnostics (Browser/Extension version)
              </label>
              <p style={{ fontSize: '0.8rem', marginLeft: '24px', marginTop: '4px' }}>We never automatically include Carry Card content in support requests.</p>
            </div>

            <button type="submit" className="btn btn-primary" disabled={status === 'loading'} style={{ width: '100%', marginTop: '16px' }}>
              {status === 'loading' ? 'Sending...' : 'Submit Support Request'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default Support;
