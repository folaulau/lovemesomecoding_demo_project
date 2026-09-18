import Foundation

/// Intercepts every request made through a `URLSession` configured with it.
///
/// ## Why this, and not a `URLSession` protocol
///
/// The usual alternative is to hide `URLSession` behind a protocol and inject a fake. That tests
/// the code around the session and skips the session itself — so it cannot catch a wrong HTTP
/// method, a missing header, or a body that fails to encode, which are exactly the mistakes this
/// layer makes.
///
/// `URLProtocol` sits *underneath* `URLSession`. The real session runs, builds the real request,
/// and this hands back a canned response. The assertions are therefore about the actual bytes the
/// app would have sent.
///
/// ⚠️ It is process-global. Every test that uses it must clear `handler` in `tearDown`, or a stale
/// closure from one test answers another test's request — which produces a failure that moves when
/// the test order changes, the most expensive kind to chase.
final class StubURLProtocol: URLProtocol {
    /// Called with the outgoing request; returns the response and body to reply with.
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    /// A session wired to this protocol and nothing else.
    static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    override class func canInit(with _: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = StubURLProtocol.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

extension HTTPURLResponse {
    static func stub(url: URL, statusCode: Int) -> HTTPURLResponse {
        HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: "HTTP/1.1", headerFields: nil)!
    }
}
