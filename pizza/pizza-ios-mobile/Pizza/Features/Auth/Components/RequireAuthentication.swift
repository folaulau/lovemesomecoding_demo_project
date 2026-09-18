import SwiftUI

/// Gates a tab behind sign-in.
///
/// ## Why it prompts instead of redirecting
///
/// This is the deliberate difference from the web app's `<ProtectedRoute>`, which navigates away.
/// Redirecting out of a *tab* is disorienting: the customer taps "Orders", lands on a sign-in
/// screen, and the tab they tapped is no longer the selected one. Showing the prompt inside the tab
/// keeps the navigation state honest — they are still on Orders, it just has nothing to show yet.
///
/// ## It is a convenience, not a security control
///
/// The API resolves the owner from the token and returns 404 for anything that is not theirs. A
/// patched app that skipped this view entirely would see nothing it should not. Client-side gating
/// is for the customer's benefit; the server's is for everyone else's.
@MainActor
struct RequireAuthentication<Content: View>: View {
    @Environment(AuthStore.self) private var auth
    @Environment(AppRouter.self) private var router

    @ViewBuilder let content: () -> Content

    var body: some View {
        if auth.isAuthenticated {
            content()
        } else {
            ScreenContainer {
                EmptyStateView(
                    emoji: "🔒",
                    title: "Sign in to see this",
                    message: "Ordering never requires an account — this is just where your saved details live.",
                    actionTitle: "Sign in"
                ) {
                    router.presentedSheet = .signIn
                }
            }
        }
    }
}
