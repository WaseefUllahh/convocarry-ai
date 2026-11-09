import { syncEngine } from '../storage/sync';

import { API_BASE_URL } from './config';

export const billingApi = {
  async getPlan() {
    try {
      const token = await syncEngine.getAuthToken();
      if (!token) return null;
      const res = await fetch(`${API_BASE_URL}/billing/plan`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      return null;
    }
  },

  async createCheckoutSession(plan: 'PRO' | 'TEAM', teamId?: string) {
    const token = await syncEngine.getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const res = await fetch(`${API_BASE_URL}/billing/checkout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ plan, teamId })
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Checkout failed');
    }
    
    return res.json();
  },

  async createPortalSession() {
    const token = await syncEngine.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE_URL}/billing/portal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Portal failed');
    }

    return res.json();
  }
};
