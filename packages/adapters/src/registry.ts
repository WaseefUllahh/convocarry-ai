import { SiteAdapter, SupportedPlatform } from '@convocarry/shared-types';
import { chatgptAdapter } from './chatgpt';
import { claudeAdapter } from './claude';
import { fallbackAdapter } from './fallback';

export const adapters: SiteAdapter[] = [
  chatgptAdapter,
  claudeAdapter,
];

export function getAdapterForUrl(url: string): SiteAdapter {
  return adapters.find(a => a.matchesUrl(url)) || fallbackAdapter;
}

export function detectPlatformFromUrl(url: string): SupportedPlatform | 'unsupported' {
  const adapter = getAdapterForUrl(url);
  return adapter.platform as SupportedPlatform | 'unsupported';
}
