import XCTest
@testable import Pizza

final class APIErrorTests: XCTestCase {
    private func validationError() -> APIError {
        let body = APIErrorBody(
            statusCode: 400,
            error: "Bad Request",
            message: "Validation failed",
            path: "/api/me/addresses",
            timestamp: "2026-09-18T18:24:00",
            errors: [
                APISubError(field: "postalCode", message: "Not a valid ZIP."),
                APISubError(field: nil, message: "A message with no field."),
            ]
        )
        return .api(status: 400, message: body.message, body: body)
    }

    func testFieldErrorsSkipMessagesWithNoField() {
        // A message with no field has nowhere to be rendered, so it must not become a phantom key.
        let errors = validationError().fieldErrors

        XCTAssertEqual(errors.count, 1)
        XCTAssertEqual(errors["postalCode"], "Not a valid ZIP.")
    }

    func testFieldErrorsAreEmptyForNonAPIFailures() {
        // Views bind `errors[field]` without first asking which kind of failure this is.
        XCTAssertTrue(APIError.network(message: "offline").fieldErrors.isEmpty)
        XCTAssertTrue(APIError.unauthorized.fieldErrors.isEmpty)
    }

    func testRetryabilityReflectsWhetherRetryingCouldWork() {
        XCTAssertTrue(APIError.network(message: "offline").isRetryable)
        XCTAssertTrue(APIError.api(status: 503, message: "", body: nil).isRetryable)
        XCTAssertFalse(APIError.api(status: 400, message: "", body: nil).isRetryable)
        XCTAssertFalse(APIError.unauthorized.isRetryable)
        XCTAssertFalse(APIError.decoding(message: "").isRetryable)
    }

    func testUnauthorizedReadsAsASessionProblem() {
        XCTAssertEqual(
            APIError.unauthorized.errorDescription,
            "Your session has expired. Please sign in again."
        )
    }
}

final class ErrorPresenterTests: XCTestCase {
    func testCancellationProducesNoMessage() {
        // A cancelled request means the view went away, which is not a failure anyone needs telling.
        XCTAssertNil(ErrorPresenter.message(for: CancellationError()))
        XCTAssertNil(ErrorPresenter.message(for: URLError(.cancelled)))
    }

    func testAnAPIErrorKeepsItsOwnMessage() {
        let error = APIError.api(status: 409, message: "A topping is out of stock.", body: nil)

        XCTAssertEqual(ErrorPresenter.message(for: error), "A topping is out of stock.")
    }

    func testIsCancellationRecognisesBothSpellings() {
        XCTAssertTrue(ErrorPresenter.isCancellation(CancellationError()))
        XCTAssertTrue(ErrorPresenter.isCancellation(URLError(.cancelled)))
        XCTAssertFalse(ErrorPresenter.isCancellation(URLError(.timedOut)))
    }
}

final class ViewStateTests: XCTestCase {
    func testResolvedDistinguishesEmptyFromLoaded() {
        // An empty result is a destination with its own copy, not a degenerate success.
        guard case .empty = ViewState<[Int]>.resolved([]) else {
            return XCTFail("An empty collection should resolve to .empty")
        }
        guard case let .loaded(values) = ViewState<[Int]>.resolved([1, 2]) else {
            return XCTFail("A non-empty collection should resolve to .loaded")
        }
        XCTAssertEqual(values, [1, 2])
    }

    func testFailurePreservesRetryability() {
        let retryable = ViewState<[Int]>.failure(APIError.network(message: "offline"))
        guard case let .failed(message, isRetryable) = retryable else {
            return XCTFail("Expected .failed")
        }
        XCTAssertEqual(message, "offline")
        XCTAssertTrue(isRetryable)

        let permanent = ViewState<[Int]>.failure(APIError.api(status: 400, message: "Bad input", body: nil))
        guard case .failed(_, false) = permanent else {
            return XCTFail("A 400 should not offer a retry")
        }
    }
}

final class TokenStoreTests: XCTestCase {
    func testItReadsTheKeychainOnceAndCachesAfterwards() async {
        let secureStore = CountingSecureStore(seed: [.authToken: "abc.123"])
        let store = TokenStore(secureStore: secureStore)

        let first = await store.currentToken()
        let second = await store.currentToken()

        XCTAssertEqual(first, "abc.123")
        XCTAssertEqual(second, "abc.123")
        XCTAssertEqual(secureStore.readCount, 1, "Every authenticated request would otherwise hit securityd.")
    }

    func testStoringUpdatesBothTheCacheAndTheKeychain() async {
        let secureStore = InMemorySecureStore()
        let store = TokenStore(secureStore: secureStore)

        await store.store("new.token")

        let cached = await store.currentToken()
        XCTAssertEqual(cached, "new.token")
        XCTAssertEqual(try? secureStore.string(for: .authToken), "new.token")
    }

    func testClearingRemovesItFromBoth() async {
        let secureStore = InMemorySecureStore(seed: [.authToken: "abc.123"])
        let store = TokenStore(secureStore: secureStore)
        _ = await store.currentToken()

        await store.clear()

        let cached = await store.currentToken()
        XCTAssertNil(cached)
        XCTAssertNil(try? secureStore.string(for: .authToken) ?? nil)
    }

