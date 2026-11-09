/**
 * Request validation schemas — the single API input contract for web and mobile.
 * The server validates every request body with these.
 */
import { z } from 'zod';
import * as C from './constants';

const trimmed = (max: number) => z.string().trim().max(max);
const optText = (max: number) => trimmed(max).nullish().transform((v) => (v === '' ? null : v ?? null));
const tags = (max: number, itemMax = 40) => z.array(z.string().trim().min(1).max(itemMax)).max(max);
const uuid = z.uuid();

// ---------------------------------------------------------------------------
// Account & onboarding
// ---------------------------------------------------------------------------
export const startProfileSchema = z.object({
  createdFor: z.enum(C.CREATED_FOR),
  managedByRelation: optText(40),
  consents: z.object({
    terms: z.literal(true),
    privacy: z.literal(true),
    aiProcessing: z.boolean(),
  }),
});
export type StartProfileInput = z.infer<typeof startProfileSchema>;

const MIN_AGE_YEARS = 18;
export const isAdultDob = (dob: string, now = new Date()): boolean => {
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const adult = new Date(Date.UTC(d.getUTCFullYear() + MIN_AGE_YEARS, d.getUTCMonth(), d.getUTCDate()));
  return adult.getTime() <= now.getTime();
};

export const basicsSchema = z.object({
  firstName: trimmed(60).min(1, 'First name is required'),
  lastName: optText(60),
  nameVisibility: z.enum(C.NAME_VISIBILITY).default('first_name'),
  dateOfBirth: z.iso.date().refine((v) => isAdultDob(v), 'Members must be at least 18 years old'),
  gender: z.enum(C.GENDERS),
  heightCm: z.number().int().min(120).max(230).nullish(),
  maritalStatus: z.enum(C.MARITAL_STATUSES),
  hasChildren: z.boolean().nullish(),
  motherTongue: optText(40),
  languages: tags(10),
  nationality: optText(60),
  religion: optText(60),
  community: optText(80),
  currentCity: trimmed(80).min(1, 'City is required'),
  currentState: optText(80),
  currentCountry: z.string().trim().length(2).default('IN'),
  nativePlace: optText(120),
  about: optText(2000),
});
export type BasicsInput = z.infer<typeof basicsSchema>;

export const educationItemSchema = z.object({
  id: uuid.optional(),
  level: z.enum(C.EDUCATION_LEVELS),
  qualification: trimmed(120).min(1),
  institution: optText(160),
  specialization: optText(120),
  graduationYear: z.number().int().min(1950).max(2100).nullish(),
  isHighest: z.boolean().default(false),
});
export const educationSchema = z.object({ items: z.array(educationItemSchema).max(6) });
export type EducationInput = z.infer<typeof educationSchema>;

export const careerSchema = z.object({
  profession: optText(120),
  employmentType: z.enum(C.EMPLOYMENT_TYPES).nullish(),
  company: optText(120),
  designation: optText(120),
  incomeRange: z.enum(C.INCOME_RANGES).nullish(),
  incomeVisibility: z.enum(C.AUDIENCES).default('connections'),
  workCity: optText(80),
  workCountry: optText(2),
  relocationWillingness: z.enum(C.RELOCATION).nullish(),
});
export type CareerInput = z.infer<typeof careerSchema>;

export const familySchema = z.object({
  familyStructure: z.enum(C.FAMILY_STRUCTURES).nullish(),
  familyValues: z.enum(C.FAMILY_VALUES).nullish(),
  familyBackground: optText(1000),
  fatherOccupation: optText(120),
  motherOccupation: optText(120),
  brothers: z.number().int().min(0).max(20).nullish(),
  sisters: z.number().int().min(0).max(20).nullish(),
  siblingsDetails: optText(500),
  familyNativePlace: optText(120),
  familyLocation: optText(120),
});
export type FamilyInput = z.infer<typeof familySchema>;

export const lifestyleSchema = z.object({
  diet: z.enum(C.DIETS).nullish(),
  smoking: z.enum(C.HABIT_FREQUENCY).nullish(),
  drinking: z.enum(C.HABIT_FREQUENCY).nullish(),
  fitness: z.enum(C.FITNESS).nullish(),
  travel: z.enum(C.TRAVEL).nullish(),
  hobbies: tags(15),
  interests: tags(20),
});
export type LifestyleInput = z.infer<typeof lifestyleSchema>;

