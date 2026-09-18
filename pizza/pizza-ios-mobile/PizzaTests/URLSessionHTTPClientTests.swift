import XCTest
@testable import Pizza

/// The networking layer, exercised through a real `URLSession` with a stubbed transport.
final class URLSessionHTTPClientTests: XCTestCase {
    private let baseURL = URL(string: "http://localhost:8085")!
    private var session: URLSession!

    override func setUp() {
        super.setUp()
        session = StubURLProtocol.makeSession()
    }

    override func tearDown() {
        // Not optional. `StubURLProtocol.handler` is process-global, and a stale closure left
        // behind answers the NEXT test's request — producing a failure that moves when the test
        // order changes, which is the most expensive kind to chase.
        StubURLProtocol.handler = nil
        session = nil
        super.tearDown()
    }

    private func makeClient(tokenProvider: AuthTokenProviding? = nil) -> URLSessionHTTPClient {
        URLSessionHTTPClient(
            configuration: APIConfiguration(baseURL: baseURL),
            tokenProvider: tokenProvider,
            session: session
        )
    }

    private func respond(
        statusCode: Int = 200,
        json: String = "{}",
        capture: (@Sendable (URLRequest) -> Void)? = nil
    ) {
        StubURLProtocol.handler = { request in
            capture?(request)
            return (.stub(url: request.url!, statusCode: statusCode), Data(json.utf8))
        }
    }

    // MARK: - Happy path

