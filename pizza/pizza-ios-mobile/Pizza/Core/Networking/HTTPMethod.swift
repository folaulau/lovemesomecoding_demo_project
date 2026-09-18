import Foundation

/// The HTTP verbs this app uses.
///
/// A closed enum rather than a `String`, so `Endpoint(method: "POTS", …)` cannot compile. The
/// raw values are uppercase because that is what goes on the wire.
enum HTTPMethod: String, Equatable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}
