/**
 * API response contracts shared by web and mobile clients.
 * All endpoints live under /api/v1 and return JSON:
 *   success -> { data: T }    (plus optional `nextCursor` for lists)
 *   failure -> { error: ApiErrorBody } with an HTTP status code
 */
import type * as C from './constants';
import type { SearchFilters } from './schemas';

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'conflict'
  | 'rate_limited'
  | 'entitlement_required'
  | 'feature_disabled'
  | 'service_unconfigured'
  | 'profile_incomplete'
  | 'account_suspended'
  | 'internal_error';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}
export interface ApiSuccess<T> {
  data: T;
  nextCursor?: string | null;
}
export interface ApiFailure {
  error: ApiErrorBody;
}

// ---------------------------------------------------------------------------
// Session / me
// ---------------------------------------------------------------------------
export interface Entitlements {
  interests_per_day: number;
  daily_recommendations: number;
  advanced_filters: boolean;
  ai_insights: 'none' | 'basic' | 'full';
  ai_matchmaker_messages_per_day: number;
  smart_search_per_day: number;
  see_who_viewed: boolean;
  gap_analysis: boolean;
  before_you_meet: boolean;
  curated_introductions: boolean;
  human_matchmaker: boolean;
  priority_support: boolean;
}

export interface MeResponse {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string | null;
    preferredLocale: C.AppLocale;
    status: 'active' | 'suspended' | 'pending_deletion' | 'deleted';
    onboardingCompletedAt: string | null;
  };
  profile: {
    id: string;
    profileCode: string;
    status: C.ProfileStatus;
    firstName: string | null;
    createdFor: C.CreatedFor;
    completionPct: number;
    onboardingStep: string | null;
    primaryPhotoUrl: string | null;
  } | null;
  plan: { code: C.PlanCode; name: string; currentPeriodEnd: string | null; entitlements: Entitlements };
  admin: { role: string; permissions: string[]; mfaRequired: boolean } | null;
  familyOf: { profileId: string; ownerName: string; permissions: C.FamilyPermission[] }[];
  unreadNotifications: number;
  consentsRequired: C.ConsentType[];
  featureFlags: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Profiles (privacy-projected views of other members)
// ---------------------------------------------------------------------------
export interface CompatibilitySummary {
  mutual: number;
  label: string; // e.g. "Strong alignment" — never a promise of outcomes
  confidence: number;
}

export type RelationshipState = {
  interest: { id: string; direction: 'sent' | 'received'; status: C.InterestStatus } | null;
  connectionId: string | null;
  conversationId: string | null;
  shortlisted: boolean;
  passed: boolean;
};

export interface ProfileCard {
  id: string;
  profileCode: string;
  displayName: string;
  age: number | null;
  city: string | null;
  country: string | null;
  education: string | null;
  profession: string | null;
  intro: string | null;
  photoUrl: string | null;
  photoBlurred: boolean;
  verified: { identity: boolean; photo: boolean; phone: boolean };
  compatibility: CompatibilitySummary | null;
  sharedInterests: string[];
  recentlyActive: boolean;
  relationship: RelationshipState;
}

