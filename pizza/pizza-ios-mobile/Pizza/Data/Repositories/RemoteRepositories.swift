import Foundation

/// The HTTP implementations of the domain's repository protocols.
///
/// They are deliberately thin — an endpoint in, a decoded model out — and that thinness is the
/// point. A repository that also cached, retried, or mapped errors would be a place for logic to
/// accumulate where no test would look for it. Caching belongs in a store, retrying belongs to the
/// caller that knows whether retrying is safe, and error mapping already happened in `HTTPClient`.
///
/// All five are `struct`s holding one `let`. They are values: cheap to make, impossible to mutate
/// into an inconsistent state, and `Sendable` without further thought.

// MARK: - Authentication

struct RemoteAuthRepository: AuthRepository {
    private let client: HTTPClient

    init(client: HTTPClient) { self.client = client }

    func login(email: String, password: String) async throws -> AuthenticationResponse {
        try await client.send(AuthEndpoints.login(email: email, password: password))
    }

    func register(
        email: String,
        password: String,
        fullName: String
    ) async throws -> AuthenticationResponse {
        try await client.send(
            AuthEndpoints.register(email: email, password: password, fullName: fullName)
        )
    }

    func currentUser() async throws -> User {
        try await client.send(AuthEndpoints.currentUser)
    }
}

// MARK: - Catalogue

struct RemoteCatalogRepository: CatalogRepository {
    private let client: HTTPClient

    init(client: HTTPClient) { self.client = client }

    func products() async throws -> [Product] { try await client.send(CatalogEndpoints.products) }
    func toppings() async throws -> [Topping] { try await client.send(CatalogEndpoints.toppings) }
    func crusts() async throws -> [Crust] { try await client.send(CatalogEndpoints.crusts) }
}

// MARK: - Cart

struct RemoteCartRepository: CartRepository {
    private let client: HTTPClient

    init(client: HTTPClient) { self.client = client }

    func createCart() async throws -> ServerCart {
        try await client.send(CartEndpoints.create)
    }

    func cart(id: UUIDString) async throws -> ServerCart {
        try await client.send(CartEndpoints.fetch(id: id))
    }

    func replaceCart(id: UUIDString, with request: CartWriteRequest) async throws -> ServerCart {
        try await client.send(CartEndpoints.replace(id: id, with: request))
    }
}

// MARK: - Orders

struct RemoteOrderRepository: OrderRepository {
    private let client: HTTPClient

    init(client: HTTPClient) { self.client = client }

    func createOrder(
        _ request: OrderCreateRequest,
        authenticated: Bool
    ) async throws -> OrderCreateResponse {
        try await client.send(OrderEndpoints.create(request, authenticated: authenticated))
    }

    func paymentStatus(orderID: UUIDString) async throws -> Order {
        try await client.send(OrderEndpoints.paymentStatus(orderID: orderID))
    }

    func myOrders(page: Int, size: Int) async throws -> Page<Order> {
        try await client.send(OrderEndpoints.myOrders(page: page, size: size))
    }
}

// MARK: - Profile

struct RemoteProfileRepository: ProfileRepository {
    /// The setup-intent response is a one-field envelope. It is declared privately here rather than
    /// in `Domain/Models`, because a client secret is a transport detail — the domain's interface
    /// hands back a `String`, and nothing above this layer needs to know it arrived wrapped.
    private struct SetupIntentResponse: Decodable {
        let clientSecret: String
    }

    private let client: HTTPClient

    init(client: HTTPClient) { self.client = client }

    func addresses() async throws -> [Address] {
        try await client.send(ProfileEndpoints.addresses)
    }

    func addAddress(_ request: AddressWriteRequest) async throws -> Address {
        try await client.send(ProfileEndpoints.addAddress(request))
    }

    func updateAddress(id: UUIDString, with request: AddressWriteRequest) async throws -> Address {
        try await client.send(ProfileEndpoints.updateAddress(id: id, with: request))
    }

    func makeAddressPrimary(id: UUIDString) async throws {
        try await client.send(ProfileEndpoints.makeAddressPrimary(id: id))
    }

    func deleteAddress(id: UUIDString) async throws {
        try await client.send(ProfileEndpoints.deleteAddress(id: id))
    }

    func paymentMethods() async throws -> [PaymentMethod] {
        try await client.send(ProfileEndpoints.paymentMethods)
    }

    func createSetupIntent() async throws -> String {
        let response: SetupIntentResponse = try await client.send(ProfileEndpoints.setupIntent)
        return response.clientSecret
    }

    func addPaymentMethod(stripePaymentMethodID: String) async throws -> PaymentMethod {
        try await client.send(
            ProfileEndpoints.addPaymentMethod(stripePaymentMethodID: stripePaymentMethodID)
        )
    }

    func makePaymentMethodPrimary(id: UUIDString) async throws {
        try await client.send(ProfileEndpoints.makePaymentMethodPrimary(id: id))
    }

    func deletePaymentMethod(id: UUIDString) async throws {
        try await client.send(ProfileEndpoints.deletePaymentMethod(id: id))
    }
}
