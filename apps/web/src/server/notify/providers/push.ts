import type { ChannelProvider } from '../types';

// Provider slot: the real expo integration is implemented in the notifications milestone.
export const pushProvider: ChannelProvider = {
  channel: 'push',
  name: 'expo',
  isConfigured: () => false,
  send: async () => ({ status: 'skipped_unconfigured', provider: 'expo' }),
};
