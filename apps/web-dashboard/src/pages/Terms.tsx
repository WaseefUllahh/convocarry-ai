import React from 'react';
import { Helmet } from 'react-helmet-async';

const Terms: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Use | ConvoCarry AI</title>
        <meta name="description" content="ConvoCarry AI Terms of Use and service agreements." />
      </Helmet>

      <div className="container" style={{ maxWidth: '800px', paddingBottom: '80px' }}>
        <h1>Terms of Use</h1>
        <p><strong>Effective Date:</strong> 2026-06-19</p>

        <div className="card" style={{ marginTop: '32px' }}>
          <h3>1. User Responsibility</h3>
          <p>You are solely responsible for the content you capture, store, and inject using ConvoCarry AI. You must ensure you possess the rights to utilize this content and that you do not violate the terms of service of the third-party AI platforms (e.g., OpenAI, Anthropic).</p>

          <h3 style={{ marginTop: '32px' }}>2. Acceptable Use</h3>
          <p>You agree not to use ConvoCarry AI for any illegal purposes. You specifically agree not to abuse the Account Handoff or Cloud Sync features to systematically bypass rate limits, usage quotas, or paywalls established by third-party AI platforms.</p>

          <h3 style={{ marginTop: '32px' }}>3. Paid Subscriptions & Refunds</h3>
          <p>Pro and Team features require an active subscription. Payments are processed securely via Stripe. We offer a 14-day no-questions-asked refund policy for all new subscriptions. Please contact support to initiate a refund.</p>

          <h3 style={{ marginTop: '32px' }}>4. Service Availability & Limitation of Liability</h3>
          <p>ConvoCarry AI relies on the DOM structures of third-party websites. If these platforms change their UI, the extension's capture/inject features may temporarily break. We provide the service "as-is" and are not liable for lost context, interrupted service, or account actions taken by third-party platforms.</p>

          <h3 style={{ marginTop: '32px' }}>5. Affiliation</h3>
          <p>ConvoCarry AI is an independent tool and is not affiliated with, endorsed by, or sponsored by OpenAI, Anthropic, Google, Perplexity, DeepSeek, Cursor, Claude Desktop, or any other AI platform.</p>
        </div>
      </div>
    </>
  );
};

export default Terms;