    func testAKeychainFailureReadsAsNoSession() async {
        // The only honest interpretation of "we cannot read the token" is "there is no session".
        let store = TokenStore(secureStore: FailingSecureStore())

        let token = await store.currentToken()

        XCTAssertNil(token)
    }

    func testAFailedWriteStillLeavesAUsableSession() async {
        // The session works for as long as the app is running; it just will not survive a relaunch.
        // Failing the sign-in over this would be the worse outcome.
        let store = TokenStore(secureStore: FailingSecureStore())

        await store.store("new.token")

        let cached = await store.currentToken()
        XCTAssertEqual(cached, "new.token")
    }
}

// MARK: - Secure store doubles

private final class CountingSecureStore: SecureStore, @unchecked Sendable {
    private let inner: InMemorySecureStore
    private(set) var readCount = 0

    init(seed: [StorageKey: String] = [:]) { inner = InMemorySecureStore(seed: seed) }

    func string(for key: StorageKey) throws -> String? {
        readCount += 1
        return try inner.string(for: key)
    }

    func set(_ value: String, for key: StorageKey) throws { try inner.set(value, for: key) }
    func removeValue(for key: StorageKey) throws { try inner.removeValue(for: key) }
}

private struct FailingSecureStore: SecureStore {
    struct Failure: Error {}

    func string(for _: StorageKey) throws -> String? { throw Failure() }
    func set(_: String, for _: StorageKey) throws { throw Failure() }
    func removeValue(for _: StorageKey) throws { throw Failure() }
}

final class ModelTests: XCTestCase {
    func testOrderStatusDisplayNameIsReadable() {
        XCTAssertEqual(OrderStatus.pendingPayment.displayName, "pending payment")
        XCTAssertTrue(OrderStatus.pendingPayment.isSettling)
        XCTAssertFalse(OrderStatus.paid.isSettling)
    }

    func testSizeDisplayNameIsTitleCased() {
        // "MEDIUM" reads badly in a button; "Medium" does.
        XCTAssertEqual(SizeName.medium.displayName, "Medium")
        XCTAssertEqual(SizeName.small.displayName, "Small")
    }

    func testAddressSingleLineIncludesTheSecondLineOnlyWhenPresent() {
        XCTAssertEqual(
            SampleData.address.singleLine,
            "1200 SW Morrison St, Apt 4B, Portland, OR 97205"
        )

        let noApartment = Address(
            id: "a2", label: nil, recipientName: nil, phone: nil,
            line1: "1 Main St", line2: nil, city: "Portland", state: "OR",
            postalCode: "97205", primary: false
        )
        XCTAssertEqual(noApartment.singleLine, "1 Main St, Portland, OR 97205")
    }

    func testProductCheapestPriceIsNilRatherThanZeroWhenThereAreNoSizes() {
        // "from $0.00" would be a lie, and Swift's `min()` on an empty array is nil, not Infinity —
        // which is the bug the JavaScript version has to guard against explicitly.
        let noSizes = Product(
            id: "p0", name: "Coming soon", description: "", type: .pizza, imageUrl: nil,
            active: true, displayOrder: 1, sizes: [], createdAt: "", updatedAt: ""
        )

        XCTAssertNil(noSizes.cheapestPrice)
        XCTAssertEqual(SampleData.pepperoni.cheapestPrice, 11.49)
    }

    func testOrderShortIDIsTheFirstEightCharacters() {
        XCTAssertEqual(SampleData.order.shortID, "0a1b2c3d")
    }

    func testPaymentMethodDisplayStringsHandleMissingMetadata() {
        let unknown = PaymentMethod(id: "pm2", brand: nil, last4: nil, expMonth: nil, expYear: nil, primary: false)

        XCTAssertEqual(unknown.displayName, "Card •••• ????")
        XCTAssertEqual(unknown.expiryLabel, "Expiry unknown")
        XCTAssertEqual(SampleData.paymentMethod.expiryLabel, "Expires 12/2030")
    }

    func testOrderDateFormatterParsesSpringsTimeZoneLessTimestamps() {
        // Spring's LocalDateTime serialises without a time zone, which ISO8601DateFormatter rejects
        // by default. The fallback parser is what stops every order row showing a raw ISO string.
        XCTAssertNotNil(OrderDateFormatter.parse("2026-09-18T18:24:00"))
        XCTAssertNotNil(OrderDateFormatter.parse("2026-09-18T18:24:00.123Z"))
        XCTAssertNil(OrderDateFormatter.parse("not a date"))
        XCTAssertEqual(OrderDateFormatter.short("not a date"), "not a date", "It degrades, it does not blank out.")
    }
}

final class ActionOutcomeTests: XCTestCase {
    func testCancelledCarriesNoMessage() {
        // Modelling it as `.failed("")` that every caller remembers to special-case is how an empty
        // toast eventually reaches production.
        XCTAssertNil(ActionOutcome.cancelled.message)
        XCTAssertFalse(ActionOutcome.cancelled.isSuccess)
    }

    func testSuccessAndFailureBothCarryTheirMessage() {
        XCTAssertEqual(ActionOutcome.succeeded("Card saved").message, "Card saved")
        XCTAssertTrue(ActionOutcome.succeeded("Card saved").isSuccess)

        XCTAssertEqual(ActionOutcome.failed("Card declined.").message, "Card declined.")
        XCTAssertFalse(ActionOutcome.failed("Card declined.").isSuccess)
    }
}
