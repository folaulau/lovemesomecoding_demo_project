import SwiftUI

/// Brand tokens — the SwiftUI half of `pizza-react-frontend/src/styles/_tokens.scss`.
///
/// The web apps publish these as CSS custom properties so Bootstrap can read them. React Native
/// re-states them as plain constants because it has no cascade. SwiftUI is a third answer again:
/// it *does* have an inheritance-like mechanism (`Environment`), but for a fixed brand palette
/// that indirection buys nothing, so these stay `static let`s on a caseless enum.
///
/// `enum` rather than `struct` is deliberate: an enum with no cases cannot be instantiated, which
/// is exactly right for a namespace. A `struct` would silently allow `Palette()`.
enum Palette {
    // The palette. `red` and `black` are lifted straight from the web tokens so the apps match.
    static let red = Color(hex: 0xD8102A)
    /// `color.adjust($pizza-red, $lightness: -10%)` in Sass, precomputed — as in the RN app.
    static let redDark = Color(hex: 0xAB0D21)
    static let redSoft = Color(hex: 0xFDEAEC)
    static let black = Color(hex: 0x231F20)
    static let cream = Color(hex: 0xFFF8F0)
    static let white = Color(hex: 0xFFFFFF)

    // Greys, from the web theme's --viz-* and Bootstrap's muted text.
    static let grey900 = Color(hex: 0x231F20)
    static let grey700 = Color(hex: 0x4A4746)
    static let grey600 = Color(hex: 0x6C6A68)
    static let grey400 = Color(hex: 0xA9A5A1)
    static let grey300 = Color(hex: 0xD5D1CD)
    static let grey200 = Color(hex: 0xECEAE7)
    static let grey100 = Color(hex: 0xF5F3F0)

    // Status colours, matching the Bootstrap variants the web app uses for order badges.
    static let success = Color(hex: 0x1A7F4B)
    static let successSoft = Color(hex: 0xE4F4EB)
    static let warning = Color(hex: 0xB26A00)
    static let warningSoft = Color(hex: 0xFDF1DE)
    static let info = Color(hex: 0x0B6C8C)
    static let infoSoft = Color(hex: 0xE2F2F7)
    static let danger = Color(hex: 0xD8102A)
    static let dangerSoft = Color(hex: 0xFDEAEC)
}

/// A 4-point spacing scale.
///
/// SwiftUI's unit is the point, the same density-independent unit React Native calls a "dp", so
/// these numbers are identical to `theme/tokens.ts`. Naming the steps stops `padding(13)` appearing
/// next to `padding(12)` and quietly breaking the rhythm.
enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let xxxl: CGFloat = 48
}

/// `$card-radius: 0.75rem` is 12pt at the default 16px root size.
enum Radius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 12
    static let lg: CGFloat = 20
    /// SwiftUI has no `borderRadius: 999`; `Capsule()` is the shape that means "fully rounded".
    static let pill: CGFloat = 999
}

enum FontSize {
    static let xs: CGFloat = 11
    static let sm: CGFloat = 13
    static let base: CGFloat = 15
    static let md: CGFloat = 17
    static let lg: CGFloat = 20
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let display: CGFloat = 40
}

/// Elevation.
///
/// This is where SwiftUI is simplest of the three. React Native has to set `shadow*` for iOS AND
/// `elevation` for Android or the cards are flat on one platform; the web sets a `box-shadow`
/// string. Here there is one `.shadow(color:radius:x:y:)` and no platform split at all — so the
/// tokens are just the arguments to it.
enum Elevation {
    struct Shadow {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }

    /// SwiftUI's `radius` is a Gaussian blur radius while CSS/RN's `shadowRadius` is roughly a
    /// diameter, so the web's 8 becomes 4 here to look the same rather than twice as soft.
    static let card = Shadow(color: Palette.black.opacity(0.08), radius: 4, x: 0, y: 2)
    static let raised = Shadow(color: Palette.black.opacity(0.12), radius: 6, x: 0, y: -2)
}

extension Color {
    /// `Color(hex: 0xD8102A)` — the tokens above are written the way a designer hands them over.
    ///
    /// SwiftUI ships no hex initialiser, and the usual workaround parses a `String` at runtime.
    /// Taking an integer literal instead means a typo is a compile error rather than a colour that
    /// silently falls back to black.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}