export interface ProfileDetail extends ProfileCard {
  basics: {
    heightCm: number | null;
    maritalStatus: C.MaritalStatus | null;
    motherTongue: string | null;
    languages: string[];
    nativePlace: string | null;
    religion: string | null;
    community: string | null;
    about: string | null;
    personalityTraits: string[];
    coreValues: string[];
  };
  educationHistory: { level: C.EducationLevel; qualification: string; institution: string | null; specialization: string | null }[];
  career: {
    profession: string | null;
    employmentType: C.EmploymentType | null;
    company: string | null;
    designation: string | null;
    incomeRange: C.IncomeRange | null; // null when hidden by privacy settings
    workCity: string | null;
    relocationWillingness: C.Relocation | null;
  } | null;
  family: {
    familyStructure: C.FamilyStructure | null;
    familyValues: C.FamilyValues | null;
    familyBackground: string | null;
    fatherOccupation: string | null;
    motherOccupation: string | null;
    brothers: number | null;
    sisters: number | null;
  } | null;
  lifestyle: {
    diet: C.Diet | null;
    smoking: C.HabitFrequency | null;
    drinking: C.HabitFrequency | null;
    fitness: C.Fitness | null;
    travel: C.Travel | null;
    hobbies: string[];
    interests: string[];
  } | null;
  values: {
    childrenPreference: C.ChildrenPreference | null;
    livingArrangement: C.LivingArrangement | null;
    settlePreference: C.SettlePreference | null;
    relationshipExpectations: string | null;
    futureGoals: string | null;
  } | null;
  photos: { id: string; url: string; blurred: boolean }[];
  video: { url: string; durationSeconds: number } | null;
  hiddenSections: string[]; // sections withheld by the member's privacy settings
  isOwnProfile: boolean;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------
export interface DimensionInsight {
  key: C.ScoreDimension;
  label: string;
  score: number | null; // mutual 0-100; null = not enough information
  forViewer: number | null; // how well the candidate fits the viewer's preferences
  forCandidate: number | null; // how well the viewer fits the candidate's preferences
  note: string;
}

export interface MatchExplanation {
  candidateProfileId: string;
  compatibility: CompatibilitySummary & { forViewer: number; forCandidate: number };
  headline: string;
  dimensions: DimensionInsight[];
  alignments: string[];
  differences: string[];
  sharedInterests: string[];
  mutualPreferenceNotes: string[];
  missingInformation: string[];
  conversationStarters: string[];
  generator: 'engine' | 'ai';
  disclaimer: string;
  computedAt: string;
}

export interface RecommendationItem {
  id: string;
  source: 'engine' | 'ai_curated' | 'matchmaker' | 'family';
  reason: string | null;
  status: 'new' | 'viewed' | 'shortlisted' | 'passed' | 'interested';
  profile: ProfileCard;
}

export interface SmartSearchInterpretation {
  filters: SearchFilters;
  summary: string;
  /** Preferences that could not be mapped to a filter and are used for ranking only. */
  softPreferences: string[];
  clarifyingQuestions: string[];
  generator: 'ai' | 'rules';
}

// ---------------------------------------------------------------------------
// Interests, connections, messaging
// ---------------------------------------------------------------------------
export interface InterestItem {
  id: string;
  direction: 'sent' | 'received';
  status: C.InterestStatus;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string;
  profile: ProfileCard;
}

export interface ConnectionItem {
  id: string;
  status: 'active' | 'closed';
  createdAt: string;
  conversationId: string | null;
  profile: ProfileCard;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

export interface ConversationItem {
  id: string;
  connectionId: string;
  isLocked: boolean;
  other: ProfileCard;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  muted: boolean;
  archived: boolean;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderProfileId: string | null;
  kind: 'text' | 'image' | 'system';
  body: string | null;
  mediaUrl: string | null;
  clientId: string | null;
  createdAt: string;
  isMine: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Connection insights
// ---------------------------------------------------------------------------
export interface GapAnalysis {
  alignments: { topic: string; detail: string }[];
  differences: { topic: string; detail: string; possibleCompromises: string[] }[];
  unansweredQuestions: string[];
  suggestedConversations: string[];
  note: string;
}

export interface BeforeYouMeetBriefing {
  sharedInterests: string[];
  sharedValues: string[];
  compatibilityAreas: { area: string; detail: string }[];
  potentialDifferences: { area: string; detail: string }[];
  conversationStarters: string[];
  questionsToDiscuss: string[];
  firstMeetingIdeas: { idea: string; why: string }[];
  note: string;
}

export interface InsightEnvelope<T> {
  id: string;
  kind: 'gap_analysis' | 'before_you_meet' | 'vision_themes';
  content: T;
  generator: 'engine' | 'ai';
  createdAt: string;
}

export interface VisionThemes {
  commonThemes: string[];
  unansweredQuestions: string[];
  note: string;
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
export interface PlanPrice {
  id: string;
  interval: C.BillingInterval;
  amountPaise: number;
  currency: string;
  monthlyEquivalentPaise: number;
}
export interface PlanItem {
  id: string;
  code: C.PlanCode;
  name: string;
  tagline: string | null;
  description: string | null;
  prices: PlanPrice[];
  entitlements: Entitlements;
}
export interface CheckoutOrder {
  paymentId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountPaise: number;
  currency: string;
  listAmountPaise: number;
  discountPaise: number;
  gstPaise: number;
  planName: string;
  prefill: { name: string | null; email: string | null; contact: string | null };
}
