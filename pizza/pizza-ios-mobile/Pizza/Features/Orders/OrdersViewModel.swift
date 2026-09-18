import Foundation
import Observation

/// The signed-in customer's order history.
@MainActor
@Observable
final class OrdersViewModel {
    private(set) var state: ViewState<[Order]> = .idle

    private let repository: OrderRepository
    private let pageSize: Int

    init(repository: OrderRepository, pageSize: Int = 20) {
        self.repository = repository
        self.pageSize = pageSize
    }

    /// Loads the first page.
    ///
    /// `showsLoadingState` is false for a pull-to-refresh: replacing the list with a spinner when
    /// the customer has just dragged it down makes the content they were looking at disappear under
    /// their finger. The system's refresh control is already the progress indicator.
    func load(showsLoadingState: Bool = true) async {
        if showsLoadingState { state = .loading }

        do {
            let page = try await repository.myOrders(page: 0, size: pageSize)
            state = .resolved(page.content)
        } catch {
            guard !ErrorPresenter.isCancellation(error) else { return }
            state = .failure(error, fallback: "Could not load your orders.")
        }
    }
}
