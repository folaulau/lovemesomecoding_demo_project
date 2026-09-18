import Foundation

/// The boundary between "what the app needs" and "how it is fetched".
///
/// ## Why protocols, and why they live in `Domain`
///
/// These are declared in the domain layer and *implemented* in the data layer, which inverts the
/// usual dependency: the feature code depends on an abstraction it owns, and the networking code
/// depends on it too. Nothing in `Features/` imports `URLSession`, `Endpoint` or even `APIError` by
/// way of a repository — swapping the transport for a GraphQL client, a local database, or a fake
/// touches `Data/` and nothing else.
///
/// The practical payoff is testing. `MenuStoreTests` injects a `CatalogRepository` that returns
/// three pizzas from an array; no server, no `URLProtocol` stub, no waiting.
///
/// Every method is `async throws`, and every one of them throws `APIError`. There is no `Result`
/// and no completion handler: Swift concurrency makes the error path the language's own, so a
/// caller that forgets to handle a failure does not compile.

// MARK: - Authentication

protocol AuthRepository: Sendable {
    func login(email: String, password: String) async throws -> AuthenticationResponse
    func register(email: String, password: String, fullName: String) async throws -> AuthenticationResponse
    /// The account behind the current token. Used at launch to find out whether a stored token is
    /// still good — the presence of a token proves nothing, since it may have expired or been revoked.
    func currentUser() async throws -> User
}

// MARK: - Catalogue

protocol CatalogRepository: Sendable {
    func products() async throws -> [Product]
    func toppings() async throws -> [Topping]
    func crusts() async throws -> [Crust]
}

// MARK: - Cart

protocol CartRepository: Sendable {
    func createCart() async throws -> ServerCart
    func cart(id: UUIDString) async throws -> ServerCart
    /// Replaces the whole cart in one idempotent write.
    func replaceCart(id: UUIDString, with request: CartWriteRequest) async throws -> ServerCart
}

// MARK: - Orders

protocol OrderRepository: Sendable {
    /// `authenticated` is a parameter rather than a constant because this same call serves guests.
    /// With a token the order is attached to the account; without one, `guestEmail` is how the
    /// customer gets their receipt.
    func createOrder(_ request: OrderCreateRequest, authenticated: Bool) async throws -> OrderCreateResponse
    /// Asks the SERVER whether the payment settled. Deliberately not "mark this order paid" — the
    /// device is never the authority on money, and anyone can call our API.
    func paymentStatus(orderID: UUIDString) async throws -> Order
    func myOrders(page: Int, size: Int) async throws -> Page<Order>
}

// MARK: - Profile

protocol ProfileRepository: Sendable {
    func addresses() async throws -> [Address]
    func addAddress(_ request: AddressWriteRequest) async throws -> Address
    func updateAddress(id: UUIDString, with request: AddressWriteRequest) async throws -> Address
    func makeAddressPrimary(id: UUIDString) async throws
    func deleteAddress(id: UUIDString) async throws

    func paymentMethods() async throws -> [PaymentMethod]
    /// Opens a Stripe SetupIntent so a card can be collected without being charged.
    func createSetupIntent() async throws -> String
    /// Saves a card the DEVICE already collected. Only the opaque `pm_…` token is sent.
    func addPaymentMethod(stripePaymentMethodID: String) async throws -> PaymentMethod
    func makePaymentMethodPrimary(id: UUIDString) async throws
    func deletePaymentMethod(id: UUIDString) async throws
}
