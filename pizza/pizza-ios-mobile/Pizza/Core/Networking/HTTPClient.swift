import Foundation

/// Supplies the bearer token for authenticated requests.
///
/// This tiny protocol exists to break a dependency cycle. The HTTP client needs the token; the
/// token lives with the session, which is restored by calling the HTTP client. Depending on a
/// concrete session type in both directions would not compile — and depending on this instead
/// means the client knows only "something can give me a token", which is also exactly what a test
/// needs to stub.
protocol AuthTokenProviding: Sendable {
    func currentToken() async -> String?
}

/// The one thing in this app that performs a network request.
///
/// Everything above it — repositories, stores, views — depends on this protocol rather than on
/// `URLSession`. That is what makes the whole app testable without a server: a test injects a
/// client that returns canned values, and not one line of feature code knows the difference.
///
/// `Sendable` because it is shared across concurrency domains: a repository called from a
/// `@MainActor` view model hands work to a client that runs off the main actor.
protocol HTTPClient: Sendable {
    /// Sends the endpoint and decodes the response body.
    ///
    /// - Throws: `APIError` for anything the caller can act on. Cancellation propagates untouched
    ///   as `CancellationError`, so `Task` cancellation still behaves the way Swift expects.
    func send<Response: Decodable>(_ endpoint: Endpoint, as type: Response.Type) async throws -> Response
}

extension HTTPClient {
    /// Type inference does the work at the call site: `let user: User = try await client.send(…)`.
    func send<Response: Decodable>(_ endpoint: Endpoint) async throws -> Response {
        try await send(endpoint, as: Response.self)
    }

    /// For endpoints whose response body is of no interest — a `DELETE`, or a `PATCH` whose result
    /// the caller is about to re-fetch anyway.
    func send(_ endpoint: Endpoint) async throws {
        _ = try await send(endpoint, as: EmptyResponse.self)
    }
}
