import Foundation
import Observation

/// Watches an order until the payment settles.
///
/// ## Why poll when there is a webhook
///
/// Because a webhook does not reach a laptop unless `stripe listen` is running, and even in
/// production it can arrive seconds later than the customer does. The `/payment-status` endpoint
/// asks Stripe directly, so this screen is correct either way.
///
/// The device is never the authority here: it only asks the server what the server believes. There
/// is no "mark this order paid" call, because anyone can call our API.
@MainActor
@Observable
final class OrderConfirmationViewModel {
    private(set) var state: ViewState<Order> = .idle
    /// True once polling has given up — the copy then tells the customer to check their email
    /// rather than leaving a spinner implying something is still happening.
    private(set) var hasStoppedPolling = false

    private let repository: OrderRepository
    private let maxAttempts: Int
    private let pollInterval: Duration

    init(
        repository: OrderRepository,
        maxAttempts: Int = 10,
        pollInterval: Duration = .seconds(2)
    ) {
        self.repository = repository
        self.maxAttempts = maxAttempts
        self.pollInterval = pollInterval
    }

    /// Fetches the order, then keeps re-fetching until it leaves `PENDING_PAYMENT`.
    ///
    /// ## What replaced the timer
    ///
    /// The React Native version schedules a `setTimeout` from inside the success handler and has to
    /// clear it on unmount, or the loop fires requests forever — on a phone that is battery and
    /// data, not just wasted work.
    ///
    /// Here the loop is a `while` with an `await`. Called from `.task`, it is cancelled
    /// automatically when the view disappears: `Task.sleep` throws `CancellationError`, the loop
    /// unwinds, and there is nothing to remember to clean up. This is the clearest small example in
    /// the app of structured concurrency removing a whole category of bug.
    func startPolling(orderID: UUIDString) async {
        state = .loading

        for attempt in 0 ..< maxAttempts {
            do {
                let order = try await repository.paymentStatus(orderID: orderID)
                state = .loaded(order)

                guard order.status.isSettling else { return }

                // Do not sleep after the final attempt — it would delay the "give up" message by
                // two seconds for no reason.
                guard attempt < maxAttempts - 1 else { break }
                try await Task.sleep(for: pollInterval)
            } catch is CancellationError {
                return
            } catch {
                guard !ErrorPresenter.isCancellation(error) else { return }

                /*
                 * A failure mid-poll does not discard an order already on screen. The customer's
                 * receipt is more useful than a red box, and the next poll may well succeed — so
                 * the error only takes over the screen when there is nothing else to show.
                 */
                if state.value == nil {
                    state = .failure(error, fallback: "Could not load the order.")
                }
                return
            }
        }

        hasStoppedPolling = true
    }
}
