import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>Version 2026-11-01. This policy explains how 2K Marriage processes your personal data as a Data Fiduciary under India’s Digital Personal Data Protection Act, 2023 (DPDP Act).</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> phone number, email, sign-in identifiers, devices.</li>
        <li><strong>Profile data you provide:</strong> personal details, education, career, family, lifestyle, values, Relationship DNA answers, partner preferences, photos and an optional video. Fields such as religion or community are optional and only ever taken from what you enter — we never infer sensitive characteristics.</li>
        <li><strong>Verification data:</strong> documents you submit for optional identity, photo or employment checks. These are kept in restricted storage, visible only to authorised reviewers, and deleted 90 days after a decision.</li>
        <li><strong>Activity:</strong> interests, connections and messages needed to run the service, and minimal pseudonymous usage events for operating it. Optional product analytics (PostHog) runs only after you allow it, and you can withdraw that in Settings → Consents at any time.</li>
        <li><strong>No payment data:</strong> 2K Marriage is free. We do not collect card, UPI or bank details.</li>
      </ul>
      <h2>Why we use it (purposes and consent)</h2>
      <ul>
        <li>To provide matchmaking: building your profile, computing mutual compatibility and showing recommendations.</li>
        <li>AI processing of your profile answers for explanations, smart search and assistants, with your consent (you can withdraw it in Settings; AI features then fall back to non-AI behaviour).</li>
        <li>Safety: preventing fraud, spam and abuse, with human review for serious decisions.</li>
        <li>Human review: our team reviews new profiles before they go live, and our matchmakers read profiles and partner preferences to hand-pick introductions.</li>
        <li>Customer support.</li>
        <li>Optional communications (marketing email, SMS, WhatsApp) only with your separate consent.</li>
      </ul>
      <h2>Who can see your data</h2>
      <ul>
        <li>Profiles are visible only to signed-in members and never published on the open web. You control who sees photos, income and family details.</li>
        <li>Family members you invite see only what your chosen permissions allow.</li>
        <li>Our screening team and matchmakers can see your profile to review it and to choose introductions for you and for other members. Identity documents are seen only by authorised verification staff.</li>
        <li>Service providers who process data on our behalf: Supabase (database and file hosting), Anthropic (AI processing of profile text when enabled), Voyage AI (search embeddings when enabled), Resend (email), MSG91 (SMS), Meta (WhatsApp, if you opt in), Expo (push notifications), PostHog (product analytics, only if you opt in — pseudonymous usage events, never your name, contact details, profile text or messages).</li>
      </ul>
      <h2>Your rights</h2>
      <ul>
        <li>Access and download a copy of your data from Settings.</li>
        <li>Correct or update your information at any time.</li>
        <li>Withdraw consent for optional processing.</li>
        <li>Delete your account; deletion completes after a 14-day grace period. Limited records are kept only where the law requires it.</li>
        <li>Nominate another person to exercise your rights in case of death or incapacity, and raise grievances with our Grievance Officer or the Data Protection Board of India.</li>
      </ul>
      <h2>Retention</h2>
      <p>Data-export archives are deleted after 7 days; verification documents 90 days after a decision; AI usage and analytics logs after 13 months; account data after deletion as described above.</p>
      <h2>Security</h2>
      <p>Encryption in transit and at rest, row-level access controls, private storage with time-limited links, mandatory multi-factor authentication for administrators and audit logging of administrative access. We will notify affected members and the Data Protection Board of a personal data breach as the law requires.</p>
      <h2>Children</h2>
      <p>The service is only for adults aged 18 and above. We do not knowingly process children’s data.</p>
    </>
  );
}
