import XCTest
@testable import Pizza

/// The application state types, against stubbed repositories.
///
/// `@MainActor` on the class, because the stores are main-actor isolated. Annotating the test case
/// rather than each method means the compiler — not a runtime assertion — checks that every access
/// happens on the right actor.
/// ## Why `@MainActor` is on each method, not on the class
///
/// The stores and view models under test are main-actor isolated, so the tests have to be too. The
/// tempting spelling is `@MainActor final class …Tests: XCTestCase`, and it produces a warning that
/// becomes an error in Swift 6: `XCTestCase` is nonisolated, and a subclass may not add isolation
/// its superclass does not have.
///
/// Annotating each test method is the supported form. It is more typing and it is more honest —
/// the isolation belongs to the work, not to the test fixture.
final class AuthStoreTests: XCTestCase {
    @MainActor
    private func makeStore(
        repository: AuthRepositorySpy = AuthRepositorySpy(),
        secureStore: SecureStore = InMemorySecureStore()
    ) -> (AuthStore, AuthRepositorySpy, TokenStore) {
        let tokenStore = TokenStore(secureStore: secureStore)
        return (AuthStore(repository: repository, tokenStore: tokenStore), repository, tokenStore)
    }

    @MainActor
    func testRestoringWithoutAStoredTokenDoesNotCallTheAPI() async {
        let (store, repository, _) = makeStore()

        await store.restoreSession()

        XCTAssertEqual(repository.currentUserCallCount, 0, "No token means no session to verify.")
        XCTAssertFalse(store.isAuthenticated)
        XCTAssertFalse(store.isRestoringSession)
    }

    @MainActor
    func testRestoringVerifiesAStoredTokenAgainstTheAPI() async {
        // The mere presence of a token proves nothing — it may have expired or been revoked — so
        // /api/auth/me is the source of truth.
        let (store, repository, _) = makeStore(
            secureStore: InMemorySecureStore(seed: [.authToken: "stored.token"])
        )

        await store.restoreSession()

        XCTAssertEqual(repository.currentUserCallCount, 1)
        XCTAssertEqual(store.user?.email, SampleData.customer.email)
    }

    @MainActor
    func testARejectedTokenIsDiscardedRatherThanLeftBehind() async {
        // Leaving a dead token in the Keychain makes every later authenticated call fail with a
        // confusing 401 that looks like a server problem.
        let secureStore = InMemorySecureStore(seed: [.authToken: "expired.token"])
        let repository = AuthRepositorySpy(currentUserResult: .failure(APIError.unauthorized))
        let (store, _, tokenStore) = makeStore(repository: repository, secureStore: secureStore)

        await store.restoreSession()

        XCTAssertFalse(store.isAuthenticated)
        let remaining = await tokenStore.currentToken()
        XCTAssertNil(remaining)
    }

    @MainActor
    func testSigningInStoresTheTokenAndReportsSuccess() async {
        let (store, repository, tokenStore) = makeStore()

        let succeeded = await store.signIn(email: "sam@example.com", password: "pizza123")

        XCTAssertTrue(succeeded)
        XCTAssertTrue(store.isAuthenticated)
        XCTAssertEqual(repository.lastLoginEmail, "sam@example.com")
        let stored = await tokenStore.currentToken()
        XCTAssertEqual(stored, "token.abc")
    }

    @MainActor
    func testAFailedSignInPublishesTheMessageAndFieldErrors() async {
        let body = APIErrorBody(
            statusCode: 400,
            error: "Bad Request",
            message: "Those details did not match.",
            path: "/api/auth/login",
            timestamp: "",
            errors: [APISubError(field: "password", message: "Incorrect.")]
        )
        let repository = AuthRepositorySpy(
            loginResult: .failure(APIError.api(status: 400, message: body.message, body: body))
        )
        let (store, _, _) = makeStore(repository: repository)

        let succeeded = await store.signIn(email: "sam@example.com", password: "wrong")

        XCTAssertFalse(succeeded, "The caller must know not to navigate away.")
        XCTAssertEqual(store.errorMessage, "Those details did not match.")
        XCTAssertEqual(store.fieldErrors["password"], "Incorrect.")
        XCTAssertFalse(store.isSubmitting)
    }

