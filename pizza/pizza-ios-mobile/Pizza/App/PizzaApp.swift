import SwiftUI

/// The application entry point.
///
/// Its only jobs are to build the dependency graph once and to observe the scene's lifecycle. Every
/// other decision belongs to `RootView` and below — an `App` that also knows about tabs, sheets and
/// navigation is an `App` nobody can test or preview.
///
/// `@MainActor` on the type is what allows `AppEnvironment.live()` to be called from a property
/// initialiser. The stores it builds are main-actor isolated, and a property default is evaluated
/// in the enclosing type's isolation — nonisolated by default, which the compiler rejects with
/// "call to main actor-isolated static method in a synchronous nonisolated context". Annotating the
/// `App` is both correct and honest: it only ever runs on the main thread anyway.
@main
@MainActor
struct PizzaApp: App {
    /// The graph, built once for the lifetime of the process.
    ///
    /// `@State` rather than `let`, because SwiftUI recreates the `App` struct on any invalidation.
    /// A `let` would rebuild the whole graph — new stores, an empty cart, a lost session — every
    /// time. `@State` keeps the object identity stable across those re-evaluations.
    @State private var environment = AppEnvironment.live()

    /// Reports foreground / background / inactive. The cart's background flush depends on it.
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(environment)
                .environment(environment.auth)
                .environment(environment.menu)
                .environment(environment.cart)
                .environment(environment.toasts)
                /*
                 * The app is light-only, matching the three web frontends. Dark mode is not a
                 * missing feature so much as a deliberate scope line: `Theme` declares one palette,
                 * and honouring `@Environment(\.colorScheme)` would mean a second one for every
                 * token. Removing this line is the first step if that changes.
                 */
                .preferredColorScheme(.light)
        }
        .onChange(of: scenePhase) { _, newPhase in
            /*
             * THE MOBILE-ONLY PROBLEM.
             *
             * A browser tab lives until it is closed, so a debounced save always gets to fire. A
             * phone may suspend this process the instant it leaves the foreground, and may
             * terminate it outright to reclaim memory — without warning, and without running
             * pending work. A customer who adds a pizza and immediately switches apps would lose it.
             *
             * `.inactive` is included as well as `.background` on purpose: it arrives first, while
             * the app is still running, so the write starts during the app-switcher animation
             * rather than in the much shorter window after it.
             */
            if newPhase == .background || newPhase == .inactive {
                environment.cart.flushPendingWrites()
            }
        }
    }
}
