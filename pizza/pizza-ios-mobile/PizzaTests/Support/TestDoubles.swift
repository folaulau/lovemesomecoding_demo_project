import Foundation
@testable import Pizza

/// Hand-written test doubles.
///
/// ## Why these are written out rather than generated
///
/// A mocking framework would remove the boilerplate below and add a dependency, a code-generation
/// step and a layer of indirection between a failing test and the reason it failed. At this size
/// the boilerplate is cheaper — and a double you wrote is a double you can read when a test starts
/// failing for a reason the framework does not explain.
///
/// Each one records what it was asked for. Asserting on the *call* as well as the result is what
/// catches the bugs that a return value cannot: a screen that fetches twice, a write that never
/// happens, a request sent without authentication.

// MARK: - Catalogue

final class CatalogRepositorySpy: CatalogRepository, @unchecked Sendable {
    var products: [Product] = SampleData.products
    var toppings: [Topping] = SampleData.toppings
    var crusts: [Crust] = SampleData.crusts
    var error: Error?

    private(set) var productsCallCount = 0

    func products() async throws -> [Product] {
        productsCallCount += 1
        if let error { throw error }
        return products
    }

    func toppings() async throws -> [Topping] {
        if let error { throw error }
        return toppings
    }

    func crusts() async throws -> [Crust] {
        if let error { throw error }
        return crusts
    }
}

// MARK: - Authentication

final class AuthRepositorySpy: AuthRepository, @unchecked Sendable {
    var loginResult: Result<AuthenticationResponse, Error>
    var currentUserResult: Result<User, Error>

    private(set) var loginCallCount = 0
    private(set) var lastLoginEmail: String?
    private(set) var currentUserCallCount = 0

    init(
        loginResult: Result<AuthenticationResponse, Error> = .success(
            AuthenticationResponse(token: "token.abc", expiresInMinutes: 60, user: SampleData.customer)
        ),
        currentUserResult: Result<User, Error> = .success(SampleData.customer)
    ) {
        self.loginResult = loginResult
        self.currentUserResult = currentUserResult
    }

    func login(email: String, password _: String) async throws -> AuthenticationResponse {
        loginCallCount += 1
        lastLoginEmail = email
        return try loginResult.get()
    }

    func register(
        email _: String,
        password _: String,
        fullName _: String
    ) async throws -> AuthenticationResponse {
        try loginResult.get()
    }

    func currentUser() async throws -> User {
        currentUserCallCount += 1
        return try currentUserResult.get()
    }
}

// MARK: - Cart

final class CartRepositorySpy: CartRepository, @unchecked Sendable {
    var storedCart: ServerCart?
    var createError: Error?
    var fetchError: Error?

    private(set) var createCallCount = 0
    private(set) var replaceCallCount = 0
    private(set) var lastWriteRequest: CartWriteRequest?

    func createCart() async throws -> ServerCart {
        createCallCount += 1
        if let createError { throw createError }
        return Self.emptyCart(id: "created-cart")
    }

    func cart(id: UUIDString) async throws -> ServerCart {
        if let fetchError { throw fetchError }
        guard let storedCart else { return Self.emptyCart(id: id) }
        return storedCart
    }

    func replaceCart(id: UUIDString, with request: CartWriteRequest) async throws -> ServerCart {
        replaceCallCount += 1
        lastWriteRequest = request
        return Self.emptyCart(id: id)
    }

    static func emptyCart(id: UUIDString) -> ServerCart {
        ServerCart(
            id: id,
            orderType: .delivery,
            items: [],
            subtotal: 0,
            tax: 0,
            deliveryFee: 0,
            total: 0,
            itemCount: 0
        )
    }
}

// MARK: - Orders

final class OrderRepositorySpy: OrderRepository, @unchecked Sendable {
    var createResult: Result<OrderCreateResponse, Error> = .success(
        OrderCreateResponse(order: SampleData.order, clientSecret: "pi_secret")
    )
    /// Returned in sequence, so a test can watch a poll transition PENDING_PAYMENT → PAID.
    var paymentStatuses: [Order] = [SampleData.order]
    var ordersPage: Page<Order> = Page(
        content: [SampleData.order],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 20
    )
    var listError: Error?

    private(set) var createCallCount = 0
    private(set) var lastCreateRequest: OrderCreateRequest?
    private(set) var lastCreateWasAuthenticated: Bool?
    private(set) var paymentStatusCallCount = 0

    func createOrder(
        _ request: OrderCreateRequest,
        authenticated: Bool
    ) async throws -> OrderCreateResponse {
        createCallCount += 1
        lastCreateRequest = request
        lastCreateWasAuthenticated = authenticated
        return try createResult.get()
    }

    func paymentStatus(orderID _: UUIDString) async throws -> Order {
        defer { paymentStatusCallCount += 1 }
        let index = min(paymentStatusCallCount, paymentStatuses.count - 1)
        return paymentStatuses[index]
    }

    func myOrders(page _: Int, size _: Int) async throws -> Page<Order> {
        if let listError { throw listError }
        return ordersPage
    }
}

// MARK: - Profile

final class ProfileRepositorySpy: ProfileRepository, @unchecked Sendable {
    var addresses: [Address] = [SampleData.address]
    var paymentMethods: [PaymentMethod] = [SampleData.paymentMethod]
    var error: Error?
    var writeError: Error?

    private(set) var loadCallCount = 0
    private(set) var deletedAddressIDs: [UUIDString] = []
    private(set) var primaryAddressIDs: [UUIDString] = []
    private(set) var addedPaymentMethodIDs: [String] = []

    func addresses() async throws -> [Address] {
        loadCallCount += 1
        if let error { throw error }
        return addresses
    }

    func addAddress(_: AddressWriteRequest) async throws -> Address {
        if let writeError { throw writeError }
        return SampleData.address
    }

    func updateAddress(id _: UUIDString, with _: AddressWriteRequest) async throws -> Address {
        if let writeError { throw writeError }
        return SampleData.address
    }

    func makeAddressPrimary(id: UUIDString) async throws {
        if let writeError { throw writeError }
        primaryAddressIDs.append(id)
    }

    func deleteAddress(id: UUIDString) async throws {
        if let writeError { throw writeError }
        deletedAddressIDs.append(id)
        addresses.removeAll { $0.id == id }
    }

    func paymentMethods() async throws -> [PaymentMethod] {
        if let error { throw error }
        return paymentMethods
    }

    func createSetupIntent() async throws -> String {
        if let writeError { throw writeError }
        return "seti_secret"
    }

    func addPaymentMethod(stripePaymentMethodID: String) async throws -> PaymentMethod {
        if let writeError { throw writeError }
        addedPaymentMethodIDs.append(stripePaymentMethodID)
        return SampleData.paymentMethod
    }

    func makePaymentMethodPrimary(id _: UUIDString) async throws {
        if let writeError { throw writeError }
    }

    func deletePaymentMethod(id: UUIDString) async throws {
        if let writeError { throw writeError }
        paymentMethods.removeAll { $0.id == id }
    }
}
