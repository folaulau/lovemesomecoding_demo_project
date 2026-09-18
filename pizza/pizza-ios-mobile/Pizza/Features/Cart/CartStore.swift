import Foundation
import Observation

/// The basket: a pure reducer for the rules, and effects for everything else.
///
/// ## The division of labour
///
/// `CartReducer` owns *what a change means*. This type owns *what a change causes* — persistence,
/// hydration and the background flush. Keeping them apart is what makes the rules testable without
/// a network and the effects reviewable without wading through the rules.
///
/// ## Persistence lives on the server
///
/// The cart is saved to the **backend**, so force-quitting the app does not lose the basket. Only
/// the cart's UUID is kept on the device. Three effects implement it:
///
/// 1. **Hydrate on launch** — if the device remembers a cart id, fetch that cart and load it.
/// 2. **Persist on change** — a debounced `PUT` of the whole cart.
/// 3. **Flush on background** — see `flushPendingWrites()`. This one has no web equivalent and
///    matters a great deal.
@MainActor
@Observable
final class CartStore {
    private(set) var state: CartState = .initial
    /// False until the saved cart has been fetched — the tab badge should not flash "empty" first.
    private(set) var isHydrated = false

    var items: [CartItem] { state.items }
    var totals: CartTotals { CartPricing.totals(for: state.items, orderType: state.orderType) }

    /// The order type, as a binding for the segmented pickers that change it.
    ///
    /// Exposing a computed `Binding` rather than making `state` writable keeps the reducer the only
    /// path into the cart. A view gets two-way syntax; the store keeps its invariant.
    var orderType: OrderType {
        get { state.orderType }
        set { dispatch(.setOrderType(newValue)) }
    }

    private let repository: CartRepository
    private let identifierStore: CartIdentifierStore
    private let menuStore: MenuStore

    private var cartID: UUIDString?
    private var persistTask: Task<Void, Never>?

    /// How long to wait after the last change before writing. Three taps on "+" become one `PUT`.
    private let persistDebounce: Duration

    init(
        repository: CartRepository,
        identifierStore: CartIdentifierStore,
        menuStore: MenuStore,
        persistDebounce: Duration = .milliseconds(300)
    ) {
        self.repository = repository
        self.identifierStore = identifierStore
        self.menuStore = menuStore
        self.persistDebounce = persistDebounce
        self.cartID = identifierStore.identifier
    }

    // MARK: - Commands

    func add(
        product: Product,
        size: SizeName,
        crust: Crust?,
        toppings: [Topping],
        quantity: Int
    ) {
        let item = CartItem(
            productID: product.id,
            productName: product.name,
            productType: product.type,
            imageURL: product.imageUrl,
            size: size,
            basePrice: product.price(for: size) ?? 0,
            crustID: crust?.id,
            crustName: crust?.name,
            crustPriceDelta: crust?.priceDelta ?? 0,
            toppings: toppings,
            quantity: quantity
        )
        dispatch(.add(item))
    }

    func remove(lineID: UUID) { dispatch(.remove(lineID: lineID)) }

    func setQuantity(_ quantity: Int, for lineID: UUID) {
        dispatch(.setQuantity(lineID: lineID, quantity: quantity))
    }

    /// Emptied after a successful payment. The order type survives, deliberately.
    func clear() { dispatch(.clear) }

    /// The single funnel every change goes through.
    ///
    /// One place applies the reducer and one place schedules the write, so a new command cannot
    /// forget to persist — the mistake that leaves a cart that looks right until the app restarts.
    private func dispatch(_ action: CartAction) {
        state = CartReducer.reduce(state, action)
        schedulePersist()
    }

    // MARK: - 1. Hydration

