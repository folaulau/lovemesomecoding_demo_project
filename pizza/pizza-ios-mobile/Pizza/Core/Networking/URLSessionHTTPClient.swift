import Foundation
import OSLog

/// The production `HTTPClient`, on top of `URLSession`.
///
/// This is the *only* type in the app that constructs a `URLRequest`, so there is exactly one
/// implementation of: where the API lives, how the token is attached, how long to wait, and how an
/// error response becomes a thrown Swift error. Calling `URLSession` from a view model would
/// scatter all four, and they would drift.
///
/// ## What replaced `AbortController`
///
/// The React Native client threads an `AbortSignal` through every call and wires it to a timeout by
/// hand, because `fetch` has no other way to be interrupted. Swift needs none of that: structured
/// concurrency cancels a `Task` and every `await` inside it, so a view that disappears cancels its
/// own requests simply by its task going away. The timeout is a `URLSessionConfiguration` property.
/// Both of the RN client's most intricate functions vanish here — worth noticing, because it is the
/// clearest single argument for the native concurrency model.
final class URLSessionHTTPClient: HTTPClient {
    private let session: URLSession
    private let configuration: APIConfiguration
    private let tokenProvider: AuthTokenProviding?

    /*
     * The logger is reached through `AppLog` rather than stored.
     *
     * `Logger` is not `Sendable`, so holding one as a property of a `Sendable` type is a warning
     * today and an error under Swift 6's strict concurrency. Referencing the shared static instead
     * sidesteps it without `@preconcurrency`, and it keeps every category declared in one place.
     */
    private var logger: Logger { AppLog.http }

    init(
        configuration: APIConfiguration,
        tokenProvider: AuthTokenProviding? = nil,
        session: URLSession? = nil
    ) {
        self.configuration = configuration
        self.tokenProvider = tokenProvider

        if let session {
            self.session = session
        } else {
            let sessionConfiguration = URLSessionConfiguration.default
            sessionConfiguration.timeoutIntervalForRequest = configuration.requestTimeout
            /*
             * The app never wants a cached menu served as if it were fresh — prices change, and a
             * stale cart line is a support ticket. Opting out here rather than per-request means a
             * new endpoint cannot forget to.
             */
            sessionConfiguration.requestCachePolicy = .reloadIgnoringLocalCacheData
            self.session = URLSession(configuration: sessionConfiguration)
        }
    }

    func send<Response: Decodable>(
        _ endpoint: Endpoint,
        as type: Response.Type
    ) async throws -> Response {
        let request = try await makeRequest(for: endpoint)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            /*
             * A cancelled request is not a failure — it means the caller went away. Rethrowing it
             * untouched keeps `Task.isCancelled` and `CancellationError` checks upstream working.
             */
            if error.code == .cancelled { throw CancellationError() }

            logger.error("Transport failure for \(endpoint.path, privacy: .public): \(error.code.rawValue)")
            throw APIError.network(message: Self.transportMessage(for: error, baseURL: configuration.baseURL))
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.decoding(message: "The response was not an HTTP response.")
        }

        return try decode(data: data, response: httpResponse, endpoint: endpoint, as: type)
    }

    // MARK: - Request construction

    private func makeRequest(for endpoint: Endpoint) async throws -> URLRequest {
        guard let url = endpoint.url(relativeTo: configuration.baseURL) else {
            throw APIError.network(message: "Could not build a URL for \(endpoint.path).")
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let encodeBody = endpoint.encodeBody {
            do {
                request.httpBody = try encodeBody()
            } catch {
                // Encoding our own request body cannot fail for a customer-fixable reason; it is a
                // programming error, so it is reported as one rather than dressed up as a network
                // problem the customer might retry.
                throw APIError.decoding(message: "Could not encode the request body: \(error).")
            }
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        if endpoint.requiresAuthentication, let token = await tokenProvider?.currentToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    // MARK: - Response handling

    private func decode<Response: Decodable>(
        data: Data,
        response: HTTPURLResponse,
        endpoint: Endpoint,
        as type: Response.Type
    ) throws -> Response {
        guard (200 ..< 300).contains(response.statusCode) else {
            throw apiError(from: data, statusCode: response.statusCode, endpoint: endpoint)
        }

        // 204 No Content, or a 200 with an empty body, has nothing to decode.
        if data.isEmpty || response.statusCode == 204 {
            guard let empty = EmptyResponse() as? Response else {
                throw APIError.decoding(message: "Expected a body from \(endpoint.path) but got none.")
            }
            return empty
        }

        do {
            return try JSONCoding.decoder.decode(type, from: data)
        } catch {
            /*
             * A decoding failure is OUR bug, not the customer's connection, so it is logged in full
             * while the customer sees the generic message from `APIError.decoding`. The mismatch
             * details are exactly what is needed to fix it and exactly what must not leak into the
             * UI — or, given `.private`, into a sysdiagnose someone emails around.
             */
            logger.error("Decoding \(String(describing: type)) from \(endpoint.path, privacy: .public) failed: \(String(describing: error), privacy: .private)")
            throw APIError.decoding(message: "The server returned a response this app could not read.")
        }
    }

    private func apiError(from data: Data, statusCode: Int, endpoint: Endpoint) -> APIError {
        if statusCode == 401 { return .unauthorized }

        /*
         * The body may not be JSON at all: a proxy or a crashed server returns an HTML error page,
         * and decoding it would throw "Unexpected token <" over the top of the real problem. When
         * it cannot be read, fall back to the status code.
         */
        guard let body = try? JSONCoding.decoder.decode(APIErrorBody.self, from: data) else {
            logger.error("HTTP \(statusCode) from \(endpoint.path, privacy: .public) with an unreadable body")
            return .api(
                status: statusCode,
                message: "Request failed with \(statusCode).",
                body: nil
            )
        }

        return .api(status: statusCode, message: body.message, body: body)
    }

    /// Turns a transport failure into something worth reading.
    ///
    /// `URLError.localizedDescription` says "A server with the specified hostname could not be
    /// found", which tells a customer nothing and a developer almost nothing. Naming the host we
    /// actually tried, and the likeliest cause, turns the two failures that happen daily during
    /// development into self-answering questions.
    private static func transportMessage(for error: URLError, baseURL: URL) -> String {
        switch error.code {
        case .timedOut:
            "The server took too long to respond. Check your connection."
        case .notConnectedToInternet, .networkConnectionLost:
            "You appear to be offline. Check your connection and try again."
        default:
            "Could not reach the server at \(baseURL.absoluteString). Is the backend running?"
        }
    }
}
