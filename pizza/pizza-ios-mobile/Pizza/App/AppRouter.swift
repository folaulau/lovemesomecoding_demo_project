import Foundation
import Observation
import SwiftUI

/// Where the app can navigate to, as a closed set.
///
/// ## Why routes are values
///
/// SwiftUI's older `NavigationLink(destination:)` builds the destination view *eagerly*, at the
/// moment the link is rendered — so a list of fifty orders constructs fifty detail screens nobody
/// asked for. `NavigationStack` with a `path` inverts that: a route is pushed as a small value and
/// the view is built only when it is actually shown.
///
/// The second payoff is that navigation becomes testable and restorable. "The customer is two
/// levels deep looking at order X" is a `[AppRoute]`, which can be asserted on, logged, or restored
/// after the app is terminated in the background.
enum AppRoute: Hashable {
    case checkout
    case order(id: UUIDString)
}

/// The four customer tabs.
///
/// A tab bar rather than the web app's navbar, because that is what a phone expects: the
/// destinations are always visible and always within thumb reach, instead of behind a hamburger.
///
/// **The cart is deliberately not a tab.** It is a toolbar button that opens a sheet, so the
/// customer never loses the screen they were on — tapping a fifth tab to check the basket and then
/// navigating back to the menu is the friction this avoids. It also mirrors the web app, where the
/// cart is a drawer over the page rather than a route.
enum AppTab: Hashable, CaseIterable {
    case home
    case menu
    case orders
    case profile

    var title: String {
        switch self {
        case .home: "Home"
        case .menu: "Menu"
        case .orders: "Orders"
        case .profile: "Profile"
        }
    }

    /// SF Symbols, not emoji.
    ///
    /// The React Native app uses emoji and comments that a real app would reach for an icon set.
    /// This is that app. SF Symbols tint with the tab bar's colours, scale with Dynamic Type, and
    /// have accessibility descriptions built in — none of which an emoji glyph can do.
    var systemImage: String {
        switch self {
        case .home: "house.fill"
        case .menu: "fork.knife"
        case .orders: "list.bullet.rectangle.portrait"
        case .profile: "person.crop.circle"
        }
    }
}

/// Which modal is open, as one value rather than three booleans.
///
/// Three `@State private var isXPresented` flags allow two sheets to be "presented" at once, which
/// SwiftUI resolves by showing one and silently ignoring the other — a bug that looks like a tap
/// being dropped. One optional enum makes that state unrepresentable.
enum AppSheet: Identifiable, Hashable {
    case cart
    case signIn
    case register

    var id: Self { self }
}

/// Navigation state, in one observable place.
///
/// ## Why each tab has its own path
///
/// A single shared path would mean switching tabs inherits the previous tab's stack — tap Orders,
/// open an order, switch to Menu, and the menu appears two levels deep. Per-tab stacks are what
/// make each tab remember where it was, which is the behaviour every iOS customer expects.
@MainActor
@Observable
final class AppRouter {
    var selectedTab: AppTab = .home
    var presentedSheet: AppSheet?

    var homePath = NavigationPath()
    var menuPath = NavigationPath()
    var ordersPath = NavigationPath()
    var profilePath = NavigationPath()

    /// The path for the tab currently on screen, as a binding the `NavigationStack` can write back.
    ///
    /// Routing every push through here means a feature never has to know which tab it is in — the
    /// checkout button on the cart sheet works identically whether the customer opened the cart
    /// from Home or from Orders.
    func path(for tab: AppTab) -> Binding<NavigationPath> {
        switch tab {
        case .home: Binding(get: { self.homePath }, set: { self.homePath = $0 })
        case .menu: Binding(get: { self.menuPath }, set: { self.menuPath = $0 })
        case .orders: Binding(get: { self.ordersPath }, set: { self.ordersPath = $0 })
        case .profile: Binding(get: { self.profilePath }, set: { self.profilePath = $0 })
        }
    }

    func push(_ route: AppRoute) {
        switch selectedTab {
        case .home: homePath.append(route)
        case .menu: menuPath.append(route)
        case .orders: ordersPath.append(route)
        case .profile: profilePath.append(route)
        }
    }

    /// Replaces the current stack with a single destination.
    ///
    /// Used after a successful payment: the back gesture must not return to a checkout screen for an
    /// order that has already been paid for. Clearing the stack first is the native equivalent of
    /// the web app's `router.replace`.
    func replaceStack(with route: AppRoute) {
        switch selectedTab {
        case .home: homePath = NavigationPath([route])
        case .menu: menuPath = NavigationPath([route])
        case .orders: ordersPath = NavigationPath([route])
        case .profile: profilePath = NavigationPath([route])
        }
    }

    func popToRoot() {
        switch selectedTab {
        case .home: homePath = NavigationPath()
        case .menu: menuPath = NavigationPath()
        case .orders: ordersPath = NavigationPath()
        case .profile: profilePath = NavigationPath()
        }
    }

    func select(_ tab: AppTab) {
        selectedTab = tab
    }

    func dismissSheet() {
        presentedSheet = nil
    }
}
