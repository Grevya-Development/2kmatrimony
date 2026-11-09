/** Design tokens mirrored from apps/web/src/app/globals.css. */
export const colors = {
  canvas: '#faf7f2',
  surface: '#fffdf9',
  surface2: '#f4efe7',
  ink: '#1f1d1b',
  ink2: '#4a4540',
  muted: '#77706a',
  line: '#e8e1d6',
  lineStrong: '#d8cfc1',
  burgundy50: '#f8eef0',
  burgundy100: '#f0dbe0',
  burgundy500: '#8e3a4a',
  burgundy600: '#7a2e3c',
  burgundy700: '#652532',
  champagne50: '#fbf6ec',
  champagne100: '#f4ead6',
  champagne200: '#e9d8b6',
  champagne600: '#a8875a',
  success: '#3f6b4f',
  successBg: '#eaf2ec',
  warning: '#8a6420',
  warningBg: '#f8efdc',
  danger: '#9b2c2c',
  dangerBg: '#f8e7e5',
  info: '#3b5a7a',
  infoBg: '#e8eef5',
  white: '#ffffff',
} as const;

export const fonts = {
  display: 'CormorantGaramond_500Medium',
  displayStrong: 'CormorantGaramond_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const shadow = {
  soft: { shadowColor: '#1f1d1b', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  lift: { shadowColor: '#1f1d1b', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  heading: { fontFamily: fonts.displayStrong, fontSize: 22, lineHeight: 26, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  bodyMuted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.ink2 },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.muted },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' as const, color: colors.champagne600 },
} as const;
