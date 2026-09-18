import Foundation

/// Everything that can go wrong between tapping a button and holding a decoded value.
///
/// One enum, not a family of `Error` types, and the cases are the *decisions a caller can make*:
///
/// - `.api` — the server answered, and said no. The body carries field-level messages a form can
///   render next to the offending input.
/// - `.unauthorized` — split out of `.api` deliberately. It is the one status that means "sign in
///   again" rather than "show this message", and giving it its own case means a caller cannot
///   forget to handle it by accident.
/// - `.network` — the request never reached the server. On a phone the usual cause is a lost
///   signal, not a backend that is down, and the copy says so.
/// - `.decoding` — we reached the server and could not understand it. Distinct from `.network`
///   because it is *our* bug, not the customer's connection, and it should be logged as such.
///
/// `LocalizedError` rather than a bare `Error`: it is what makes `error.localizedDescription`
/// return the message written below instead of "The operation couldn't be completed."
enum APIError: LocalizedError, Equatable {
    case api(status: Int, message: String, body: APIErrorBody?)
    case unauthorized
    case network(message: String)
    case decoding(message: String)

    var errorDescription: String? {
        switch self {
        case let .api(_, message, _): message
        case .unauthorized: "Your session has expired. Please sign in again."
        case let .network(message): message
        case .decoding: "The server returned a response this app could not read."
        }
    }

    var statusCode: Int? {
        switch self {
        case let .api(status, _, _): status
        case .unauthorized: 401
        case .network, .decoding: nil
        }
    }

    /// Field errors as a lookup, for rendering next to inputs.
    ///
    /// Returns an empty dictionary rather than nil for every non-API case, so a view can bind
    /// `errors[field]` without first asking which kind of failure it is dealing with.
    var fieldErrors: [String: String] {
        guard case let .api(_, _, body) = self, let subErrors = body?.errors else { return [:] }
        return subErrors.reduce(into: [:]) { result, subError in
            if let field = subError.field { result[field] = subError.message }
        }
    }

    /// True when retrying the same request could plausibly succeed.
    ///
    /// A 400 will fail again with the same body; a dropped connection will not. This is what a
    /// "Try again" button should be gated on.
    var isRetryable: Bool {
        switch self {
        case .network: true
        case let .api(status, _, _): status >= 500
        case .unauthorized, .decoding: false
        }
    }

    // `Equatable` is synthesised down to `APIErrorBody`, which is not Equatable — so the
    // comparison is defined by hand, on the parts a test would actually assert on.
    static func == (lhs: APIError, rhs: APIError) -> Bool {
        switch (lhs, rhs) {
        case let (.api(lStatus, lMessage, _), .api(rStatus, rMessage, _)):
            lStatus == rStatus && lMessage == rMessage
        case (.unauthorized, .unauthorized):
            true
        case let (.network(lMessage), .network(rMessage)):
            lMessage == rMessage
        case let (.decoding(lMessage), .decoding(rMessage)):
            lMessage == rMessage
        default:
            false
        }
    }
}

// MARK: - Presenting a failure to a customer

enum ErrorPresenter {
    /// The message to actually show a customer.
    ///
    /// Centralised so that no view repeats the `if let apiError = error as? APIError` ladder, and
    /// so that a `CancellationError` never reaches the screen: a cancelled request means the view
    /// went away, which is not a failure anyone needs to be told about.
    static func message(for error: Error, fallback: String = "Something went wrong.") -> String? {
        if error is CancellationError { return nil }
        if let urlError = error as? URLError, urlError.code == .cancelled { return nil }
        if let apiError = error as? APIError { return apiError.errorDescription ?? fallback }
        return error.localizedDescription.isEmpty ? fallback : error.localizedDescription
    }

    /// True when the error is "the caller went away", which every `catch` in this app ignores.
    static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let urlError = error as? URLError, urlError.code == .cancelled { return true }
        return false
    }
}
