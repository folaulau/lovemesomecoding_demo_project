import Foundation

/// Every identifier the API accepts or returns is a UUID string.
///
/// The backend keeps a numeric primary key internally but never publishes it: sequential ids would
/// let anyone walk /api/orders/1, /2, /3 and read other people's orders.
///
/// It is a `typealias` to `String`, not Swift's `UUID` type, and that is a deliberate call. Making
/// it a real `UUID` would be stricter — but it would also make the app crash on any id the server
/// formats in a way `UUID(uuidString:)` rejects, and an order history that fails to decode is a
/// far worse outcome than an id that is merely a string. The alias still documents the intent at
/// every use site.
typealias UUIDString = String

/// Spring's paginated envelope, trimmed to what the app uses.
///
/// Generic over its content so `Page<Order>` and `Page<Product>` are one type. `Decodable` is
/// synthesised automatically as long as `T` is — no manual `init(from:)` needed.
struct Page<T: Decodable>: Decodable {
    let content: [T]
    let totalElements: Int
    let totalPages: Int
    let number: Int
    let size: Int
}

/// One invalid field, from the API's ApiSubError.
struct APISubError: Decodable {
    let field: String?
    let message: String
}

/// The single error envelope every endpoint returns.
struct APIErrorBody: Decodable {
    let statusCode: Int
    let error: String
    let message: String
    let path: String
    let timestamp: String
    let errors: [APISubError]?
}
