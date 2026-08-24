import { palette, radius, spacing, fontSize, fontWeight, shadow } from './tokens';

/**
 * The semantic layer over the raw tokens.
 *
 * <p>Components should reach for `theme.colors.textMuted`, not `palette.grey600`. The indirection
 * is what makes a retune possible: change what "muted text" means here and every screen follows,
 * whereas a grep-and-replace of `grey600` would also hit the borders that merely happen to share
 * the value.
 *
 * <p>This is the same job `theme.scss` does on the web by mapping the palette onto Bootstrap's
 * `--bs-*` variables.
 */
export const theme = {
  colors: {
    /** Brand */
    primary: palette.red,
    primaryDark: palette.redDark,
    primarySoft: palette.redSoft,
    onPrimary: palette.white,

    /** Surfaces */
    background: palette.cream,
    surface: palette.white,
    surfaceAlt: palette.grey100,
    /** The navbar and footer are near-black on the web app; the header here matches. */
    surfaceInverse: palette.black,
    onSurfaceInverse: palette.white,

    /** Text */
    text: palette.grey900,
    textMuted: palette.grey600,
    textSubtle: palette.grey400,
    onPrimaryMuted: '#ffb3bd',

    /** Lines */
    border: palette.grey300,
    borderSubtle: palette.grey200,

    /** Status */
    success: palette.success,
    successSoft: palette.successSoft,
    warning: palette.warning,
    warningSoft: palette.warningSoft,
    info: palette.info,
    infoSoft: palette.infoSoft,
    danger: palette.danger,
    dangerSoft: palette.dangerSoft,
  },
  spacing,
  radius,
  fontSize,
  fontWeight,
  shadow,
} as const;

export type Theme = typeof theme;
