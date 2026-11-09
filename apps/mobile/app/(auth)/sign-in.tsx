import * as React from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { config, isConfigured } from '@/lib/config';
import { haptic } from '@/lib/haptics';
import { colors, space } from '@/theme';
import { Button, ErrorState, Notice, Screen, SegmentedControl, Text, TextField } from '@/components/ui';

WebBrowser.maybeCompleteAuthSession();

type Method = 'phone' | 'email';

async function emailCode(email: string) {
  await fetch(`${config.apiUrl}/api/v1/auth/email-start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => undefined);
  const first = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: Linking.createURL('auth/callback'), shouldCreateUser: false } });
  if (first.error && /signups? not allowed|not found/i.test(first.error.message)) {
    return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: Linking.createURL('auth/callback') } });
  }
  return first;
}

export default function SignIn() {
  const [method, setMethod] = React.useState<Method>('email');
  const [methods, setMethods] = React.useState({ phone: false, google: false, apple: false });
  // Only offer sign-in methods the Supabase project has enabled.
  React.useEffect(() => {
    let cancelled = false;
    fetch(`${config.supabaseUrl}/auth/v1/settings`, { headers: { apikey: config.supabaseAnonKey } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { external?: Record<string, boolean> } | null) => {
        if (cancelled || !d?.external) return;
        const e = d.external;
        setMethods({ phone: !!e.phone, google: !!e.google, apple: !!e.apple });
        if (e.phone) setMethod('phone');
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const [step, setStep] = React.useState<'enter' | 'code'>('enter');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const e164 = () => {
    const d = phone.replace(/\D/g, '');
    return d.length === 10 ? `+91${d}` : `+${d}`;
  };

  const send = async () => {
    setBusy(true); setError(null);
    const { error: err } = method === 'phone'
      ? await supabase.auth.signInWithOtp({ phone: e164() })
      : await emailCode(email.trim());
    setBusy(false);
    if (err) setError(err.message); else { setStep('code'); haptic.success(); }
  };

  const verify = async () => {
    setBusy(true); setError(null);
    const { error: err } = method === 'phone'
      ? await supabase.auth.verifyOtp({ phone: e164(), token: code, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    setBusy(false);
    if (err) setError('That code is incorrect or has expired.'); else haptic.success();
  };

  const oauth = async (provider: 'google' | 'apple') => {
    setError(null);
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
    if (err || !data.url) return setError(err?.message.includes('not enabled') ? `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured yet.` : err?.message ?? 'Could not start sign-in.');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;
    const authCode = new URL(result.url).searchParams.get('code');
    if (!authCode) return setError('Sign-in was cancelled.');
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(authCode);
    if (exErr) setError(exErr.message);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={{ paddingTop: space.xxl }}>
        <View style={{ gap: 6 }}>
          <BrandLogo variant="stacked" height={96} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
          <Text variant="hero" accessibilityRole="header">{step === 'code' ? 'Enter your code' : 'More than a match.'}</Text>
          <Text variant="bodyMuted">{step === 'code' ? `Sent to ${method === 'phone' ? e164() : email}.` : 'A meaningful beginning. Sign in or create your account.'}</Text>
        </View>
        {!isConfigured() && <Notice tone="warning">This build has no Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Notice>}
        {step === 'enter' ? (
          <View style={{ gap: space.lg }}>
            {methods.phone && <SegmentedControl label="Sign-in method" value={method} onChange={(m) => { setMethod(m); setError(null); }} options={[{ value: 'phone', label: 'Mobile' }, { value: 'email', label: 'Email' }]} />}
            {method === 'phone'
              ? <TextField label="Mobile number" prefix="+91" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" value={phone} onChangeText={setPhone} placeholder="98765 43210" hint="We’ll text you a one-time code." />
              : <TextField label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail} placeholder="you@example.com" />}
            {error && <ErrorState message={error} />}
            <Button title="Send code" size="lg" onPress={send} loading={busy} disabled={method === 'phone' ? phone.replace(/\D/g, '').length < 10 : !email.includes('@')} full />
            {(methods.google || (methods.apple && Platform.OS === 'ios')) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /><Text variant="small">OR</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
              </View>
            )}
            {methods.google && <Button title="Continue with Google" variant="secondary" size="lg" onPress={() => oauth('google')} full />}
            {methods.apple && Platform.OS === 'ios' && <Button title="Continue with Apple" variant="secondary" size="lg" onPress={() => oauth('apple')} full />}
            <Text variant="small" style={{ textAlign: 'center' }}>By continuing you agree to our Terms and Privacy Policy. You must be 18 or older.</Text>
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            <TextField label="6-digit code" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={8} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} autoFocus style={{ fontSize: 22, letterSpacing: 8, textAlign: 'center' }} />
            {error && <ErrorState message={error} />}
            <Button title="Verify & continue" size="lg" onPress={verify} loading={busy} disabled={code.length < 6} full />
            <Button title={`Use a different ${method === 'phone' ? 'number' : 'email'}`} variant="ghost" onPress={() => { setStep('enter'); setCode(''); }} />
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
