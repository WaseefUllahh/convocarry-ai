import { syncEngine } from '../storage/sync';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.convocarry.ai/api/v1';

export const handoffApi = {
  async shareCard(id: string, options: { versionId?: string, expiresInMinutes?: number, maxClaims?: number, targetEmail?: string } = {}) {
    const token = await syncEngine.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE_URL}/carry-cards/${id}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(options)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create share link');
    }

    return res.json();
  },

  async previewClaim(tokenOrCode: string) {
    const token = await syncEngine.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE_URL}/claim/${tokenOrCode}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Invalid or expired claim link');
    }

    return res.json();
  },

  async confirmClaim(tokenOrCode: string, targetTeamId?: string) {
    const token = await syncEngine.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE_URL}/claim/${tokenOrCode}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ targetTeamId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to claim card');
    }

    return res.json();
  },

  async revokeShare(shareId: string) {
    const token = await syncEngine.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE_URL}/carry-cards/shares/${shareId}/revoke`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to revoke share');
    }

    return res.json();
  }
};
