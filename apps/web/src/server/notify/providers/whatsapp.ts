import type { ChannelProvider } from '../types';

// Provider slot: the real meta_cloud integration is implemented in the notifications milestone.
export const whatsappProvider: ChannelProvider = {
  channel: 'whatsapp',
  name: 'meta_cloud',
  isConfigured: () => false,
  send: async () => ({ status: 'skipped_unconfigured', provider: 'meta_cloud' }),
};
