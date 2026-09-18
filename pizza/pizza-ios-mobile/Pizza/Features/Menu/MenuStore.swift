import Foundation
import Observation

/// The catalogue, fetched once.
///
/// The menu, toppings and crusts are needed by the menu screen, the builder sheet and the cart's
/// rehydration. They change rarely and are identical for every customer, so loading them once here
/// beats each screen fetching for itself — three screens appearing would otherwise mean three
/// identical round trips over a mobile connection.
///
/// This is where a caching layer would normally go. Doing it by hand once is worth seeing first:
/// the state machine, the parallel fetch and the cancellation below are exactly what such a layer
/// gives you for free, and knowing what it is doing is the difference between using one and
/// trusting one.
@MainActor
@Observable
final class MenuStore {
    /// Everything the catalogue is, in one value.
    ///
    /// Bundling them means `ViewState<Catalogue>` describes the whole screen in one property. Three
    /// separate `ViewState`s would allow "products loaded, crusts failed", which no screen has a
    /// sensible rendering for — the builder simply cannot open without all three.
    struct Catalogue: Equatable {
        var products: [Product] = []
        var toppings: [Topping] = []
        var crusts: [Crust] = []

        var pizzas: [Product] { products.filter { $0.type == .pizza } }
        var drinks: [Product] { products.filter { $0.type == .drink } }

        func product(id: UUIDString) -> Product? { products.first { $0.id == id } }
        func crust(id: UUIDString?) -> Crust? {
            guard let id else { return nil }
            return crusts.first { $0.id == id }
        }
    }

    private(set) var state: ViewState<Catalogue> = .idle

    /// The loaded catalogue, or an empty one.
    ///
    /// Views read this rather than unwrapping `state` themselves. A menu that is still loading has
    /// no products, and "no products yet" is a correct thing for a card to render — forcing every
    /// caller through an optional would add a `?? []` to each of them and buy nothing.
    var catalogue: Catalogue { state.value ?? Catalogue() }

    var isLoading: Bool { state.isLoading }

    private let repository: CatalogRepository
    private var loadTask: Task<Void, Never>?

    init(repository: CatalogRepository) {
        self.repository = repository
    }

    /// Loads the catalogue, replacing any load already running.
    ///
    /// Cancelling the previous task is what stops a slow first response from landing *after* a fast
    /// retry and overwriting fresher data. It is the structured-concurrency equivalent of the React
    /// version's `AbortController` in an effect cleanup, and it is one line instead of six.
    func load() {
        loadTask?.cancel()
        loadTask = Task { await performLoad() }
    }

    /// Awaitable, for the pull-to-refresh gesture — `.refreshable` keeps the spinner on screen for
    /// exactly as long as the `await` takes, so it must be given something real to wait on.
    func reload() async {
        loadTask?.cancel()
        await performLoad()
    }

    private func performLoad() async {
        state = .loading

        do {
            /*
             * `async let`, not three sequential `await`s. The three requests are independent, so
             * serialising them would triple the wait — on a phone that is the difference between a
             * menu that opens and a menu that appears to hang. The bindings start immediately and
             * are only suspended on at the `await` below.
             */
            async let products = repository.products()
            async let toppings = repository.toppings()
            async let crusts = repository.crusts()

            let catalogue = try await Catalogue(products: products, toppings: toppings, crusts: crusts)

            guard !Task.isCancelled else { return }
            state = catalogue.products.isEmpty ? .empty : .loaded(catalogue)
        } catch {
            // A cancellation is not a failure — it means a reload superseded this load.
            guard !Task.isCancelled, !ErrorPresenter.isCancellation(error) else { return }
            state = .failure(error, fallback: "Could not load the menu.")
        }
    }

    /*
     * There is deliberately no `deinit` cancelling the in-flight task.
     *
     * `deinit` runs on whichever thread releases the last reference, so it is NOT main-actor
     * isolated and cannot read this type's state — Swift rejects it at compile time, and
     * `MainActor.assumeIsolated` would be asserting something that is not true.
     *
     * Nothing leaks as a result. Every task here captures `self` weakly or is owned by the view
     * that started it, and the store's own lifetime is the app's. Cancellation that genuinely
     * matters happens where it can be done correctly: a superseding call cancels the previous
     * task, and a `.task` modifier cancels its work when its view disappears.
     */
}
