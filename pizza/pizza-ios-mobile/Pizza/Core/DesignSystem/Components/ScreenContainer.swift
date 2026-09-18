import SwiftUI

/// The page shell every screen sits in.
///
/// ## Safe area: the thing with no web equivalent
///
/// A phone screen is not a rectangle you own. A notch, a camera cut-out, the home indicator and the
/// rounded corners all eat into it, and content placed at the top edge is drawn *under* the notch.
///
/// SwiftUI handles this by default — which is exactly why it is worth naming. A `ScrollView` already
/// insets its content for the safe area, so unlike React Native there is no `useSafeAreaInsets` call
/// and no manual padding here. The place it stops being automatic is when something is deliberately
/// pushed past the edge with `.ignoresSafeArea()`, and then the padding becomes yours again.
///
/// The extra bottom padding below is not safe-area work: it is breathing room so the last control
/// does not sit flush against the home indicator, where it is genuinely hard to press.
struct ScreenContainer<Content: View>: View {
    var isScrollable = true
    var isPadded = true
    /// Extra bottom room for a screen with its own pinned footer bar.
    var bottomInset: CGFloat = 0
    @ViewBuilder let content: () -> Content

    var body: some View {
        Group {
            if isScrollable {
                ScrollView {
                    stack
                }
                /*
                 * Dismiss the keyboard when the customer drags the page. There is no tap-outside
                 * convention on iOS the way there is on the web, and a keyboard covering the
                 * "Continue" button with no obvious way to close it is a dead end.
                 */
                .scrollDismissesKeyboard(.interactively)
            } else {
                stack
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.colors.background)
    }

    private var stack: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(isPadded ? Spacing.lg : 0)
        .padding(.bottom, Spacing.lg + bottomInset)
    }
}
