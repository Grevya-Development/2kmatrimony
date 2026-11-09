/** Design tokens mirrored from apps/web/src/app/globals.css. */
export const colors = {
  // Brand DNA — Emerald Edition (see 2K_Matrimony_Brand_DNA_Emerald/09_Colour_Tokens)
  canvas: '#fefaf4', // Ivory
  surface: '#ffffff',
  surface2: '#f7f1e6',
  ink: '#062f2e', // Emerald Ink
  ink2: '#2c4a48',
  muted: '#5f6f6c',
  line: '#e7dfd0',
  lineStrong: '#d4c8b3',
  emerald50: '#ebf3f2',
  emerald100: '#d3e5e3',
  emerald500: '#205b5b', // Emerald Glow
  emerald600: '#033b39', // Royal Emerald (primary)
  emerald700: '#062f2e',
  emerald800: '#012929', // Emerald Depth
  gold50: '#fbf6ea',
  gold100: '#f6eacd',
  gold200: '#ecd5a2',
  gold400: '#cc9c44', // Heritage Gold
  gold600: '#946719', // gold text on ivory
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
  display: 'Newsreader_500Medium',
  displayStrong: 'Newsreader_600SemiBold',
  body: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const shadow = {
  soft: { shadowColor: '#062f2e', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  lift: { shadowColor: '#062f2e', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  heading: { fontFamily: fonts.displayStrong, fontSize: 22, lineHeight: 26, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  bodyMuted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.ink2 },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.muted },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' as const, color: colors.gold600 },
} as const;