    @MainActor
    func testSigningOutForgetsTheToken() async {
        let (store, _, tokenStore) = makeStore()
        _ = await store.signIn(email: "sam@example.com", password: "pizza123")

        await store.signOut()

        XCTAssertFalse(store.isAuthenticated)
        let remaining = await tokenStore.currentToken()
        XCTAssertNil(remaining, "JWTs are stateless: signing out is forgetting the token.")
    }
}

final class MenuStoreTests: XCTestCase {
    @MainActor
    func testLoadingPopulatesTheCatalogueAndSplitsItByType() async {
        let store = MenuStore(repository: CatalogRepositorySpy())

        await store.reload()

        XCTAssertEqual(store.catalogue.products.count, 3)
        XCTAssertEqual(store.catalogue.pizzas.count, 2)
        XCTAssertEqual(store.catalogue.drinks.count, 1)
        XCTAssertFalse(store.isLoading)
    }

    @MainActor
    func testAFailedLoadBecomesARetryableFailedState() async {
        let repository = CatalogRepositorySpy()
        repository.error = APIError.network(message: "The backend is not running.")
        let store = MenuStore(repository: repository)

        await store.reload()

        guard case let .failed(message, isRetryable) = store.state else {
            return XCTFail("Expected a failed state, got \(store.state)")
        }
        XCTAssertEqual(message, "The backend is not running.")
        XCTAssertTrue(isRetryable)
    }

    @MainActor
    func testAnEmptyMenuIsEmptyRatherThanLoaded() async {
        // `.empty` is a destination with its own copy, not a degenerate success.
        let repository = CatalogRepositorySpy()
        repository.products = []
        let store = MenuStore(repository: repository)

        await store.reload()

        guard case .empty = store.state else {
            return XCTFail("Expected an empty state, got \(store.state)")
        }
    }

    @MainActor
    func testLookupsFindProductsAndCrustsByID() async {
        let store = MenuStore(repository: CatalogRepositorySpy())
        await store.reload()

        XCTAssertEqual(store.catalogue.product(id: SampleData.pepperoni.id)?.name, "Classic Pepperoni")
        XCTAssertEqual(store.catalogue.crust(id: "c3")?.priceDelta, 2.50)
        XCTAssertNil(store.catalogue.crust(id: nil), "A cart line with no crust is a drink, not an error.")
    }
}

final class CartStoreTests: XCTestCase {
    @MainActor
    private func makeStore(
        repository: CartRepositorySpy = CartRepositorySpy(),
        identifier: UUIDString? = nil
    ) async -> (CartStore, CartRepositorySpy) {
        let seed: [StorageKey: String] = identifier.map { [.cartIdentifier: $0] } ?? [:]
        let menu = MenuStore(repository: CatalogRepositorySpy())
        await menu.reload()

        let store = CartStore(
            repository: repository,
            identifierStore: CartIdentifierStore(store: InMemoryKeyValueStore(seed: seed)),
            menuStore: menu,
            // Effectively no debounce, so a test does not have to sleep to observe a write.
            persistDebounce: .milliseconds(1)
        )
        return (store, repository)
    }

    @MainActor
    func testAddingBuildsALineFromTheProductAndItsOptions() async {
        let (store, _) = await makeStore()

        store.add(
            product: SampleData.pepperoni,
            size: .large,
            crust: SampleData.crusts[2],
            toppings: [SampleData.toppings[0]],
            quantity: 2
        )

        let line = try? XCTUnwrap(store.items.first)
        XCTAssertEqual(line?.productName, "Classic Pepperoni")
        XCTAssertEqual(line?.basePrice, 19.49, "The base price comes from the chosen size.")
        XCTAssertEqual(line?.crustPriceDelta, 2.50)
        XCTAssertEqual(store.totals.itemCount, 2)
    }

    @MainActor
    func testNothingIsWrittenBeforeHydration() async {
        // The worst bug this type can have: writing an empty cart over the saved one.
        let (store, repository) = await makeStore(identifier: "saved-cart")

        store.add(product: SampleData.cola, size: .medium, crust: nil, toppings: [], quantity: 1)
        try? await Task.sleep(for: .milliseconds(80))

        XCTAssertEqual(repository.replaceCallCount, 0)
        XCTAssertFalse(store.isHydrated)
    }

