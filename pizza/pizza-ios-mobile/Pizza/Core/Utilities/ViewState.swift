import Foundation

/// The state of a screen that loads something.
///
/// ## Why an enum instead of `isLoading` + `error` + `items`
///
/// Three independent properties describe eight combinations, and five of them are nonsense:
/// loading *and* failed, loaded *and* failed, empty *and* loading, and so on. Every one of those is
/// a bug someone can write, and the most common one ships constantly — a screen that renders a
/// spinner and forgets the failure branch spins forever the first time the backend is down.
///
/// An enum makes the illegal states unrepresentable. A view `switch`es over it, the compiler
/// insists every case is handled, and "what does this screen show right now?" has exactly one
/// answer at all times.
///
/// `.empty` is separate from `.loaded([])` deliberately: an empty result is a *destination*, not a
/// degenerate success, and it wants different copy ("No orders yet") and usually a call to action.
enum ViewState<Value> {
    case idle
    case loading
    case loaded(Value)
    case empty
    case failed(message: String, isRetryable: Bool)

    var value: Value? {
        if case let .loaded(value) = self { return value }
        return nil
    }

    var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }

    /// Builds the right case from a possibly-empty collection, so no caller has to remember the
    /// `.isEmpty ? .empty : .loaded(…)` ternary — and so none of them can forget it.
    static func resolved(_ collection: Value) -> ViewState where Value: Collection {
        collection.isEmpty ? .empty : .loaded(collection)
    }

    /// Maps a thrown error onto `.failed`, preserving whether a "Try again" button makes sense.
    static func failure(_ error: Error, fallback: String = "Something went wrong.") -> ViewState {
        ViewState.failed(
            message: ErrorPresenter.message(for: error, fallback: fallback) ?? fallback,
            isRetryable: (error as? APIError)?.isRetryable ?? true
        )
    }
}

extension ViewState: Equatable where Value: Equatable {}
