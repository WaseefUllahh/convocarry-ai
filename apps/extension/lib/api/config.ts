/** Accept an API origin or an existing /api/v1 base without duplicating the prefix. */
export function resolveApiBaseUrl(value?: string): string {
  const url = new URL(value?.trim() || 'https://api.convocarry.ai');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('The API must use HTTPS (HTTP is allowed only for local development).');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('The API URL must not contain credentials, a query, or a fragment.');
  }
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/api/v1') ? path : `${path}/api/v1`;
  return url.toString().replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
