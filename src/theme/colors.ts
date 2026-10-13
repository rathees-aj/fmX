/**
 * fmX Design System — Strictly Monochrome Palette
 * Exclusively:
 * Pure black: #000000
 * Near black: #090909
 * Charcoal: #171717
 * Graphite: #292929
 * Mid gray: #525252
 * Silver: #A3A3A3
 * Light silver: #D4D4D4
 * White: #FFFFFF
 */

export const colors = {
  // Primary Palette
  pureBlack: '#000000',
  nearBlack: '#090909',
  charcoal: '#171717',
  graphite: '#292929',
  midGray: '#525252',
  steelGray: '#525252',
  silver: '#A3A3A3',
  lightSilver: '#D4D4D4',
  offWhite: '#E5E5E5',
  white: '#FFFFFF',

  // Semantic Aliases
  void: '#000000',
  background: '#000000',
  surface: '#171717',
  surfaceDark: '#090909',
  surfaceElevated: '#171717',
  surfaceCard: '#171717',
  
  // Borders & Dividers
  borderSubtle: '#292929',
  borderMedium: '#525252',
  borderStrong: '#A3A3A3',
  
  // Typography & Icons
  textPrimary: '#FFFFFF',
  textSecondary: '#D4D4D4',
  textMuted: '#A3A3A3',
  textSubtle: '#525252',

  // Status Indicators
  signalLive: '#FFFFFF',
  signalBuffering: '#A3A3A3',
  signalOffline: '#292929',
  signalError: '#D4D4D4',

  // Legacy mappings for backwards-compatibility
  pureWhite: '#FFFFFF',
  deepCharcoal: '#090909',
  silverMuted: '#A3A3A3',
  silverBright: '#D4D4D4',
} as const;

export type ColorToken = keyof typeof colors;
