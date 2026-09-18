import SwiftUI

/// The landing screen — a hero, the delivery/pickup pitch, and a shortcut into the menu.
///
/// There is no view model here, and that is the point of including it. This screen has no state of
/// its own: it reads two stores and renders them. Adding a `HomeViewModel` that forwarded those
/// reads would be ceremony, and a codebase where *every* screen has a view model teaches the wrong
/// lesson — the pattern earns its place where there is logic to move, not by decree.
@MainActor
struct HomeView: View {
    @Environment(MenuStore.self) private var menu
    @Environment(AuthStore.self) private var auth
    @Environment(AppRouter.self) private var router

    var body: some View {
        ScreenContainer {
            hero
            deliveryCard
            builderCard
            demoCard
        }
        .navigationTitle("StayHub Pizza")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var hero: some View {
        VStack(spacing: Spacing.sm) {
            Text("🍕")
                .font(.system(size: 52))
                .accessibilityHidden(true)

            Text("StayHub Pizza")
                .textStyle(.display, tone: .inverse)
                .multilineTextAlignment(.center)

            Text(welcomeMessage)
                .textStyle(.body, tone: .inverse)
                .multilineTextAlignment(.center)
                .opacity(0.85)

            Button("Start your order") {
                router.select(.menu)
            }
            .buttonStyle(.pizza(.primary, size: .large, fullWidth: true))
            .padding(.top, Spacing.lg)
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity)
        .background(
            Theme.colors.surfaceInverse,
            in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
        )
    }

    private var welcomeMessage: String {
        // `.first` on the split, not `[0]`: a full name of "" would crash on the subscript, and an
        // account with a blank name is a perfectly ordinary thing for a database to contain.
        let firstName = auth.user?.fullName?.split(separator: " ").first.map(String.init)
        let greeting = firstName.map { "Welcome back, \($0). " } ?? ""
        return greeting + "Hot, fast, and built exactly how you want it."
    }

    private var deliveryCard: some View {
        CardContainer {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Delivery").textStyle(.label, tone: .muted)
                Text("To your door in ~30 min").textStyle(.subheading)
                Text("A \(Money.format(CartPricing.deliveryFee)) delivery fee applies. Pickup is always free.")
                    .textStyle(.caption, tone: .muted)
            }
        }
    }

    private var builderCard: some View {
        CardContainer {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Build your own").textStyle(.label, tone: .muted)

                Text(menu.isLoading ? "Loading the menu…" : "\(menu.catalogue.pizzas.count) pizzas, your toppings")
                    .textStyle(.subheading)

                Text(startingAtMessage)
                    .textStyle(.caption, tone: .muted)

                Button("Browse the menu") {
                    router.select(.menu)
                }
                .buttonStyle(.pizza(.outline, size: .small))
                .padding(.top, Spacing.md)
            }
        }
    }

    private var startingAtMessage: String {
        guard let cheapest = menu.catalogue.pizzas.compactMap(\.cheapestPrice).min() else {
            return "Pick a size, a crust and as many toppings as you like."
        }
        return "Starting at \(Money.format(cheapest))."
    }

    /// The demo credentials.
    ///
    /// Acceptable **only** because they are throwaway local fixtures. If this app is ever pointed at
    /// real data, this card is the first thing to delete.
    private var demoCard: some View {
        CardContainer {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Demo logins").textStyle(.label, tone: .muted)
                Text("customer@pizza.test · pizza123").textStyle(.caption, tone: .muted)
                Text("Test card 4242 4242 4242 4242, any future expiry, any CVC.")
                    .textStyle(.caption, tone: .muted)
            }
        }
        .background(Theme.colors.surfaceAlt, in: RoundedRectangle(cornerRadius: Radius.md))
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return NavigationStack {
        HomeView()
            .environment(environment.menu)
            .environment(environment.auth)
            .environment(AppRouter())
    }
}
#endif
