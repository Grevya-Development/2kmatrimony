import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p>Version 2026-11-01. These terms govern your use of 2K Matrimony (“we”, “us”) on the web and in our mobile apps.</p>
      <h2>1. Eligibility</h2>
      <ul>
        <li>You must be at least 18 years old and legally eligible to marry under the laws that apply to you.</li>
        <li>You may create a profile for yourself, or for a family member who has given you their consent. The person the profile represents remains its owner for all decisions about interests, connections and communication.</li>
        <li>One account per person. Profiles must represent real people and genuine marriage intentions.</li>
      </ul>
      <h2>2. Your profile and conduct</h2>
      <ul>
        <li>Provide truthful information. Verified badges reflect only the checks we performed; other details are your own statements.</li>
        <li>Do not harass, threaten, deceive or request money from other members. Do not share other members’ information outside the platform.</li>
        <li>We may remove content, limit features or suspend accounts that break these terms. Serious enforcement decisions are reviewed by a person, and you may contact support to appeal.</li>
      </ul>
      <h2>3. Matchmaking and AI features</h2>
      <ul>
        <li>Compatibility indicators describe how your stated preferences align with another member’s. They are not predictions of relationship success, and they are not personality assessments.</li>
        <li>AI features suggest searches, explanations and conversation ideas. AI never sends messages on your behalf and never reads your private conversations unless you explicitly enable a feature that asks for that.</li>
        <li>You remain responsible for your decisions about whom to meet. Please follow our safety guidance and meet in public places.</li>
      </ul>
      <h2>4. Paid plans</h2>
      <ul>
        <li>Prices are shown in Indian Rupees and include GST. A GST invoice is issued for each payment.</li>
        <li>Plans run for the period purchased and do not renew automatically unless you explicitly opt in to auto-renewal.</li>
        <li>Refunds are handled under our refund policy and applicable consumer protection law. Contact support to request one.</li>
      </ul>
      <h2>5. Privacy</h2>
      <p>Our <a className="text-emerald-600 underline" href="/legal/privacy">Privacy Policy</a> explains how we process personal data in line with India’s Digital Personal Data Protection Act, 2023.</p>
      <h2>6. Termination</h2>
      <p>You may delete your account at any time from Settings. Deletion completes after a short grace period, except where we must retain limited records by law (for example, tax invoices).</p>
      <h2>7. Liability</h2>
      <p>We provide the service with reasonable care but cannot guarantee the conduct of members or the outcome of any introduction. To the extent permitted by law, our liability is limited to the amount you paid us in the 12 months before the claim.</p>
      <h2>8. Grievances and governing law</h2>
      <p>Complaints may be sent to our Grievance Officer at the contact address below; we acknowledge within 24 hours and aim to resolve within 15 days. These terms are governed by the laws of India, with courts at Bengaluru having jurisdiction.</p>
    </>
  );
}