    func testDecodesASuccessfulResponse() async throws {
        respond(json: #"{"id":"t1","name":"Mushroom","price":1.25,"category":"VEGGIE","active":true}"#)

        let topping: Topping = try await makeClient().send(Endpoint(path: "/api/toppings/t1"))

        XCTAssertEqual(topping.name, "Mushroom")
        XCTAssertEqual(topping.category, .veggie)
    }

    func testSendsTheMethodAndPathTheEndpointDescribes() async throws {
        let captured = CapturedRequest()
        respond(capture: { captured.value = $0 })

        _ = try await makeClient().send(
            Endpoint(path: "/api/carts/c1", method: .put, body: CartWriteRequest(orderType: .delivery, items: []))
        ) as EmptyResponse

        XCTAssertEqual(captured.value?.httpMethod, "PUT")
        XCTAssertEqual(captured.value?.url?.path, "/api/carts/c1")
        XCTAssertEqual(captured.value?.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    // MARK: - Authentication

    func testAttachesTheBearerTokenOnlyWhenTheEndpointAsksForIt() async throws {
        let captured = CapturedRequest()
        let tokenStore = TokenStore(secureStore: InMemorySecureStore(seed: [.authToken: "abc.123"]))

        respond(capture: { captured.value = $0 })
        _ = try await makeClient(tokenProvider: tokenStore)
            .send(Endpoint(path: "/api/products")) as EmptyResponse
        XCTAssertNil(
            captured.value?.value(forHTTPHeaderField: "Authorization"),
            "A public endpoint must not leak the token."
        )

        respond(capture: { captured.value = $0 })
        _ = try await makeClient(tokenProvider: tokenStore)
            .send(Endpoint(path: "/api/me/addresses", requiresAuthentication: true)) as EmptyResponse
        XCTAssertEqual(captured.value?.value(forHTTPHeaderField: "Authorization"), "Bearer abc.123")
    }

    func testOmitsAuthorizationWhenThereIsNoToken() async throws {
        let captured = CapturedRequest()
        respond(capture: { captured.value = $0 })

        let tokenStore = TokenStore(secureStore: InMemorySecureStore())
        _ = try await makeClient(tokenProvider: tokenStore)
            .send(Endpoint(path: "/api/me/addresses", requiresAuthentication: true)) as EmptyResponse

        XCTAssertNil(captured.value?.value(forHTTPHeaderField: "Authorization"))
    }

    // MARK: - Failures

    func testMapsAnErrorBodyIntoFieldErrors() async {
        respond(
            statusCode: 400,
            json: """
            {
              "statusCode": 400,
              "error": "Bad Request",
              "message": "Validation failed",
              "path": "/api/auth/register",
              "timestamp": "2026-09-18T18:24:00",
              "errors": [{ "field": "email", "message": "Already registered." }]
            }
            """
        )

        do {
            _ = try await makeClient().send(Endpoint(path: "/api/auth/register")) as EmptyResponse
            XCTFail("Expected the request to throw")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 400)
            XCTAssertEqual(error.fieldErrors["email"], "Already registered.")
            XCTAssertFalse(error.isRetryable, "A 400 will fail again with the same body.")
        } catch {
            XCTFail("Expected an APIError, got \(error)")
        }
    }

    func testA401BecomesUnauthorizedRatherThanAGenericAPIError() async {
        // It is the one status that means "sign in again" rather than "show this message", so it
        // has its own case and a caller cannot forget to handle it by accident.
        respond(statusCode: 401, json: "{}")

        do {
            _ = try await makeClient().send(Endpoint(path: "/api/auth/me")) as EmptyResponse
            XCTFail("Expected the request to throw")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }

    func testAnHTMLErrorPageDoesNotProduceAJSONParsingMessage() async {
        // A proxy or a crashed server returns HTML. Letting the decoder throw would surface
        // "Unexpected character '<'" over the top of the real problem.
        respond(statusCode: 502, json: "<html><body>Bad Gateway</body></html>")

        do {
            _ = try await makeClient().send(Endpoint(path: "/api/products")) as EmptyResponse
            XCTFail("Expected the request to throw")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 502)
            XCTAssertTrue(error.isRetryable, "A 5xx is worth a retry.")
        } catch {
            XCTFail("Expected an APIError, got \(error)")
        }
    }

    func testA204HasNothingToDecode() async throws {
        StubURLProtocol.handler = { request in
            (.stub(url: request.url!, statusCode: 204), Data())
        }

        // Would throw "Unexpected end of file" without the empty-body short circuit.
        try await makeClient().send(Endpoint(path: "/api/me/addresses/a1", method: .delete))
    }

    func testAMalformedSuccessBodyIsADecodingErrorNotANetworkOne() async {
        // The distinction matters: a decoding failure is our bug and should be logged as such,
        // while a network failure is the customer's connection and is worth retrying.
        respond(json: #"{"unexpected":true}"#)

        do {
            _ = try await makeClient().send(Endpoint(path: "/api/toppings/t1")) as Topping
            XCTFail("Expected the request to throw")
        } catch let error as APIError {
            guard case .decoding = error else {
                return XCTFail("Expected a decoding error, got \(error)")
            }
            XCTAssertFalse(error.isRetryable)
        } catch {
            XCTFail("Expected an APIError, got \(error)")
        }
    }

    func testATransportFailureNamesTheHostItTried() async {
        StubURLProtocol.handler = { _ in throw URLError(.cannotConnectToHost) }

        do {
            _ = try await makeClient().send(Endpoint(path: "/api/products")) as EmptyResponse
            XCTFail("Expected the request to throw")
        } catch let error as APIError {
            guard case let .network(message) = error else {
                return XCTFail("Expected a network error, got \(error)")
            }
            XCTAssertTrue(
                message.contains("localhost:8085"),
                "Naming the host turns the daily development failure into a self-answering question."
            )
            XCTAssertTrue(error.isRetryable)
        } catch {
            XCTFail("Expected an APIError, got \(error)")
        }
    }

    func testCancellationPropagatesAsCancellationError() async {
        StubURLProtocol.handler = { _ in throw URLError(.cancelled) }

        do {
            _ = try await makeClient().send(Endpoint(path: "/api/products")) as EmptyResponse
            XCTFail("Expected the request to throw")
        } catch {
            XCTAssertTrue(
                error is CancellationError,
                "A cancelled request means the caller went away, not that anything failed."
            )
        }
    }
}

/// A box for the request the stub saw.
///
/// The handler is `@Sendable` and escapes into the URL loading system, so it cannot capture a local
/// `var`. A reference type is the smallest way to get the value back out.
private final class CapturedRequest: @unchecked Sendable {
    var value: URLRequest?
}