    /// Loads the saved cart, once the catalogue is available.
    ///
    /// The catalogue is a precondition, not a convenience: a stored line holds only identifiers, so
    /// the base price and crust surcharge have to be looked up to re-price it. Hydrating first would
    /// produce a cart full of zero-priced lines.
    func hydrate() async {
        defer { isHydrated = true }

        guard let cartID else { return }

        do {
            let cart = try await repository.cart(id: cartID)
            let catalogue = menuStore.catalogue

            let items = cart.items.map { line -> CartItem in
                let product = catalogue.product(id: line.productId)
                let crust = catalogue.crust(id: line.crustId)

                return CartItem(
                    // A fresh device-local key. The server's line id is not reused, because a
                    // line's identity here is "this configuration", not a database row.
                    lineID: UUID(),
                    productID: line.productId,
                    productName: line.productName,
                    productType: line.productType,
                    imageURL: product?.imageUrl,
                    size: line.size,
                    basePrice: product?.price(for: line.size) ?? 0,
                    crustID: line.crustId,
                    crustName: line.crustName,
                    crustPriceDelta: crust?.priceDelta ?? 0,
                    toppings: line.toppings.map { topping in
                        Topping(
                            id: topping.toppingId,
                            name: topping.toppingName,
                            price: topping.price,
                            // Not stored on a cart line; only id, name and price are needed to
                            // re-price, and the builder is not open on a hydrated line anyway.
                            category: .meat,
                            active: true
                        )
                    },
                    quantity: line.quantity
                )
            }

            state = CartReducer.reduce(state, .hydrate(CartState(items: items, orderType: cart.orderType)))
        } catch {
            guard !ErrorPresenter.isCancellation(error) else { return }
            /*
             * The saved cart is gone — deleted server-side, or a stale id left from pointing the
             * app at a different environment. Forget it rather than leaving the device aimed at a
             * cart that will never load, which would fail identically on every launch.
             */
            AppLog.cart.info("Saved cart could not be loaded; forgetting the stored identifier.")
            identifierStore.clear()
            self.cartID = nil
        }
    }

    // MARK: - 2. Debounced persistence

    private func schedulePersist() {
        // Never write before hydrating: that would overwrite the saved cart with an empty one,
        // which is the single worst bug this file can have.
        guard isHydrated else { return }

        persistTask?.cancel()
        persistTask = Task { [persistDebounce] in
            /*
             * Cancelling and re-scheduling is the whole debounce. `Task.sleep` throws on
             * cancellation, so a superseded write simply never reaches the `persist()` below —
             * there is no flag to check and no timer handle to clear.
             */
            try? await Task.sleep(for: persistDebounce)
            guard !Task.isCancelled else { return }
            await self.persist()
        }
    }

    /// Writes the cart, creating one server-side first if this device has never had one.
    ///
    /// Shared by the debounced task and the background flush, so there is one implementation of
    /// "what does saving mean" rather than two that can drift apart.
    private func persist() async {
        do {
            let identifier: UUIDString
            if let cartID {
                identifier = cartID
            } else {
                // Do not create a cart row just because someone opened the app and browsed.
                guard !state.items.isEmpty else { return }
                let created = try await repository.createCart()
                identifier = created.id
                cartID = identifier
                identifierStore.save(identifier)
            }

            _ = try await repository.replaceCart(id: identifier, with: writeRequest())
        } catch {
            /*
             * A failed save must not break the screen. The cart still works for this session; it
             * simply will not survive a relaunch. A toast on every tap would be a worse experience
             * than the failure it is reporting — so it is logged, not surfaced.
             */
            guard !ErrorPresenter.isCancellation(error) else { return }
            AppLog.cart.error("Could not persist the cart: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func writeRequest() -> CartWriteRequest {
        CartWriteRequest(
            orderType: state.orderType,
            items: state.items.map { item in
                CartWriteRequest.Item(
                    productId: item.productID,
                    size: item.size,
                    crustId: item.crustID,
                    toppingIds: item.toppings.map(\.id),
                    quantity: item.quantity
                )
            }
        )
    }

    // MARK: - 3. Flush on background

    /// Writes immediately, skipping the debounce. Called when the app leaves the foreground.
    ///
    /// ## The mobile-only problem
    ///
    /// A browser tab stays alive until the customer closes it, so a 300 ms debounce always gets to
    /// fire. A phone does not work that way: the moment the app is backgrounded the system may
    /// suspend it, and it may terminate the process outright to reclaim memory — without warning,
    /// and without running any pending work. A customer who adds a pizza and immediately switches
    /// apps would lose it.
    ///
    /// `scenePhase` is the notification that this is about to happen; `RootView` observes it and
    /// calls this. It is the closest native analogue to the web's `visibilitychange`.
    ///
    /// The returned `Task` is deliberately *not* awaited by the caller. `scenePhase` changes
    /// synchronously and the system gives a short, unguaranteed window afterwards — this races to
    /// use it rather than pretending it can block.
    func flushPendingWrites() {
        guard isHydrated else { return }
        persistTask?.cancel()
        persistTask = Task { await self.persist() }
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
