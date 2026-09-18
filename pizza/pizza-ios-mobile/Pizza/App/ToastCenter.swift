import Foundation
import Observation

struct Toast: Identifiable, Equatable {
    enum Style {
        case success
        case danger
        case info
    }

    let id = UUID()
    let message: String
    let style: Style
}

/// The app's transient messages.
///
/// ## `@Observable`, and why it replaced `ObservableObject`
///
/// The old protocol required a `@Published` on every property and an `@ObservedObject` at every
/// consumer, and it invalidated **every** observer whenever **any** published property changed. The
/// `@Observable` macro tracks reads at the property level instead: a view that reads only `toasts`
/// is not redrawn when something else on the type changes. For a type this small it makes no
/// measurable difference; for `CartStore`, read by four screens, it is the difference between
/// redrawing a tab badge and redrawing the menu.
///
/// ## `@MainActor` on the whole type
///
/// Everything here ends up driving UI, so the type is main-actor isolated rather than each method
/// being annotated. The compiler then enforces what would otherwise be a convention — there is no
/// way to mutate `toasts` from a background task without `await`, which is precisely the mistake
/// that produces "Publishing changes from background threads is not allowed" at runtime.
@MainActor
@Observable
final class ToastCenter {
    private(set) var toasts: [Toast] = []

    private let visibleDuration: Duration

    /// Dismissal timers, keyed by toast, so a manual dismiss can cancel the pending automatic one.
    ///
    /// Without cancellation a toast dismissed by hand still has a task waiting to remove an id that
    /// is already gone — harmless here, but the same oversight in a busy screen leaks a task per
    /// message.
    private var dismissalTasks: [Toast.ID: Task<Void, Never>] = [:]

    init(visibleDuration: Duration = .seconds(3)) {
        self.visibleDuration = visibleDuration
    }

    func show(_ message: String, style: Toast.Style = .success) {
        let toast = Toast(message: message, style: style)
        toasts.append(toast)

        dismissalTasks[toast.id] = Task { [weak self] in
            /*
             * `Task.sleep` rather than a `Timer`. It is cancellable, it participates in structured
             * concurrency, and — unlike a `Timer` on the main run loop — it does not fire in a burst
             * when the app returns from the background, because a suspended task simply resumes
             * late rather than accumulating missed ticks.
             */
            try? await Task.sleep(for: self?.visibleDuration ?? .seconds(3))
            guard !Task.isCancelled else { return }
            self?.dismiss(toast.id)
        }
    }

    func dismiss(_ id: Toast.ID) {
        dismissalTasks[id]?.cancel()
        dismissalTasks[id] = nil
        toasts.removeAll { $0.id == id }
    }

    /*
     * There is deliberately no `deinit` cancelling the pending tasks.
     *
     * Two reasons, and the second is the interesting one:
     *
     * 1. Each task captures `self` WEAKLY, so a pending dismissal keeps nothing alive. The worst
     *    case is a suspended task that wakes, finds nil, and ends.
     * 2. A `deinit` could not read `dismissalTasks` anyway. Deinitialisation is not main-actor
     *    isolated — it happens on whichever thread releases the last reference — so touching the
     *    isolated state from there is a data race, and Swift rejects it at compile time. Reaching
     *    for `MainActor.assumeIsolated` to silence that would be asserting something untrue.
     *
     * When cleanup genuinely must happen, it belongs in an explicit method the owner calls while
     * the object is still alive, not in `deinit`.
     */
}
