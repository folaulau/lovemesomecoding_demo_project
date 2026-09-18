import SwiftUI

/// The app's button, as a `ButtonStyle`.
///
/// ## Why a `ButtonStyle` and not a custom view
///
/// A `PizzaButton` view would have to re-implement everything `Button` already does: the tap
/// gesture, the press-and-drag-away cancellation, the accessibility trait, the Dynamic Type
/// response, keyboard activation, and the `.disabled()` environment. A `ButtonStyle` restyles the
/// real thing instead and inherits all of it.
///
/// `configuration.isPressed` is the native answer to CSS `:active`, and it arrives for free — the
/// React Native version needs `Pressable`'s `style` callback to get the same effect.
struct PizzaButtonStyle: ButtonStyle {
    enum Variant {
        case primary
        case outline
        case ghost
        case danger

        var background: Color {
            switch self {
            case .primary: Theme.colors.primary
            case .outline, .ghost: .clear
            case .danger: Theme.colors.danger
            }
        }

        var pressedBackground: Color {
            switch self {
            case .primary, .danger: Theme.colors.primaryDark
            case .outline: Theme.colors.primarySoft
            case .ghost: Theme.colors.surfaceAlt
            }
        }

        var border: Color {
            switch self {
            case .primary: Theme.colors.primary
            case .outline: Theme.colors.primary
            case .ghost: .clear
            case .danger: Theme.colors.danger
            }
        }

        var foreground: Color {
            switch self {
            case .primary, .danger: Theme.colors.onPrimary
            case .outline, .ghost: Theme.colors.primary
            }
        }
    }

    enum Size {
        case small
        case medium
        case large

        var verticalPadding: CGFloat {
            switch self {
            case .small: Spacing.xs + 2
            case .medium: Spacing.md - 2
            case .large: Spacing.lg - 2
            }
        }

        var horizontalPadding: CGFloat {
            switch self {
            case .small: Spacing.md
            case .medium: Spacing.lg
            case .large: Spacing.xl
            }
        }

        var textStyle: TextStyle {
            self == .small ? .caption : .bodyStrong
        }
    }

    var variant: Variant = .primary
    var size: Size = .medium
    var isFullWidth = false

    /// Read from the environment rather than passed in, so `.disabled(true)` on the `Button` — or on
    /// any ancestor — is what dims it. A separate `isDisabled` property would let the two disagree.
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .textStyle(size.textStyle)
            .foregroundStyle(variant.foreground)
            .padding(.vertical, size.verticalPadding)
            .padding(.horizontal, size.horizontalPadding)
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            /*
             * Apple's Human Interface Guidelines ask for a 44pt minimum touch target. A small
             * button is visually shorter than that, and this is how the *tappable* area is kept
             * honest without padding the design out of shape.
             */
            .frame(minHeight: 44)
            .background(
                RoundedRectangle(cornerRadius: Radius.md)
                    .fill(configuration.isPressed ? variant.pressedBackground : variant.background)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(variant.border, lineWidth: 1.5)
            )
            .opacity(isEnabled ? 1 : 0.45)
            .contentShape(Rectangle())
    }
}

extension ButtonStyle where Self == PizzaButtonStyle {
    static var pizzaPrimary: PizzaButtonStyle { PizzaButtonStyle(variant: .primary) }
    static var pizzaOutline: PizzaButtonStyle { PizzaButtonStyle(variant: .outline) }
    static var pizzaGhost: PizzaButtonStyle { PizzaButtonStyle(variant: .ghost) }

    static func pizza(
        _ variant: PizzaButtonStyle.Variant = .primary,
        size: PizzaButtonStyle.Size = .medium,
        fullWidth: Bool = false
    ) -> PizzaButtonStyle {
        PizzaButtonStyle(variant: variant, size: size, isFullWidth: fullWidth)
    }
}

/// A button that swaps its label for a spinner while work is in flight.
///
/// Disabling is part of the same component on purpose: a "Pay now" button that shows a spinner but
/// still accepts taps is how a customer ends up with two orders. Tying the two together means no
/// call site can express one without the other.
struct AsyncButton<Label: View>: View {
    let title: String
    var isLoading = false
    var isDisabled = false
    let action: () -> Void
    @ViewBuilder var label: () -> Label

    var body: some View {
        Button(action: action) {
            ZStack {
                // The label stays in the layout while hidden, so the button does not resize as the
                // spinner appears — a jumping button is a button people miss.
                label().opacity(isLoading ? 0 : 1)

                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(Theme.colors.onPrimary)
                }
            }
        }
        .disabled(isLoading || isDisabled)
        .accessibilityLabel(isLoading ? "\(title), in progress" : title)
    }
}

extension AsyncButton where Label == Text {
    init(_ title: String, isLoading: Bool = false, isDisabled: Bool = false, action: @escaping () -> Void) {
        self.init(title: title, isLoading: isLoading, isDisabled: isDisabled, action: action) {
            Text(title)
        }
    }
}
