import Foundation

/// One request, described as data.
///
/// This is the pattern that makes the networking layer testable. An `Endpoint` is an inert value —
/// building one performs no I/O — so `Data/Endpoints/*.swift` can be asserted on directly ("does
/// `OrderEndpoints.listMine(page: 2)` produce `/api/orders/mine?page=2&size=20`?") without a server,
/// a mock `URLProtocol`, or a single byte crossing the network.
///
/// The body is stored as an `@Sendable` closure returning `Data` rather than as `some Encodable`,
/// because a protocol with `Self` requirements cannot be stored in a plain property. Encoding
/// lazily also means a body is only serialised if the request is actually sent.
struct Endpoint {
    let path: String
    let method: HTTPMethod
    let queryItems: [URLQueryItem]
    /// Whether to attach the bearer token. Public endpoints (the menu, guest checkout) do not need it.
    let requiresAuthentication: Bool
    let encodeBody: (@Sendable () throws -> Data)?

    init(
        path: String,
        method: HTTPMethod = .get,
        queryItems: [URLQueryItem] = [],
        requiresAuthentication: Bool = false,
        encodeBody: (@Sendable () throws -> Data)? = nil
    ) {
        self.path = path
        self.method = method
        self.queryItems = queryItems
        self.requiresAuthentication = requiresAuthentication
        self.encodeBody = encodeBody
    }

    /// The convenience every call site actually uses: hand it a value, it encodes on demand.
    init(
        path: String,
        method: HTTPMethod,
        queryItems: [URLQueryItem] = [],
        requiresAuthentication: Bool = false,
        body: some Encodable & Sendable
    ) {
        self.init(
            path: path,
            method: method,
            queryItems: queryItems,
            requiresAuthentication: requiresAuthentication,
            encodeBody: { try JSONCoding.encoder.encode(body) }
        )
    }

    /// The URL this endpoint resolves to against a given base.
    ///
    /// Built with `URLComponents`, never by concatenating strings: a topping named "Extra Cheese"
    /// in a query parameter has to be percent-encoded, and `"\(base)\(path)?q=\(value)"` is exactly
    /// how that turns into a malformed URL nobody notices until a customer types an apostrophe.
    func url(relativeTo baseURL: URL) -> URL? {
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        ) else { return nil }

        if !queryItems.isEmpty { components.queryItems = queryItems }
        return components.url
    }
}
