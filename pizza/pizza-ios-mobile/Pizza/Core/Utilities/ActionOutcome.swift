import Foundation

/// The result of a write that a screen reports with a toast.
///
/// ## Why not `Result<String, String>`
///
/// Because it does not compile: `Result`'s failure type must conform to `Error`, and a message is a
/// `String`. Forcing it to fit would mean wrapping every message in an error type that exists only
/// to satisfy the generic — ceremony in exchange for nothing.
///
/// The deeper reason is that this is not a `Result`. A `Result` carries a *value* or an *error*;
/// both cases here carry the same thing, a sentence to show the customer. Naming the type after
/// what it actually models keeps the call sites honest — and it makes room for the third case,
/// which a `Result` has nowhere to put.
enum ActionOutcome: Equatable {
    case succeeded(String)
    case failed(String)
    /// The customer backed out — of a payment sheet, of a confirmation. Not a success and not an
    /// error: nothing should be shown at all. Modelling it as a `.failed("")` that every caller
    /// remembers to special-case is how an empty toast eventually reaches production.
    case cancelled

    var message: String? {
        switch self {
        case let .succeeded(message), let .failed(message): message
        case .cancelled: nil
        }
    }

    var isSuccess: Bool {
        if case .succeeded = self { return true }
        return false
    }
}