export const valuesSchema = z.object({
  emotionalExpectations: optText(1000),
  communicationStyle: z.enum(C.COMMUNICATION_STYLES).nullish(),
  conflictStyle: z.enum(C.CONFLICT_STYLES).nullish(),
  familyResponsibilities: optText(1000),
  careerAmbitions: optText(1000),
  financialPhilosophy: z.enum(C.FINANCIAL_PHILOSOPHIES).nullish(),
  relationshipExpectations: optText(1000),
  futureGoals: optText(1000),
  independenceLevel: z.enum(C.INDEPENDENCE_LEVELS).nullish(),
  childrenPreference: z.enum(C.CHILDREN_PREFERENCES).nullish(),
  livingArrangement: z.enum(C.LIVING_ARRANGEMENTS).nullish(),
  settlePreference: z.enum(C.SETTLE_PREFERENCES).nullish(),
  householdSplit: z.enum(C.HOUSEHOLD_SPLITS).nullish(),
  coreValues: z.array(z.enum(C.CORE_VALUES)).max(5).optional(),
  personalityTraits: z.array(z.enum(C.PERSONALITY_TRAITS)).max(5).optional(),
});
export type ValuesInput = z.infer<typeof valuesSchema>;

export const dnaEntrySchema = z.object({
  dimension: z.enum(C.DNA_DIMENSIONS),
  selfScore: z.number().int().min(0).max(100),
  partnerTarget: z.number().int().min(0).max(100).nullable(),
  importance: z.number().int().min(1).max(5),
  flexible: z.boolean(),
  statement: optText(500),
});
export const dnaSchema = z.object({ entries: z.array(dnaEntrySchema).min(1).max(C.DNA_DIMENSIONS.length) });
export type DnaInput = z.infer<typeof dnaSchema>;

/** Free-text answers to the configurable question bank. */
export const questionAnswersSchema = z.object({
  answers: z
    .array(z.object({ questionKey: z.string().min(1).max(80), answer: z.unknown() }))
    .min(1)
    .max(50),
});
export type QuestionAnswersInput = z.infer<typeof questionAnswersSchema>;

export const partnerPreferencesSchema = z
  .object({
    seekingGenders: z.array(z.enum(C.GENDERS)).min(1, 'Choose at least one'),
    ageMin: z.number().int().min(18).max(99),
    ageMax: z.number().int().min(18).max(99),
    heightMinCm: z.number().int().min(120).max(230).nullish(),
    heightMaxCm: z.number().int().min(120).max(230).nullish(),
    maritalStatuses: z.array(z.enum(C.MARITAL_STATUSES)).default([]),
    educationLevels: z.array(z.enum(C.EDUCATION_LEVELS)).default([]),
    professions: tags(10, 80).default([]),
    minIncomeRange: z.enum(C.INCOME_RANGES).nullish(),
    countries: z.array(z.string().length(2)).max(20).default([]),
    cities: tags(20, 80).default([]),
    openToRelocatePartner: z.boolean().nullish(),
    diets: z.array(z.enum(C.DIETS)).default([]),
    smokingOk: z.array(z.enum(C.HABIT_FREQUENCY)).default([]),
    drinkingOk: z.array(z.enum(C.HABIT_FREQUENCY)).default([]),
    familyValues: z.array(z.enum(C.FAMILY_VALUES)).default([]),
    childrenPreferences: z.array(z.enum(C.CHILDREN_PREFERENCES)).default([]),
    livingArrangements: z.array(z.enum(C.LIVING_ARRANGEMENTS)).default([]),
    personalityTraits: z.array(z.enum(C.PERSONALITY_TRAITS)).max(8).default([]),
    coreValues: z.array(z.enum(C.CORE_VALUES)).max(8).default([]),
    motherTongues: tags(10).default([]),
    religions: tags(10, 60).default([]),
    nonNegotiables: z.array(z.enum(C.NON_NEGOTIABLE_FIELDS)).default([]),
    freeText: optText(1000),
  })
  .refine((v) => v.ageMin <= v.ageMax, { message: 'Minimum age must not exceed maximum age', path: ['ageMin'] })
  .refine((v) => v.heightMinCm == null || v.heightMaxCm == null || v.heightMinCm <= v.heightMaxCm, {
    message: 'Minimum height must not exceed maximum height',
    path: ['heightMinCm'],
  });
export type PartnerPreferencesInput = z.infer<typeof partnerPreferencesSchema>;

export const privacySchema = z.object({
  visibility: z.enum(C.AUDIENCES),
  photoVisibility: z.enum(C.PHOTO_VISIBILITY),
  sensitiveFieldsVisibility: z.enum(C.AUDIENCES),
  nameVisibility: z.enum(C.NAME_VISIBILITY),
  messagingPolicy: z.enum(['connections', 'connections_verified']),
});
export type PrivacyInput = z.infer<typeof privacySchema>;

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------
export const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const uploadRequestSchema = z.object({
  kind: z.enum(['photo', 'video', 'verification', 'chat']),
  contentType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
  conversationId: uuid.optional(),
});
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;

