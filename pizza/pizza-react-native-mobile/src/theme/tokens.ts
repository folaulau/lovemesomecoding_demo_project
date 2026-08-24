/**
 * Brand tokens — the native half of `pizza-react-frontend/src/styles/_tokens.scss`.
 *
 * <p>The web apps publish these as CSS custom properties so Bootstrap can read them. React Native
 * has no cascade and no `var()`: a style is a plain JavaScript object, resolved once, by the code
 * that uses it. So the tokens are exported as plain constants and every component imports what it
 * needs. Nothing is "inherited" — that is the single biggest difference from styling on the web,
 * and it is why this file is imported so widely.
 *
 * <p>`as const` matters. Without it TypeScript widens `'#d8102a'` to `string`, and the palette
 * stops being a closed set that autocomplete and exhaustiveness checks can work with.
 */

/** The palette. `red` and `black` are lifted straight from the web tokens so the apps match. */
export const palette = {
  red: '#d8102a',
  /** `color.adjust($pizza-red, $lightness: -10%)` in Sass, precomputed — JS cannot do colour maths. */
  redDark: '#ab0d21',
  redSoft: '#fdeaec',
  black: '#231f20',
  cream: '#fff8f0',
  white: '#ffffff',

  /* Greys, from the web theme's --viz-* and Bootstrap's muted text. */
  grey900: '#231f20',
  grey700: '#4a4746',
  grey600: '#6c6a68',
  grey400: '#a9a5a1',
  grey300: '#d5d1cd',
  grey200: '#eceae7',
  grey100: '#f5f3f0',

  /* Status colours, matching the Bootstrap variants the web app uses for order badges. */
  success: '#1a7f4b',
  successSoft: '#e4f4eb',
  warning: '#b26a00',
  warningSoft: '#fdf1de',
  info: '#0b6c8c',
  infoSoft: '#e2f2f7',
  danger: '#d8102a',
  dangerSoft: '#fdeaec',
} as const;

/**
 * A 4-point spacing scale.
 *
 * <p>React Native's unit is the density-independent pixel, so these are unitless numbers rather
 * than rems. Naming the steps stops `padding: 13` appearing next to `padding: 12` and quietly
 * breaking the rhythm.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** `$card-radius: 0.75rem` is 12dp at the default 16px root size. */
export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  display: 40,
} as const;

/**
 * Font weights as the strings React Native expects.
 *
 * <p>Numeric weights are accepted on both platforms now, but they must be STRINGS —
 * `fontWeight: 700` is a type error while `fontWeight: '700'` is not.
 */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

/**
 * Elevation, which is genuinely platform-split.
 *
 * <p>iOS draws shadows from `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`; Android
 * ignores all four and reads `elevation`. Setting both is the only way to get a shadow on both,
 * and forgetting the Android half is the classic "my cards are flat on Android" bug.
 */
export const shadow = {
  card: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
