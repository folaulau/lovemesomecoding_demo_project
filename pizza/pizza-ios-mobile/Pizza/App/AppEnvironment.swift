import Foundation
import Observation
import SwiftUI

/// The composition root: the one place that decides which concrete types this app runs with.
///
/// ## Why a container and not singletons
///
/// Every type below could have been a `static let shared`. The reason none of them is:
///
/// - **Tests would share the app's wiring.** A singleton HTTP client is a client every test talks
///   through, and "did this test touch the network?" stops being answerable.
/// - **The graph would be invisible.** Dependencies expressed as global access are dependencies
///   nobody can see. Here, reading this one initialiser tells you the whole shape of the app.
/// - **There is nowhere to swap a fake.** `AppEnvironment.preview` below hands the entire app a
///   stub-backed graph, which is what makes SwiftUI previews work without a running backend.
///
/// ## Why it is `@Observable`
///
/// Purely so it can be injected with `.environment(_:)` and read with `@Environment(AppEnvironment.self)`
/// — SwiftUI's own mechanism for observable types, with no `EnvironmentKey` boilerplate. The
/// container's own properties are `let`s and never change; the *stores* inside it are what views
/// actually observe, and nested `@Observable` tracking reaches them.
@MainActor
@Observable
final class AppEnvironment {
    // Configuration
    let configuration: APIConfiguration

    // Data layer
    let authRepository: AuthRepository
    let catalogRepository: CatalogRepository
    let cartRepository: CartRepository
    let orderRepository: OrderRepository
    let profileRepository: ProfileRepository

    // Application state
    let auth: AuthStore
    let menu: MenuStore
    let cart: CartStore
    let toasts: ToastCenter

    // Payment
    let paymentGateway: PaymentGateway

    /// The production graph.
    ///
    /// Note the order: the token store is built first because the HTTP client needs it to attach
    /// the bearer token, and the stores are built last because they need repositories. That is the
    /// dependency graph made literal — if it were wrong, this would not compile.
    static func live() -> AppEnvironment {
        let configuration = APIConfiguration.fromBundle()
        let tokenStore = TokenStore(secureStore: KeychainSecureStore())
        let client = URLSessionHTTPClient(configuration: configuration, tokenProvider: tokenStore)

        return AppEnvironment(
            configuration: configuration,
            tokenStore: tokenStore,
            authRepository: RemoteAuthRepository(client: client),
            catalogRepository: RemoteCatalogRepository(client: client),
            cartRepository: RemoteCartRepository(client: client),
            orderRepository: RemoteOrderRepository(client: client),
            profileRepository: RemoteProfileRepository(client: client),
            cartIdentifierStore: CartIdentifierStore(store: UserDefaultsKeyValueStore()),
            paymentGateway: StripePaymentGateway(
                publishableKey: configuration.stripePublishableKey
            )
        )
    }

    init(
        configuration: APIConfiguration,
        tokenStore: TokenStore,
        authRepository: AuthRepository,
        catalogRepository: CatalogRepository,
        cartRepository: CartRepository,
        orderRepository: OrderRepository,
        profileRepository: ProfileRepository,
        cartIdentifierStore: CartIdentifierStore,
        paymentGateway: PaymentGateway
    ) {
        self.configuration = configuration
        self.authRepository = authRepository
        self.catalogRepository = catalogRepository
        self.cartRepository = cartRepository
        self.orderRepository = orderRepository
        self.profileRepository = profileRepository
        self.paymentGateway = paymentGateway

        self.auth = AuthStore(repository: authRepository, tokenStore: tokenStore)
        let menu = MenuStore(repository: catalogRepository)
        self.menu = menu
        /*
         * The cart depends on the menu, and that dependency is load-bearing: rehydrating a saved
         * basket needs the catalogue to re-price it, because a stored line holds only identifiers.
         *
         * In the React Native app the same constraint is expressed by the ORDER of two provider
         * components, with a comment warning not to swap them — get it wrong and the app crashes at
         * runtime on the first launch with a saved cart. Here it is a constructor parameter, so
         * getting it wrong is not something the compiler will let anyone do.
         */
        self.cart = CartStore(
            repository: cartRepository,
            identifierStore: cartIdentifierStore,
            menuStore: menu
        )
        self.toasts = ToastCenter()
    }
}

// MARK: - Previews

#if DEBUG
extension AppEnvironment {
    /// A fully stubbed graph for SwiftUI previews.
    ///
    /// Previews run in a host process with no backend, no Keychain entitlement and no view
    /// controller to present a payment sheet from. Everything that would reach outside the process
    /// is replaced here, which is why a preview renders instantly and deterministically instead of
    /// showing a spinner that never resolves.
    static func preview(
        catalogue: CatalogRepository = PreviewCatalogRepository(),
        orders: OrderRepository = PreviewOrderRepository(),
        profile: ProfileRepository = PreviewProfileRepository()
    ) -> AppEnvironment {
        let configuration = APIConfiguration(baseURL: URL(string: "http://localhost:8085")!)

        let environment = AppEnvironment(
            configuration: configuration,
            tokenStore: TokenStore(secureStore: InMemorySecureStore()),
            authRepository: PreviewAuthRepository(),
            catalogRepository: catalogue,
            cartRepository: PreviewCartRepository(),
            orderRepository: orders,
            profileRepository: profile,
            cartIdentifierStore: CartIdentifierStore(store: InMemoryKeyValueStore()),
            paymentGateway: StubPaymentGateway(isReady: true)
        )
        environment.menu.load()
        return environment
    }
}
#endif