export const confirmPhotoSchema = z.object({
  path: z.string().min(1).max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export const updatePhotoSchema = z.object({
  isPrimary: z.boolean().optional(),
  visibility: z.enum(['inherit', 'connections', 'hidden']).optional(),
  sortOrder: z.number().int().min(0).max(20).optional(),
});
export const confirmVideoSchema = z.object({
  path: z.string().min(1).max(300),
  durationSeconds: z.number().int().min(1).max(90),
  visibility: z.enum(C.AUDIENCES).default('members'),
});

// ---------------------------------------------------------------------------
// Discovery & search
// ---------------------------------------------------------------------------
export const searchFiltersSchema = z.object({
  ageMin: z.number().int().min(18).max(99).optional(),
  ageMax: z.number().int().min(18).max(99).optional(),
  heightMinCm: z.number().int().min(120).max(230).optional(),
  heightMaxCm: z.number().int().min(120).max(230).optional(),
  cities: z.array(z.string().max(80)).max(20).optional(),
  countries: z.array(z.string().length(2)).max(20).optional(),
  maritalStatuses: z.array(z.enum(C.MARITAL_STATUSES)).optional(),
  educationLevels: z.array(z.enum(C.EDUCATION_LEVELS)).optional(),
  professions: z.array(z.string().max(80)).max(10).optional(),
  minIncomeRange: z.enum(C.INCOME_RANGES).optional(),
  diets: z.array(z.enum(C.DIETS)).optional(),
  motherTongues: z.array(z.string().max(40)).max(10).optional(),
  religions: z.array(z.string().max(60)).max(10).optional(),
  familyValues: z.array(z.enum(C.FAMILY_VALUES)).optional(),
  childrenPreferences: z.array(z.enum(C.CHILDREN_PREFERENCES)).optional(),
  settlePreferences: z.array(z.enum(C.SETTLE_PREFERENCES)).optional(),
  relocation: z.array(z.enum(C.RELOCATION)).optional(),
  interests: z.array(z.string().max(40)).max(10).optional(),
  coreValues: z.array(z.enum(C.CORE_VALUES)).max(8).optional(),
  verifiedOnly: z.boolean().optional(),
  withPhotoOnly: z.boolean().optional(),
  /** Free text matched with full-text and (when configured) semantic search. */
  text: z.string().max(300).optional(),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

/** Filters that require the advanced_filters entitlement. */
export const ADVANCED_FILTER_KEYS: (keyof SearchFilters)[] = [
  'heightMinCm', 'heightMaxCm', 'professions', 'minIncomeRange', 'familyValues', 'childrenPreferences',
  'settlePreferences', 'relocation', 'coreValues', 'verifiedOnly', 'text',
];

export const searchRequestSchema = z.object({
  filters: searchFiltersSchema,
  sort: z.enum(['relevance', 'compatibility', 'newest', 'recently_active']).default('relevance'),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const smartSearchRequestSchema = z.object({ query: z.string().trim().min(3).max(500) });

export const recommendationActionSchema = z.object({ action: z.enum(['viewed', 'passed', 'shortlisted']) });
export const matchFeedbackSchema = z.object({
  candidateProfileId: uuid,
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  reason: z.enum(['not_my_preferences', 'great_fit', 'explanation_wrong', 'location', 'values', 'lifestyle', 'other']).optional(),
  comment: optText(500),
});

// ---------------------------------------------------------------------------
// Interests, connections, safety
// ---------------------------------------------------------------------------
export const sendInterestSchema = z.object({ receiverProfileId: uuid, message: optText(500) });
export const respondInterestSchema = z.object({ action: z.enum(['accept', 'decline', 'withdraw']) });
export const shortlistSchema = z.object({ targetProfileId: uuid, note: optText(500) });
export const blockSchema = z.object({ targetProfileId: uuid, reason: optText(300) });
export const reportSchema = z.object({
  targetProfileId: uuid.optional(),
  targetMessageId: uuid.optional(),
  targetPhotoId: uuid.optional(),
  reason: z.enum(C.REPORT_REASONS),
  details: optText(2000),
}).refine((v) => v.targetProfileId || v.targetMessageId || v.targetPhotoId, 'A report needs a target');
export const closeConnectionSchema = z.object({ reason: optText(300) });

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------
export const sendMessageSchema = z
  .object({
    clientId: z.string().min(8).max(64),
    kind: z.enum(['text', 'image']).default('text'),
    body: z.string().trim().max(4000).optional(),
    mediaPath: z.string().max(300).optional(),
  })
  .refine((v) => (v.kind === 'text' ? !!v.body && v.body.length > 0 : !!v.mediaPath), 'Message is empty');
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
export const matchmakerMessageSchema = z.object({
  threadId: uuid.optional(),
  message: z.string().trim().min(1).max(2000),
  locale: z.enum(C.APP_LOCALES).optional(),
});
export const readinessMessageSchema = z.object({
  topic: z.enum(C.READINESS_TOPICS),
  message: z.string().trim().min(1).max(2000),
});
export const readinessNoteSchema = z.object({
  topic: z.enum(C.READINESS_TOPICS),
  myView: optText(2000),
  questionsToAsk: z.array(z.string().trim().min(1).max(300)).max(15),
});
export const aiFeedbackSchema = z.object({
  feature: z.enum(C.AI_FEATURES),
  referenceId: z.string().max(100).optional(),
  rating: z.union([z.literal(-1), z.literal(1)]),
  comment: optText(1000),
});

export const visionItemSchema = z.object({
  category: z.enum(C.VISION_CATEGORIES),
  content: z.string().trim().min(1).max(500),
  isShared: z.boolean().default(false),
});
export const visionItemUpdateSchema = visionItemSchema.partial();
export const journalEntrySchema = z.object({
  kind: z.enum(C.JOURNAL_KINDS),
  content: z.string().trim().min(1).max(1000),
  resolved: z.boolean().optional(),
});
export const meetingPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  proposedAt: z.iso.datetime({ offset: true }),
  locationText: optText(200),
  notes: optText(500),
});
export const meetingPlanUpdateSchema = z.object({ status: z.enum(['accepted', 'declined', 'cancelled', 'completed']) });

// ---------------------------------------------------------------------------
// Family
// ---------------------------------------------------------------------------
export const familyInviteSchema = z.object({
  contact: z.string().trim().min(5).max(120),
  relation: z.enum(C.FAMILY_RELATIONS),
  displayName: optText(80),
  permissions: z.array(z.enum(C.FAMILY_PERMISSIONS)).min(1),
});
export const familyUpdateSchema = z.object({ permissions: z.array(z.enum(C.FAMILY_PERMISSIONS)).min(1) });
export const familyAcceptSchema = z.object({ token: z.string().min(20).max(200) });
export const familySuggestionSchema = z.object({ targetProfileId: uuid, note: optText(500) });
export const familySuggestionUpdateSchema = z.object({ status: z.enum(['considering', 'dismissed', 'acted']) });
export const familyDiscussionSchema = z.object({ targetProfileId: uuid, body: z.string().trim().min(1).max(2000) });

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
export const verificationSubmitSchema = z.object({
  kind: z.enum(['government_id', 'photo', 'employment', 'education']),
  documentType: z.string().max(40).optional(),
  documentPaths: z.array(z.string().max(300)).min(1).max(4),
  /** Only non-sensitive metadata (e.g. last 4 digits, employer name). Never full ID numbers. */
  submittedData: z.record(z.string(), z.string().max(200)).default({}),
});
export type VerificationSubmitInput = z.infer<typeof verificationSubmitSchema>;

// ---------------------------------------------------------------------------
// Settings, privacy operations
// ---------------------------------------------------------------------------
export const notificationPreferencesSchema = z.object({
  preferences: z
    .array(z.object({ category: z.enum(C.NOTIFICATION_CATEGORIES), channel: z.enum(C.NOTIFICATION_CHANNELS), enabled: z.boolean() }))
    .max(C.NOTIFICATION_CATEGORIES.length * C.NOTIFICATION_CHANNELS.length),
});
export const consentUpdateSchema = z.object({ consentType: z.enum(C.CONSENT_TYPES), granted: z.boolean() });
export const registerDeviceSchema = z.object({
  platform: z.enum(['web', 'ios', 'android']),
  deviceName: optText(120),
  pushToken: optText(300),
  pushProvider: z.enum(['expo', 'fcm', 'apns', 'webpush']).nullish(),
  appVersion: optText(40),
});
export const accountUpdateSchema = z.object({
  fullName: optText(120),
  preferredLocale: z.enum(C.APP_LOCALES).optional(),
});
export const deleteAccountSchema = z.object({ confirm: z.literal('DELETE'), reason: optText(500) });
export const supportTicketSchema = z.object({
  category: z.enum(['account', 'billing', 'verification', 'safety', 'technical', 'feedback', 'other']),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(5000),
});
export const supportReplySchema = z.object({ body: z.string().trim().min(1).max(5000) });

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
export const checkoutSchema = z.object({
  planCode: z.enum(C.PLAN_CODES).exclude(['free']),
  interval: z.enum(C.BILLING_INTERVALS),
  couponCode: z.string().trim().max(40).optional(),
  billingState: z.string().trim().max(10).optional(),
  gstin: z.string().trim().regex(/^[0-9]{2}[A-Z0-9]{13}$/, 'Invalid GSTIN').optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(5).max(100),
  razorpayPaymentId: z.string().min(5).max(100),
  razorpaySignature: z.string().min(10).max(200),
});
export const couponPreviewSchema = z.object({
  planCode: z.enum(C.PLAN_CODES),
  interval: z.enum(C.BILLING_INTERVALS),
  couponCode: z.string().trim().min(1).max(40),
});

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------
export const pageQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
