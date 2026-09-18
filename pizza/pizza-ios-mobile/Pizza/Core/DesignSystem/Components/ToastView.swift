import SwiftUI

/// A transient message over the top of everything.
///
/// ## Why this is not an `Alert`
///
/// "Added to your cart" must not interrupt. An alert steals focus, blocks the screen and demands a
/// tap to dismiss — appropriate for "delete this address?", hostile for a confirmation nobody asked
/// for. A toast reports and gets out of the way.
///
/// ## Why it is presented by a modifier, not rendered by each screen
///
/// The web version needs `createPortal` so a toast fired from inside a modal is not clipped by an
/// ancestor's `overflow: hidden`. SwiftUI has no cascade to escape, but it does have the same
/// structural problem: a toast rendered inside a screen is bounded by that screen. Attaching it as
/// an `.overlay` at the root — see `RootView` — puts it above every screen and sheet in one place.
struct ToastView: View {
    let toast: Toast

    var body: some View {
        Text(toast.message)
            .font(.system(size: FontSize.sm, weight: .semibold))
            .foregroundStyle(Theme.colors.onSurfaceInverse)
            .padding(.vertical, Spacing.md)
            .padding(.horizontal, Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(toast.style.background, in: RoundedRectangle(cornerRadius: Radius.md))
            .cardShadow()
            /*
             * `.isStatusElement` plus an announcement priority is what makes VoiceOver read a toast
             * that appeared without the customer doing anything. Without it the message is silent
             * for anyone not looking at the screen.
             */
            .accessibilityAddTraits(.isStaticText)
            .accessibilityLabel(toast.message)
    }
}

extension Toast.Style {
    var background: Color {
        switch self {
        case .success: Theme.colors.text
        case .danger: Theme.colors.danger
        case .info: Theme.colors.info
        }
    }
}
