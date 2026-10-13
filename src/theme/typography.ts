import { TextStyle } from 'react-native';

export const typography = {
  // Brand / Mark
  brandLogo: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  } as TextStyle,

  // Technical Heading 1
  h1: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as TextStyle,

  // Heading 2
  h2: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.25,
  } as TextStyle,

  // Station Title
  stationTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  } as TextStyle,

  // Technical Metadata / Frequency
  monoDisplay: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } as TextStyle,

  // Body Regular
  body: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 20,
  } as TextStyle,

  // Body Subtle / Secondary
  bodySubtle: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 18,
  } as TextStyle,

  // Technical Micro Labels (Coordinates, Bitrates, Status)
  labelMicro: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  } as TextStyle,

  // Genre Pill
  badge: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;
