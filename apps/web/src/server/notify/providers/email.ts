import type { ChannelProvider } from '../types';

// Provider slot: the real resend integration is implemented in the notifications milestone.
export const emailProvider: ChannelProvider = {
  channel: 'email',
  name: 'resend',
  isConfigured: () => false,
  send: async () => ({ status: 'skipped_unconfigured', provider: 'resend' }),
};
