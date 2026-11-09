/**
 * Environment access. Public vars are inlined by Next at build time; server
 * secrets are read lazily so that missing optional integrations never crash the
 * app — callers check `integrations` and degrade gracefully.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const serverEnv = {
  get supabaseServiceRoleKey() { return required('SUPABASE_SERVICE_ROLE_KEY'); },
  get cronSecret() { return process.env.CRON_SECRET ?? ''; },
  get anthropicApiKey() { return process.env.ANTHROPIC_API_KEY ?? ''; },
  get voyageApiKey() { return process.env.VOYAGE_API_KEY ?? ''; },
  get razorpayKeyId() { return process.env.RAZORPAY_KEY_ID ?? ''; },
  get razorpayKeySecret() { return process.env.RAZORPAY_KEY_SECRET ?? ''; },
  get razorpayWebhookSecret() { return process.env.RAZORPAY_WEBHOOK_SECRET ?? ''; },
  get resendApiKey() { return process.env.RESEND_API_KEY ?? ''; },
  get emailFrom() { return process.env.EMAIL_FROM ?? '2K Matrimony <no-reply@example.com>'; },
  get msg91AuthKey() { return process.env.MSG91_AUTH_KEY ?? ''; },
  get msg91SenderId() { return process.env.MSG91_SENDER_ID ?? ''; },
  get whatsappPhoneNumberId() { return process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''; },
  get whatsappAccessToken() { return process.env.WHATSAPP_ACCESS_TOKEN ?? ''; },
  get expoAccessToken() { return process.env.EXPO_ACCESS_TOKEN ?? ''; },
};

/** Which optional third-party integrations are configured. */
export const integrations = {
  get anthropic() { return !!serverEnv.anthropicApiKey; },
  get voyage() { return !!serverEnv.voyageApiKey; },
  get razorpay() { return !!(serverEnv.razorpayKeyId && serverEnv.razorpayKeySecret); },
  get razorpayWebhooks() { return !!serverEnv.razorpayWebhookSecret; },
  get email() { return !!serverEnv.resendApiKey; },
  get sms() { return !!(serverEnv.msg91AuthKey && serverEnv.msg91SenderId); },
  get whatsapp() { return !!(serverEnv.whatsappPhoneNumberId && serverEnv.whatsappAccessToken); },
  get push() { return true; }, // Expo push works without a token; token adds security
};

export type IntegrationName = keyof typeof integrations;
export const integrationStatus = (): Record<IntegrationName, boolean> =>
  Object.fromEntries((Object.keys(integrations) as IntegrationName[]).map((k) => [k, integrations[k]])) as Record<IntegrationName, boolean>;
