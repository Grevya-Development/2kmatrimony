import type { ChannelProvider } from '../types';

// Provider slot: the real msg91 integration is implemented in the notifications milestone.
export const smsProvider: ChannelProvider = {
  channel: 'sms',
  name: 'msg91',
  isConfigured: () => false,
  send: async () => ({ status: 'skipped_unconfigured', provider: 'msg91' }),
};
