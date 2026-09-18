import Foundation

/// Every route this app calls, as data.
///
/// Grouped by resource, one caseless enum each. Two things fall out of writing them this way:
///
/// 1. **The API surface is one file.** "What does this app talk to?" is answered by reading it,
///    rather than by grepping for string literals scattered through five repositories.
/// 2. **They are directly testable.** `EndpointTests` asserts that
///    `OrderEndpoints.myOrders(page: 2, size: 10)` resolves to `/api/orders/mine?page=2&size=10`.
///    A path typo is caught by a test that never opens a socket.
///
/// Note where `requiresAuthentication` is and is not set. It is the one security-relevant flag in
/// this file, and having it declared next to the path — rather than decided by a caller — is what
/// stops `/api/me/addresses` from ever being sent without a token by accident.

// MARK: - Authentication

enum AuthEndpoints {
    private struct LoginBody: Encodable {
        let email: String
        let password: String
    }

    private struct RegisterBody: Encodable {
        let email: String
        let password: String
        let fullName: String
    }

    static func login(email: String, password: String) -> Endpoint {
        Endpoint(
            path: "/api/auth/login",
            method: .post,
            body: LoginBody(email: email, password: password)
        )
    }

    static func register(email: String, password: String, fullName: String) -> Endpoint {
        Endpoint(
            path: "/api/auth/register",
            method: .post,
            body: RegisterBody(email: email, password: password, fullName: fullName)
        )
    }

    static let currentUser = Endpoint(path: "/api/auth/me", requiresAuthentication: true)
}

// MARK: - Catalogue

enum CatalogEndpoints {
    static let products = Endpoint(path: "/api/products")
    static let toppings = Endpoint(path: "/api/toppings")
    static let crusts = Endpoint(path: "/api/crusts")
}

// MARK: - Cart

enum CartEndpoints {
    static let create = Endpoint(path: "/api/carts", method: .post)

    static func fetch(id: UUIDString) -> Endpoint {
        Endpoint(path: "/api/carts/\(id)")
    }

    static func replace(id: UUIDString, with request: CartWriteRequest) -> Endpoint {
        Endpoint(path: "/api/carts/\(id)", method: .put, body: request)
    }
}

// MARK: - Orders

enum OrderEndpoints {
    static func create(_ request: OrderCreateRequest, authenticated: Bool) -> Endpoint {
        Endpoint(
            path: "/api/orders",
            method: .post,
            requiresAuthentication: authenticated,
            body: request
        )
    }

    static func paymentStatus(orderID: UUIDString) -> Endpoint {
        Endpoint(path: "/api/orders/\(orderID)/payment-status")
    }

    /// `/mine` — the server resolves the owner from the token, so there is no user id in the path
    /// to pass, to get wrong, or to tamper with.
    static func myOrders(page: Int, size: Int) -> Endpoint {
        Endpoint(
            path: "/api/orders/mine",
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "size", value: String(size)),
            ],
            requiresAuthentication: true
        )
    }
}

// MARK: - Profile

/// Every route here is `/api/me/**`, and none of them takes a user id.
///
/// That is a security property, not a convenience: the server resolves the owner from the token, so
/// there is no id a patched client could substitute. Asking for someone else's address returns
/// **404, not 403** — a 403 would confirm the id exists.
enum ProfileEndpoints {
    private struct PaymentMethodBody: Encodable {
        let stripePaymentMethodId: String
    }

    static let addresses = Endpoint(path: "/api/me/addresses", requiresAuthentication: true)

    static func addAddress(_ request: AddressWriteRequest) -> Endpoint {
        Endpoint(
            path: "/api/me/addresses",
            method: .post,
            requiresAuthentication: true,
            body: request
        )
    }

    static func updateAddress(id: UUIDString, with request: AddressWriteRequest) -> Endpoint {
        Endpoint(
            path: "/api/me/addresses/\(id)",
            method: .put,
            requiresAuthentication: true,
            body: request
        )
    }

    static func makeAddressPrimary(id: UUIDString) -> Endpoint {
        Endpoint(path: "/api/me/addresses/\(id)/primary", method: .patch, requiresAuthentication: true)
    }

    static func deleteAddress(id: UUIDString) -> Endpoint {
        Endpoint(path: "/api/me/addresses/\(id)", method: .delete, requiresAuthentication: true)
    }

    static let paymentMethods = Endpoint(path: "/api/me/payment-methods", requiresAuthentication: true)

    static let setupIntent = Endpoint(
        path: "/api/me/payment-methods/setup-intent",
        method: .post,
        requiresAuthentication: true
    )

    static func addPaymentMethod(stripePaymentMethodID: String) -> Endpoint {
        Endpoint(
            path: "/api/me/payment-methods",
            method: .post,
            requiresAuthentication: true,
            body: PaymentMethodBody(stripePaymentMethodId: stripePaymentMethodID)
        )
    }

    static func makePaymentMethodPrimary(id: UUIDString) -> Endpoint {
        Endpoint(
            path: "/api/me/payment-methods/\(id)/primary",
            method: .patch,
            requiresAuthentication: true
        )
    }

    static func deletePaymentMethod(id: UUIDString) -> Endpoint {
        Endpoint(path: "/api/me/payment-methods/\(id)", method: .delete, requiresAuthentication: true)
    }
}
