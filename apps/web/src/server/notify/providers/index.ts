import type { ChannelProvider, DeliveryChannel } from '../types';
import { emailProvider } from './email';
import { smsProvider } from './sms';
import { pushProvider } from './push';
import { whatsappProvider } from './whatsapp';

export const providers: Record<DeliveryChannel, ChannelProvider> = {
  email: emailProvider,
  sms: smsProvider,
  push: pushProvider,
  whatsapp: whatsappProvider,
};
