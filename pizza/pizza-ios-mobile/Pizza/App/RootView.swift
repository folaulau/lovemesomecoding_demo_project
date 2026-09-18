import SwiftUI

/// The tab bar, the shared cart sheet, the modal routes and the toast overlay.
///
/// ## The launch gate
///
/// Nothing is shown until `AuthStore.restoreSession()` has finished. The token is in the Keychain
/// and reading it is asynchronous, so for a moment the app genuinely does not know whether anyone
/// is signed in. Rendering the tabs during that gap makes the Profile tab flash "Sign in" and then
/// swap — and the Orders tab would briefly show its signed-out prompt to a signed-in customer.
///
/// The web app has no equivalent, because `localStorage` answers synchronously on the first render.
@MainActor
struct RootView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(AuthStore.self) private var auth
    @Environment(MenuStore.self) private var menu
    @Environment(CartStore.self) private var cart
    @Environment(ToastCenter.self) private var toasts

    @State private var router = AppRouter()

    var body: some View {
        Group {
            if auth.isRestoringSession {
                LaunchPlaceholder()
            } else {
                tabs
            }
        }
        .tint(Theme.colors.primary)
        .background(Theme.colors.background)
        .task {
            /*
             * The startup sequence, and the order is load-bearing.
             *
             * The session is restored first because an authenticated cart request needs the token.
             * The menu is loaded next. The cart hydrates LAST, because a saved line holds only
             * identifiers — its price and crust surcharge come from the catalogue, so hydrating
             * first would produce a basket full of zero-priced lines.
             *
             * `.task` runs this once when the view appears and cancels it automatically if the view
             * goes away. There is no `onAppear` + manual cancellation to get wrong.
             */
            await auth.restoreSession()
            await menu.reload()
            await cart.hydrate()
        }
        .overlay(alignment: .top) { toastOverlay }
        .sheet(item: Binding(get: { router.presentedSheet }, set: { router.presentedSheet = $0 })) { sheet in
            sheetContent(for: sheet)
        }
        .environment(router)
    }

    // MARK: - Tabs

    private var tabs: some View {
        TabView(selection: Binding(get: { router.selectedTab }, set: { router.select($0) })) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                NavigationStack(path: router.path(for: tab)) {
                    rootScreen(for: tab)
                        .navigationDestination(for: AppRoute.self) { route in
                            destination(for: route)
                        }
                        .toolbar { cartToolbarItem }
                        .toolbarBackground(Theme.colors.surfaceInverse, for: .navigationBar)
                        .toolbarBackground(.visible, for: .navigationBar)
                        .toolbarColorScheme(.dark, for: .navigationBar)
                }
                .tabItem {
                    Label(tab.title, systemImage: tab.systemImage)
                }
                .tag(tab)
            }
        }
    }

    @ViewBuilder
    private func rootScreen(for tab: AppTab) -> some View {
        switch tab {
        case .home: HomeView()
        case .menu: MenuView()
        case .orders: OrdersView()
        case .profile: ProfileView()
        }
    }

    @ViewBuilder
    private func destination(for route: AppRoute) -> some View {
        switch route {
        case .checkout:
            CheckoutView()
        case let .order(id):
            OrderConfirmationView(orderID: id)
        }
    }

    /// One toolbar button for every tab, so the cart is reachable from anywhere.
    private var cartToolbarItem: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            CartToolbarButton { router.presentedSheet = .cart }
        }
    }

    // MARK: - Sheets

    @ViewBuilder
    private func sheetContent(for sheet: AppSheet) -> some View {
        switch sheet {
        case .cart:
            CartSheetView()
                // Two detents: a cart with one line does not need the whole screen, and the
                // smaller one leaves the menu visible behind it.
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.hidden)
        case .signIn:
            SignInView()
        case .register:
            RegisterView()
        }
    }

    // MARK: - Toasts

    /// Presented once, at the root, above every screen and sheet.
    ///
    /// A toast rendered inside a screen is bounded by that screen; attaching it here is the SwiftUI
    /// answer to the web app's `createPortal`, and it is why no feature view has to think about it.
    private var toastOverlay: some View {
        VStack(spacing: Spacing.sm) {
            ForEach(toasts.toasts) { toast in
                ToastView(toast: toast)
                    .onTapGesture { toasts.dismiss(toast.id) }
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .padding(.horizontal, Spacing.lg)
        .animation(.spring(duration: 0.25), value: toasts.toasts)
        // Taps pass through the empty space, so the overlay never blocks the screen underneath.
        .allowsHitTesting(!toasts.toasts.isEmpty)
    }
}

/// What is on screen while the session is being restored.
///
/// Deliberately the launch screen's own content rather than a spinner: matching what the system
/// already drew means the transition into the app is invisible, instead of a flash of a second,
/// different loading state.
@MainActor
private struct LaunchPlaceholder: View {
    var body: some View {
        VStack(spacing: Spacing.md) {
            Text("🍕").font(.system(size: 56))
            Text("StayHub Pizza").textStyle(.heading, tone: .muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.colors.background)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("StayHub Pizza, loading")
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return RootView()
        .environment(environment)
        .environment(environment.auth)
        .environment(environment.menu)
        .environment(environment.cart)
        .environment(environment.toasts)
}
#endif
