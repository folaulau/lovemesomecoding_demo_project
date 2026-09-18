import SwiftUI

/// Typography, as a closed set.
///
/// ## Why this is a modifier and not a `PizzaText` view
///
/// React Native has to wrap `<Text>` because nothing inherits there — a font size on a parent
/// reaches no child. SwiftUI *does* inherit: `.font()` and `.foregroundStyle()` applied to a `VStack`
/// reach every `Text` inside it. So the native shape of this idea is a **modifier**, not a wrapper
/// view, and expressing it that way means it composes with everything — a `Label`, a `TextField`, a
/// whole stack — rather than only with text the wrapper happens to render.
///
/// Naming the variants is the native equivalent of Bootstrap's `.h5`, `.small` and `.text-muted`,
/// and it means a typographic change happens in one file rather than in ninety call sites.
enum TextStyle {
    case display
    case title
    case heading
    case subheading
    case body
    case bodyStrong
    /// Small, uppercase section headers — the web app's `.text-uppercase.text-muted.h6`.
    case label
    case caption
    case mono

    var font: Font {
        switch self {
        case .display: .system(size: FontSize.display, weight: .heavy)
        case .title: .system(size: FontSize.xxl, weight: .heavy)
        case .heading: .system(size: FontSize.lg, weight: .bold)
        case .subheading: .system(size: FontSize.md, weight: .semibold)
        case .body: .system(size: FontSize.base, weight: .regular)
        case .bodyStrong: .system(size: FontSize.base, weight: .semibold)
        case .label: .system(size: FontSize.xs, weight: .bold)
        case .caption: .system(size: FontSize.sm, weight: .regular)
        case .mono: .system(size: FontSize.sm, weight: .regular, design: .monospaced)
        }
    }

    /// Negative tracking on the big sizes only. Display type set at its default spacing looks loose;
    /// body text with the same treatment becomes hard to read.
    var tracking: CGFloat {
        switch self {
        case .display: -1
        case .title: -0.5
        case .label: 0.8
        default: 0
        }
    }

    var isUppercased: Bool { self == .label }
}

enum TextTone {
    case standard
    case muted
    case subtle
    case primary
    case inverse
    case danger
    case success

    var color: Color {
        switch self {
        case .standard: Theme.colors.text
        case .muted: Theme.colors.textMuted
        case .subtle: Theme.colors.textSubtle
        case .primary: Theme.colors.primary
        case .inverse: Theme.colors.onSurfaceInverse
        case .danger: Theme.colors.danger
        case .success: Theme.colors.success
        }
    }
}

private struct TextStyleModifier: ViewModifier {
    let style: TextStyle
    let tone: TextTone

    func body(content: Content) -> some View {
        content
            .font(style.font)
            .tracking(style.tracking)
            .foregroundStyle(tone.color)
            /*
             * `.textCase` is the SwiftUI equivalent of CSS `text-transform` — and, unlike
             * uppercasing the string itself, it leaves the underlying value alone. That matters for
             * accessibility: VoiceOver reads the real text rather than spelling out an acronym it
             * thinks it has found.
             */
            .textCase(style.isUppercased ? .uppercase : nil)
    }
}

extension View {
    func textStyle(_ style: TextStyle, tone: TextTone = .standard) -> some View {
        modifier(TextStyleModifier(style: style, tone: tone))
    }
}