    @MainActor
    func testHydrationRepricesSavedLinesFromTheCatalogue() async {
        // A stored line holds only identifiers, so the price and crust surcharge must be looked up.
        let repository = CartRepositorySpy()
        repository.storedCart = ServerCart(
            id: "saved-cart",
            orderType: .carryout,
            items: [
                ServerCartItem(
                    id: "line-1",
                    productId: SampleData.pepperoni.id,
                    productName: "Classic Pepperoni",
                    productType: .pizza,
                    size: .large,
                    crustId: "c3",
                    crustName: "Stuffed Crust",
                    quantity: 2,
                    toppings: [
                        .init(toppingId: "t1", toppingName: "Pepperoni", price: 1.75),
                    ],
                    unitPrice: 0,
                    lineTotal: 0
                ),
            ],
            subtotal: 0, tax: 0, deliveryFee: 0, total: 0, itemCount: 2
        )
        let (store, _) = await makeStore(repository: repository, identifier: "saved-cart")

        await store.hydrate()

        let line = try? XCTUnwrap(store.items.first)
        XCTAssertEqual(line?.basePrice, 19.49)
        XCTAssertEqual(line?.crustPriceDelta, 2.50)
        XCTAssertEqual(store.orderType, .carryout, "The saved order type is restored too.")
        XCTAssertTrue(store.isHydrated)
    }

    @MainActor
    func testAMissingSavedCartIsForgottenRatherThanRetriedForever() async {
        let repository = CartRepositorySpy()
        repository.fetchError = APIError.api(status: 404, message: "Not found", body: nil)
        let (store, _) = await makeStore(repository: repository, identifier: "stale-cart")

        await store.hydrate()

        XCTAssertTrue(store.isHydrated)
        XCTAssertTrue(store.items.isEmpty)
    }

    @MainActor
    func testChangesArePersistedAfterTheDebounce() async {
        let (store, repository) = await makeStore()
        await store.hydrate()

        store.add(product: SampleData.cola, size: .medium, crust: nil, toppings: [], quantity: 1)
        try? await Task.sleep(for: .milliseconds(120))

        XCTAssertEqual(repository.createCallCount, 1, "A cart row is created on first write.")
        XCTAssertEqual(repository.replaceCallCount, 1)
        XCTAssertEqual(repository.lastWriteRequest?.items.count, 1)
        XCTAssertEqual(repository.lastWriteRequest?.items.first?.quantity, 1)
    }

    @MainActor
    func testTheWriteRequestCarriesIdentifiersAndNoPrices() async {
        // The server prices everything. A patched app sending `total: 0.01` changes nothing —
        // there is nowhere to put it.
        let (store, repository) = await makeStore()
        await store.hydrate()

        store.add(
            product: SampleData.pepperoni,
            size: .medium,
            crust: SampleData.crusts[0],
            toppings: [SampleData.toppings[0], SampleData.toppings[2]],
            quantity: 3
        )
        try? await Task.sleep(for: .milliseconds(120))

        let item = try? XCTUnwrap(repository.lastWriteRequest?.items.first)
        XCTAssertEqual(item?.productId, SampleData.pepperoni.id)
        XCTAssertEqual(item?.toppingIds.count, 2)
        XCTAssertEqual(item?.quantity, 3)
    }

    @MainActor
    func testBrowsingWithoutAddingAnythingDoesNotCreateACartRow() async {
        let (store, repository) = await makeStore()
        await store.hydrate()

        store.orderType = .carryout
        try? await Task.sleep(for: .milliseconds(120))

        XCTAssertEqual(
            repository.createCallCount, 0,
            "Do not create a cart server-side just because someone opened the app."
        )
    }

    @MainActor
    func testFlushingWritesImmediatelyWithoutWaitingForTheDebounce() async {
        // The background flush: a phone may suspend or kill the process before a debounce fires.
        let (store, repository) = await makeStore()
        await store.hydrate()
        store.add(product: SampleData.cola, size: .medium, crust: nil, toppings: [], quantity: 1)

        store.flushPendingWrites()
        try? await Task.sleep(for: .milliseconds(60))

        XCTAssertGreaterThanOrEqual(repository.replaceCallCount, 1)
    }

    @MainActor
    func testTotalsFollowTheOrderType() async {
        let (store, _) = await makeStore()
        await store.hydrate()
        store.add(product: SampleData.cola, size: .medium, crust: nil, toppings: [], quantity: 1)

        store.orderType = .delivery
        XCTAssertEqual(store.totals.deliveryFee, CartPricing.deliveryFee)

        store.orderType = .carryout
        XCTAssertEqual(store.totals.deliveryFee, 0)
    }
}
