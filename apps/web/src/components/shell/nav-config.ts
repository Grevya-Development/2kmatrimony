import type { AdminPermission } from '@2k/shared';

/**
 * Central navigation config. Each feature owns its page under these routes.
 * `flag` hides an item when the feature flag is off.
 */
export interface NavItem { href: string; label: string; icon: string; flag?: string }

export const MEMBER_PRIMARY_NAV: NavItem[] = [
  { href: '/app', label: 'For you', icon: 'sparkles' },
  { href: '/app/discover', label: 'Discover', icon: 'compass' },
  { href: '/app/matchmaker', label: 'Matchmaker', icon: 'message-circle-heart', flag: 'ai_matchmaker' },
  { href: '/app/interests', label: 'Interests', icon: 'heart' },
  { href: '/app/messages', label: 'Messages', icon: 'messages-square' },
];

export const MEMBER_MENU_NAV: NavItem[] = [
  { href: '/app/profile', label: 'My profile', icon: 'user' },
  { href: '/app/dna', label: 'Relationship DNA', icon: 'dna' },
  { href: '/app/connections', label: 'Connections', icon: 'users' },
  { href: '/app/shortlist', label: 'Shortlist', icon: 'bookmark' },
  { href: '/app/readiness', label: 'Readiness assistant', icon: 'compass', flag: 'readiness_assistant' },
  { href: '/app/family', label: 'Family', icon: 'home', flag: 'family_mode' },
  { href: '/app/verification', label: 'Verification', icon: 'shield-check' },
  { href: '/app/billing', label: 'Plans & billing', icon: 'gem' },
  { href: '/app/settings', label: 'Settings & privacy', icon: 'settings' },
  { href: '/app/support', label: 'Help & support', icon: 'life-buoy' },
];

export interface AdminNavItem { href: string; label: string; icon: string; permission?: AdminPermission; superOnly?: boolean }

export const ADMIN_NAV: { section: string; items: AdminNavItem[] }[] = [
  { section: 'Operate', items: [
    { href: '/admin', label: 'Overview', icon: 'layout-dashboard' },
    { href: '/admin/users', label: 'Users', icon: 'users', permission: 'users.read' },
    { href: '/admin/profiles', label: 'Profiles', icon: 'id-card', permission: 'profiles.read' },
    { href: '/admin/verification', label: 'Verification', icon: 'shield-check', permission: 'verification.review' },
    { href: '/admin/moderation', label: 'Moderation', icon: 'flag', permission: 'reports.manage' },
    { href: '/admin/support', label: 'Support', icon: 'life-buoy', permission: 'support.read' },
  ] },
  { section: 'Intelligence', items: [
    { href: '/admin/matching', label: 'Matchmaking', icon: 'git-compare', permission: 'matching.read' },
    { href: '/admin/ai', label: 'AI operations', icon: 'cpu', permission: 'ai.read' },
    { href: '/admin/analytics', label: 'Analytics', icon: 'chart-line', permission: 'analytics.read' },
  ] },
  { section: 'Revenue', items: [
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: 'gem', permission: 'subscriptions.read' },
    { href: '/admin/payments', label: 'Payments', icon: 'receipt-indian-rupee', permission: 'payments.read' },
  ] },
  { section: 'Content', items: [
    { href: '/admin/content', label: 'Content', icon: 'file-text', permission: 'cms.manage' },
    { href: '/admin/notifications', label: 'Notifications', icon: 'bell', permission: 'notifications.manage' },
  ] },
  { section: 'Platform', items: [
    { href: '/admin/config', label: 'Configuration', icon: 'sliders-horizontal', permission: 'settings.manage' },
    { href: '/admin/audit', label: 'Audit logs', icon: 'scroll-text', permission: 'audit.read' },
    { href: '/admin/super', label: 'Super admin', icon: 'crown', superOnly: true },
  ] },
];
