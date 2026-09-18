import XCTest
@testable import Pizza

/// An `Endpoint` is inert data, so these assertions are about the exact URL the app would request —
/// with no server, no mock protocol and no network.
final class EndpointTests: XCTestCase {
    private let baseURL = URL(string: "http://localhost:8085")!

    private func url(_ endpoint: Endpoint) -> String {
        endpoint.url(relativeTo: baseURL)?.absoluteString ?? "<nil>"
    }

    func testCatalogueEndpointsArePublic() {
        // The menu must not require a token: a guest browses before they sign in, and they may
        // never sign in at all.
        XCTAssertFalse(CatalogEndpoints.products.requiresAuthentication)
        XCTAssertFalse(CatalogEndpoints.toppings.requiresAuthentication)
        XCTAssertFalse(CatalogEndpoints.crusts.requiresAuthentication)
        XCTAssertEqual(url(CatalogEndpoints.products), "http://localhost:8085/api/products")
    }

    func testMyOrdersCarriesPagingAndRequiresAuthentication() {
        let endpoint = OrderEndpoints.myOrders(page: 2, size: 10)

        XCTAssertEqual(url(endpoint), "http://localhost:8085/api/orders/mine?page=2&size=10")
        XCTAssertTrue(endpoint.requiresAuthentication)
    }

    func testEveryProfileRouteRequiresAuthenticationAndCarriesNoUserID() {
        // This is a security assertion, not a routing one. Every `/api/me/**` route resolves the
        // owner from the token — there is no user id in the path to substitute. If one ever appears
        // here, a patched client could read someone else's addresses.
        //
        // (Line comments, not a `/* */` block: Swift NESTS block comments, so the `/**` in the path
        // above would open a second one and swallow the rest of the file. `//` does not nest.)
        let endpoints: [Endpoint] = [
            ProfileEndpoints.addresses,
            ProfileEndpoints.paymentMethods,
            ProfileEndpoints.setupIntent,
            ProfileEndpoints.addAddress(.empty),
            ProfileEndpoints.updateAddress(id: "a1", with: .empty),
            ProfileEndpoints.makeAddressPrimary(id: "a1"),
            ProfileEndpoints.deleteAddress(id: "a1"),
            ProfileEndpoints.addPaymentMethod(stripePaymentMethodID: "pm_1"),
            ProfileEndpoints.makePaymentMethodPrimary(id: "pm1"),
            ProfileEndpoints.deletePaymentMethod(id: "pm1"),
        ]

        for endpoint in endpoints {
            XCTAssertTrue(endpoint.requiresAuthentication, "\(endpoint.path) must be authenticated")
            XCTAssertTrue(endpoint.path.hasPrefix("/api/me/"), "\(endpoint.path) must be under /api/me")
        }
    }

    func testOrderCreationIsAuthenticatedOnlyWhenTheCustomerIs() {
        // Guest checkout works end to end, so this endpoint is the one that is conditionally
        // authenticated rather than always or never.
        let request = OrderCreateRequest(
            orderType: .carryout,
            customerName: "Sam",
            guestEmail: "sam@example.com",
            phone: nil,
            addressLine1: nil,
            addressLine2: nil,
            city: nil,
            state: nil,
            postalCode: nil,
            items: []
        )

        XCTAssertFalse(OrderEndpoints.create(request, authenticated: false).requiresAuthentication)
        XCTAssertTrue(OrderEndpoints.create(request, authenticated: true).requiresAuthentication)
    }

    func testMethodsAreCorrect() {
        XCTAssertEqual(CartEndpoints.create.method, .post)
        XCTAssertEqual(CartEndpoints.replace(id: "c1", with: .init(orderType: .delivery, items: [])).method, .put)
        XCTAssertEqual(ProfileEndpoints.makeAddressPrimary(id: "a1").method, .patch)
        XCTAssertEqual(ProfileEndpoints.deleteAddress(id: "a1").method, .delete)
    }

    func testQueryValuesArePercentEncoded() {
        // Built with URLComponents rather than string concatenation, so a value with a space or an
        // ampersand cannot produce a malformed URL.
        let endpoint = Endpoint(
            path: "/api/search",
            queryItems: [URLQueryItem(name: "q", value: "extra cheese & bacon")]
        )

        XCTAssertEqual(
            url(endpoint),
            "http://localhost:8085/api/search?q=extra%20cheese%20%26%20bacon"
        )
    }

    func testBodyIsEncodedLazilyAndAsJSON() throws {
        let endpoint = AuthEndpoints.login(email: "sam@example.com", password: "pizza123")
        let data = try XCTUnwrap(endpoint.encodeBody).self()
        let decoded = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: String])

        XCTAssertEqual(decoded["email"], "sam@example.com")
        XCTAssertEqual(decoded["password"], "pizza123")
    }
}
