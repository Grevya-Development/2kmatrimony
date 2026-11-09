/**
 * Canonical allowed values. These mirror the CHECK constraints in
 * supabase/migrations — change both together.
 */

export type Option<T extends string = string> = { value: T; label: string };

const opts = <T extends string>(entries: readonly (readonly [T, string])[]): Option<T>[] =>
  entries.map(([value, label]) => ({ value, label }));

export const CREATED_FOR = ['self', 'son', 'daughter', 'brother', 'sister', 'relative', 'friend', 'other'] as const;
export type CreatedFor = (typeof CREATED_FOR)[number];
export const CREATED_FOR_OPTIONS = opts<CreatedFor>([
  ['self', 'Myself'],
  ['son', 'My son'],
  ['daughter', 'My daughter'],
  ['brother', 'My brother'],
  ['sister', 'My sister'],
  ['relative', 'A relative'],
  ['friend', 'A friend'],
  ['other', 'Someone else'],
]);

export const GENDERS = ['female', 'male', 'other'] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_OPTIONS = opts<Gender>([
  ['female', 'Woman'],
  ['male', 'Man'],
  ['other', 'Another identity'],
]);

export const MARITAL_STATUSES = ['never_married', 'divorced', 'widowed', 'awaiting_divorce', 'annulled'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
export const MARITAL_STATUS_OPTIONS = opts<MaritalStatus>([
  ['never_married', 'Never married'],
  ['divorced', 'Divorced'],
  ['widowed', 'Widowed'],
  ['awaiting_divorce', 'Awaiting divorce'],
  ['annulled', 'Annulled'],
]);

export const NAME_VISIBILITY = ['full', 'first_name', 'initials'] as const;
export type NameVisibility = (typeof NAME_VISIBILITY)[number];

export const PROFILE_STATUSES = ['draft', 'active', 'hidden', 'suspended', 'deleted'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const AUDIENCES = ['members', 'connections', 'hidden'] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_OPTIONS = opts<Audience>([
  ['members', 'All signed-in members'],
  ['connections', 'Only my connections'],
  ['hidden', 'Nobody'],
]);

export const PHOTO_VISIBILITY = ['members', 'connections', 'on_request'] as const;
export type PhotoVisibility = (typeof PHOTO_VISIBILITY)[number];
export const PHOTO_VISIBILITY_OPTIONS = opts<PhotoVisibility>([
  ['members', 'All signed-in members'],
  ['connections', 'Only my connections'],
  ['on_request', 'Blurred until I accept an interest'],
]);

export const EDUCATION_LEVELS = ['high_school', 'diploma', 'bachelors', 'masters', 'doctorate', 'professional'] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const EDUCATION_LEVEL_OPTIONS = opts<EducationLevel>([
  ['high_school', 'High school'],
  ['diploma', 'Diploma'],
  ['bachelors', "Bachelor's degree"],
  ['masters', "Master's degree"],
  ['doctorate', 'Doctorate'],
  ['professional', 'Professional (CA, MBBS, LLB…)'],
]);
/** Ordinal rank used for "at least" comparisons. */
export const EDUCATION_RANK: Record<EducationLevel, number> = {
  high_school: 1,
  diploma: 2,
  bachelors: 3,
  masters: 4,
  professional: 4,
  doctorate: 5,
};

export const EMPLOYMENT_TYPES = ['employed', 'self_employed', 'business', 'government', 'student', 'not_working'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_TYPE_OPTIONS = opts<EmploymentType>([
  ['employed', 'Private sector'],
  ['government', 'Government / public sector'],
  ['self_employed', 'Self-employed professional'],
  ['business', 'Business owner'],
  ['student', 'Student'],
  ['not_working', 'Not working currently'],
]);

export const INCOME_RANGES = ['none', 'lt_3l', '3_6l', '6_10l', '10_15l', '15_25l', '25_50l', '50l_1cr', 'gt_1cr', 'prefer_not'] as const;
export type IncomeRange = (typeof INCOME_RANGES)[number];
export const INCOME_RANGE_OPTIONS = opts<IncomeRange>([
  ['none', 'No income'],
  ['lt_3l', 'Under ₹3 lakh'],
  ['3_6l', '₹3–6 lakh'],
  ['6_10l', '₹6–10 lakh'],
  ['10_15l', '₹10–15 lakh'],
  ['15_25l', '₹15–25 lakh'],
  ['25_50l', '₹25–50 lakh'],
  ['50l_1cr', '₹50 lakh–1 crore'],
  ['gt_1cr', 'Above ₹1 crore'],
  ['prefer_not', 'Prefer not to say'],
]);
export const INCOME_RANK: Record<IncomeRange, number | null> = {
  none: 0, lt_3l: 1, '3_6l': 2, '6_10l': 3, '10_15l': 4, '15_25l': 5, '25_50l': 6, '50l_1cr': 7, gt_1cr: 8, prefer_not: null,
};

export const RELOCATION = ['open', 'within_country', 'not_open', 'undecided'] as const;
export type Relocation = (typeof RELOCATION)[number];
export const RELOCATION_OPTIONS = opts<Relocation>([
  ['open', 'Open to relocating, including abroad'],
  ['within_country', 'Open within India'],
  ['not_open', 'Prefer not to relocate'],
  ['undecided', 'Undecided'],
]);

export const FAMILY_STRUCTURES = ['nuclear', 'joint', 'extended', 'single_parent', 'other'] as const;
export type FamilyStructure = (typeof FAMILY_STRUCTURES)[number];
export const FAMILY_STRUCTURE_OPTIONS = opts<FamilyStructure>([
  ['nuclear', 'Nuclear family'],
  ['joint', 'Joint family'],
  ['extended', 'Extended family nearby'],
  ['single_parent', 'Single-parent family'],
  ['other', 'Other'],
]);

export const FAMILY_VALUES = ['traditional', 'moderate', 'liberal'] as const;
export type FamilyValues = (typeof FAMILY_VALUES)[number];
export const FAMILY_VALUES_OPTIONS = opts<FamilyValues>([
  ['traditional', 'Traditional'],
  ['moderate', 'Moderate'],
  ['liberal', 'Liberal'],
]);

export const DIETS = ['vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain', 'flexible'] as const;
export type Diet = (typeof DIETS)[number];
export const DIET_OPTIONS = opts<Diet>([
  ['vegetarian', 'Vegetarian'],
  ['eggetarian', 'Eggetarian'],
  ['non_vegetarian', 'Non-vegetarian'],
  ['vegan', 'Vegan'],
  ['jain', 'Jain'],
  ['flexible', 'Flexible'],
]);

export const HABIT_FREQUENCY = ['never', 'occasionally', 'regularly', 'quitting'] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCY)[number];
export const HABIT_OPTIONS = opts<HabitFrequency>([
  ['never', 'Never'],
  ['occasionally', 'Occasionally'],
  ['regularly', 'Regularly'],
  ['quitting', 'Trying to quit'],
]);

export const FITNESS = ['rarely', 'sometimes', 'regularly', 'athlete'] as const;
export type Fitness = (typeof FITNESS)[number];
export const FITNESS_OPTIONS = opts<Fitness>([
  ['rarely', 'Rarely'],
  ['sometimes', 'Sometimes'],
  ['regularly', 'Regularly'],
  ['athlete', 'Very active / athlete'],
]);

export const TRAVEL = ['rarely', 'occasionally', 'frequently', 'passionate'] as const;
export type Travel = (typeof TRAVEL)[number];
export const TRAVEL_OPTIONS = opts<Travel>([
  ['rarely', 'Rarely travel'],
  ['occasionally', 'A trip or two a year'],
  ['frequently', 'Travel often'],
  ['passionate', 'Travel is a passion'],
]);

export const COMMUNICATION_STYLES = ['frequent_checkins', 'balanced', 'space_and_depth', 'direct', 'gentle'] as const;
export const CONFLICT_STYLES = ['talk_immediately', 'cool_off_then_talk', 'written', 'mediated'] as const;
export const FINANCIAL_PHILOSOPHIES = ['saver', 'balanced', 'spender', 'investor', 'shared_pool', 'separate_finances'] as const;
export const INDEPENDENCE_LEVELS = ['very_independent', 'balanced', 'very_together'] as const;

export const CHILDREN_PREFERENCES = ['want', 'dont_want', 'open', 'have_and_want_more', 'have_no_more'] as const;
export type ChildrenPreference = (typeof CHILDREN_PREFERENCES)[number];
export const CHILDREN_OPTIONS = opts<ChildrenPreference>([
  ['want', 'Would like children'],
  ['open', 'Open to children'],
  ['dont_want', 'Prefer no children'],
  ['have_and_want_more', 'Has children, wants more'],
  ['have_no_more', 'Has children, no more'],
]);

export const LIVING_ARRANGEMENTS = ['independent', 'with_parents', 'near_parents', 'flexible'] as const;
export type LivingArrangement = (typeof LIVING_ARRANGEMENTS)[number];
export const LIVING_OPTIONS = opts<LivingArrangement>([
  ['independent', 'Own home'],
  ['with_parents', 'With parents'],
  ['near_parents', 'Near parents'],
  ['flexible', 'Flexible'],
]);

export const SETTLE_PREFERENCES = ['current_city', 'india_any', 'abroad', 'flexible'] as const;
export type SettlePreference = (typeof SETTLE_PREFERENCES)[number];
export const SETTLE_OPTIONS = opts<SettlePreference>([
  ['current_city', 'Current city'],
  ['india_any', 'Anywhere in India'],
  ['abroad', 'Abroad'],
  ['flexible', 'Flexible'],
]);

export const HOUSEHOLD_SPLITS = ['equal', 'flexible', 'traditional', 'outsourced'] as const;

/** Relationship DNA ----------------------------------------------------------- */
export const DNA_DIMENSIONS = [
  'emotional_connection',
  'communication',
  'family_orientation',
  'independence',
  'career_ambition',
  'lifestyle_pace',
  'financial_philosophy',
  'long_term_aspirations',
  'shared_interests',
  'personal_values',
] as const;
export type DnaDimension = (typeof DNA_DIMENSIONS)[number];

export const DNA_DIMENSION_META: Record<DnaDimension, { label: string; left: string; right: string }> = {
  emotional_connection: { label: 'Emotional connection', left: 'Quiet support', right: 'Expressive closeness' },
  communication: { label: 'Communication', left: 'Space & depth', right: 'Always in touch' },
  family_orientation: { label: 'Family orientation', left: 'Own household first', right: 'Extended family central' },
  independence: { label: 'Independence', left: 'Independent', right: 'Together' },
  career_ambition: { label: 'Career ambition', left: 'Balance first', right: 'Career-driven' },
  lifestyle_pace: { label: 'Lifestyle pace', left: 'Calm & homely', right: 'Active & social' },
  financial_philosophy: { label: 'Financial philosophy', left: 'Security first', right: 'Experiences first' },
  long_term_aspirations: { label: 'Long-term aspirations', left: 'Settled & rooted', right: 'Evolving & ambitious' },
  shared_interests: { label: 'Shared interests', left: 'Separate hobbies', right: 'Many shared hobbies' },
  personal_values: { label: 'Outlook on tradition', left: 'Contemporary', right: 'Rooted in tradition' },
};

/** Scoring dimensions used by the matching engine and admin weight config. */
export const SCORE_DIMENSIONS = [
  'values',
  'emotional',
  'personality',
  'future',
  'lifestyle',
  'family',
  'career',
  'location',
  'interests',
] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];
export const SCORE_DIMENSION_LABELS: Record<ScoreDimension, string> = {
  values: 'Values',
  emotional: 'Emotional expectations',
  personality: 'Personality & communication',
  future: 'Future goals',
  lifestyle: 'Lifestyle',
  family: 'Family expectations',
  career: 'Career',
  location: 'Location',
  interests: 'Shared interests',
};

/** Fields a member can mark as non-negotiable in partner preferences. */
export const NON_NEGOTIABLE_FIELDS = [
  'age',
  'height',
  'marital_status',
  'education',
  'location',
  'diet',
  'smoking',
  'drinking',
  'children',
  'mother_tongue',
  'religion',
  'living_arrangement',
] as const;
export type NonNegotiableField = (typeof NON_NEGOTIABLE_FIELDS)[number];
export const NON_NEGOTIABLE_LABELS: Record<NonNegotiableField, string> = {
  age: 'Age range',
  height: 'Height range',
  marital_status: 'Marital status',
  education: 'Education',
  location: 'Location',
  diet: 'Diet',
  smoking: 'Smoking',
  drinking: 'Drinking',
  children: 'Children',
  mother_tongue: 'Mother tongue',
  religion: 'Religion',
  living_arrangement: 'Living arrangement',
};

export const CORE_VALUES = ['honesty', 'kindness', 'family', 'growth', 'ambition', 'faith', 'equality', 'tradition', 'adventure', 'stability', 'humour', 'service', 'independence', 'respect', 'loyalty'] as const;
export const PERSONALITY_TRAITS = ['calm', 'cheerful', 'thoughtful', 'adventurous', 'introverted', 'extroverted', 'organised', 'spontaneous', 'creative', 'practical', 'empathetic', 'driven', 'easygoing', 'curious', 'spiritual'] as const;

export const INTEREST_SUGGESTIONS = [
  'Travel', 'Reading', 'Music', 'Cooking', 'Fitness', 'Yoga', 'Hiking', 'Cricket', 'Football', 'Badminton',
  'Movies', 'Theatre', 'Photography', 'Art', 'Dance', 'Gardening', 'Volunteering', 'Technology', 'Startups',
  'Investing', 'Spirituality', 'Meditation', 'Podcasts', 'Gaming', 'Writing', 'Classical music', 'Food', 'Pets',
] as const;

export const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Odia', 'Konkani', 'Tulu'] as const;
export const APP_LOCALES = ['en', 'ta', 'kn', 'te', 'ml', 'hi'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

/** Interests & connections ---------------------------------------------------- */
export const INTEREST_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn', 'expired'] as const;
export type InterestStatus = (typeof INTEREST_STATUSES)[number];

export const REPORT_REASONS = ['fake_profile', 'harassment', 'inappropriate_content', 'scam_or_fraud', 'spam', 'underage', 'married_or_misrepresentation', 'offensive_language', 'safety_concern', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_OPTIONS = opts<ReportReason>([
  ['fake_profile', 'Fake or impersonating profile'],
  ['harassment', 'Harassment or threats'],
  ['inappropriate_content', 'Inappropriate photos or content'],
  ['scam_or_fraud', 'Scam, fraud or money request'],
  ['spam', 'Spam or advertising'],
  ['underage', 'Appears to be under 18'],
  ['married_or_misrepresentation', 'Already married or misrepresenting themselves'],
  ['offensive_language', 'Offensive language'],
  ['safety_concern', 'I feel unsafe'],
  ['other', 'Something else'],
]);

/** Family ---------------------------------------------------------------------- */
export const FAMILY_RELATIONS = ['mother', 'father', 'brother', 'sister', 'guardian', 'relative', 'friend', 'other'] as const;
export type FamilyRelation = (typeof FAMILY_RELATIONS)[number];
export const FAMILY_PERMISSIONS = ['view_profiles', 'suggest_matches', 'shortlist', 'discuss', 'coordinate_meetings'] as const;
export type FamilyPermission = (typeof FAMILY_PERMISSIONS)[number];
export const FAMILY_PERMISSION_LABELS: Record<FamilyPermission, string> = {
  view_profiles: 'View my profile and suggested matches',
  suggest_matches: 'Suggest profiles to me',
  shortlist: 'Add profiles to my shortlist',
  discuss: 'Discuss introductions with me',
  coordinate_meetings: 'Help coordinate meetings',
};

/** Verification ---------------------------------------------------------------- */
export const VERIFICATION_KINDS = ['phone', 'email', 'government_id', 'photo', 'employment', 'education'] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];
export const VERIFICATION_STATUSES = ['pending', 'in_review', 'approved', 'rejected', 'resubmission_required', 'expired'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export const VERIFICATION_KIND_LABELS: Record<VerificationKind, string> = {
  phone: 'Mobile number',
  email: 'Email address',
  government_id: 'Government ID',
  photo: 'Photo',
  employment: 'Employment',
  education: 'Education',
};
export const ID_DOCUMENT_TYPES = ['aadhaar_masked', 'passport', 'driving_licence', 'pan', 'voter_id'] as const;
export const EMPLOYMENT_DOCUMENT_TYPES = ['offer_letter', 'payslip', 'employee_id', 'work_email'] as const;

/** Connection features --------------------------------------------------------- */
export const VISION_CATEGORIES = ['travel', 'lifestyle', 'career', 'location', 'financial', 'family', 'personal_growth'] as const;
export type VisionCategory = (typeof VISION_CATEGORIES)[number];
export const VISION_CATEGORY_LABELS: Record<VisionCategory, string> = {
  travel: 'Travel ambitions',
  lifestyle: 'Lifestyle',
  career: 'Career goals',
  location: 'Where we live',
  financial: 'Financial goals',
  family: 'Family aspirations',
  personal_growth: 'Personal growth',
};
export const JOURNAL_KINDS = ['topic_discussed', 'expectation_clarified', 'interest_discovered', 'question_remaining', 'preference_updated', 'note'] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];
export const JOURNAL_KIND_LABELS: Record<JournalKind, string> = {
  topic_discussed: 'Topic discussed',
  expectation_clarified: 'Expectation clarified',
  interest_discovered: 'Shared interest discovered',
  question_remaining: 'Question still to discuss',
  preference_updated: 'Preference updated',
  note: 'Note',
};
export const READINESS_TOPICS = ['finances', 'career', 'children', 'family_involvement', 'household', 'living_arrangements', 'relocation', 'lifestyle', 'independence', 'future_ambitions', 'conflict_resolution'] as const;
export type ReadinessTopic = (typeof READINESS_TOPICS)[number];
export const READINESS_TOPIC_LABELS: Record<ReadinessTopic, string> = {
  finances: 'Financial responsibilities',
  career: 'Career expectations',
  children: 'Children',
  family_involvement: 'Family involvement',
  household: 'Household responsibilities',
  living_arrangements: 'Living arrangements',
  relocation: 'Relocation',
  lifestyle: 'Lifestyle',
  independence: 'Personal independence',
  future_ambitions: 'Future ambitions',
  conflict_resolution: 'Handling disagreements',
};

/** Notifications --------------------------------------------------------------- */
export const NOTIFICATION_CATEGORIES = ['interests', 'connections', 'messages', 'recommendations', 'verification', 'billing', 'family', 'product_updates', 'security'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'push', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Consent --------------------------------------------------------------------- */
export const CONSENT_TYPES = ['terms', 'privacy', 'ai_processing', 'ai_message_analysis', 'family_access', 'marketing_email', 'marketing_sms', 'whatsapp', 'identity_verification', 'data_sharing_partner'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Billing --------------------------------------------------------------------- */
export const PLAN_CODES = ['free', 'plus', 'premium', 'elite'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
export const BILLING_INTERVALS = ['month', 'quarter', 'half_year', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export const BILLING_INTERVAL_MONTHS: Record<BillingInterval, number> = { month: 1, quarter: 3, half_year: 6, year: 12 };
export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = { month: 'Monthly', quarter: '3 months', half_year: '6 months', year: '12 months' };

/** Admin ----------------------------------------------------------------------- */
export const ADMIN_PERMISSIONS = [
  'users.read', 'users.manage', 'profiles.read', 'profiles.moderate', 'sensitive_data.read', 'verification.review',
  'reports.manage', 'moderation.act', 'risk.review', 'matching.read', 'matching.configure', 'matchmaker.curate',
  'ai.read', 'ai.configure', 'subscriptions.read', 'subscriptions.manage', 'payments.read', 'refunds.manage',
  'coupons.manage', 'plans.manage', 'support.read', 'support.respond', 'cms.manage', 'notifications.manage',
  'analytics.read', 'analytics.export', 'audit.read', 'settings.manage', 'feature_flags.manage', 'onboarding.manage',
  'regions.manage', 'admins.manage', 'roles.manage',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const AI_FEATURES = [
  'matchmaker_chat', 'smart_search', 'match_explanation', 'gap_analysis', 'before_you_meet', 'readiness_assistant',
  'vision_board_themes', 'dna_interpretation', 'conversation_starters', 'moderation', 'embeddings',
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const labelOf = <T extends string>(options: Option<T>[], value: T | null | undefined): string =>
  options.find((o) => o.value === value)?.label ?? (value ? String(value).replace(/_/g, ' ') : '');
