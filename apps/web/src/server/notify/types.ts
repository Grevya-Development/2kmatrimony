export type DeliveryChannel = 'email' | 'sms' | 'push' | 'whatsapp';

export interface DeliveryTarget {
  userId: string;
  email: string | null;
  phone: string | null;
  pushTokens: string[];
  locale: string;
}

export interface RenderedMessage {
  subject: string | null;
  body: string;
  templateKey: string;
  providerTemplateId: string | null;
  data: Record<string, unknown>;
}

export interface DeliveryResult {
  status: 'sent' | 'failed' | 'skipped_unconfigured';
  provider: string;
  providerMessageId?: string | null;
  error?: string | null;
}

/** A channel provider. Implementations live in ./providers/*. */
export interface ChannelProvider {
  channel: DeliveryChannel;
  name: string;
  isConfigured(): boolean;
  send(target: DeliveryTarget, message: RenderedMessage): Promise<DeliveryResult>;
}
