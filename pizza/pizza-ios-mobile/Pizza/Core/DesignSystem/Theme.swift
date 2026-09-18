import SwiftUI

/// The semantic layer over the raw tokens.
///
/// Views should reach for `Theme.colors.textMuted`, not `Palette.grey600`. The indirection is what
/// makes a retune possible: change what "muted text" means here and every screen follows, whereas a
/// find-and-replace of `grey600` would also hit the borders that merely happen to share the value.
///
/// This is the same job `theme.scss` does on the web by mapping the palette onto Bootstrap's
/// `--bs-*` variables, and `theme/theme.ts` does in the React Native app.
enum Theme {
    enum colors {
        // Brand
        static let primary = Palette.red
        static let primaryDark = Palette.redDark
        static let primarySoft = Palette.redSoft
        static let onPrimary = Palette.white

        // Surfaces
        static let background = Palette.cream
        static let surface = Palette.white
        static let surfaceAlt = Palette.grey100
        /// The navbar and footer are near-black on the web app; the nav bar here matches.
        static let surfaceInverse = Palette.black
        static let onSurfaceInverse = Palette.white

        // Text
        static let text = Palette.grey900
        static let textMuted = Palette.grey600
        static let textSubtle = Palette.grey400
        static let onPrimaryMuted = Color(hex: 0xFFB3BD)

        // Lines
        static let border = Palette.grey300
        static let borderSubtle = Palette.grey200

        // Status
        static let success = Palette.success
        static let successSoft = Palette.successSoft
        static let warning = Palette.warning
        static let warningSoft = Palette.warningSoft
        static let info = Palette.info
        static let infoSoft = Palette.infoSoft
        static let danger = Palette.danger
        static let dangerSoft = Palette.dangerSoft
    }
}

extension View {
    /// The card shadow, applied from one place so it cannot drift between surfaces.
    func cardShadow() -> some View {
        shadow(
            color: Elevation.card.color,
            radius: Elevation.card.radius,
            x: Elevation.card.x,
            y: Elevation.card.y
        )
    }
}
