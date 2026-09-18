import SwiftUI

/// The menu: a type filter and a two-column grid, with the builder opening over it.
@MainActor
struct MenuView: View {
    /// The filter, including the "everything" case.
    ///
    /// Modelling "no filter" as a *case* rather than as `ProductType?` means the segmented picker
    /// binds to a non-optional and the `switch` below is exhaustive. An optional would push a
    /// `?? .all` into every use site.
    enum Filter: Hashable, CaseIterable {
        case all
        case pizza
        case drink

        var title: String {
            switch self {
            case .all: "Everything"
            case .pizza: "Pizzas"
            case .drink: "Drinks"
            }
        }

        func matches(_ product: Product) -> Bool {
            switch self {
            case .all: true
            case .pizza: product.type == .pizza
            case .drink: product.type == .drink
            }
        }
    }

    @Environment(MenuStore.self) private var menu

    /// Screen-local state, kept out of any store.
    ///
    /// Which filter is showing and which product is being built are of interest to this screen and
    /// nothing else. Putting them in a store would re-render every other consumer when a filter
    /// changes and would make two instances of this screen share a selection. "Only shared state
    /// goes in the store" is the rule, and it applies just as much to an `@Observable` store as it
    /// does to Redux.
    @State private var filter: Filter = .all
    @State private var productBeingBuilt: Product?

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.md),
        GridItem(.flexible(), spacing: Spacing.md),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                SegmentedPicker(
                    segments: Filter.allCases.map { .init(value: $0, label: $0.title) },
                    selection: $filter
                )

                content
            }
            .padding(Spacing.lg)
        }
        .background(Theme.colors.background)
        .navigationTitle("Menu")
        .refreshable {
            // `.refreshable` keeps the system spinner on screen for exactly as long as this
            // `await` takes, which is why the store exposes an awaitable reload rather than a
            // fire-and-forget one.
            await menu.reload()
        }
        .sheet(item: $productBeingBuilt) { product in
            /*
             * The builder's state is reset by IDENTITY, not by an effect.
             *
             * `.sheet(item:)` creates a fresh `PizzaBuilderSheet` for each non-nil product, so
             * every open starts from that product's defaults. The React Native version has to
             * achieve the same thing by bumping a `key` counter, with a long comment explaining why
             * an effect that copies props into state renders the previous pizza for one frame.
             * Here it is simply how the API works.
             */
            PizzaBuilderSheet(product: product) { productBeingBuilt = nil }
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch menu.state {
        case .idle, .loading:
            LoadingStateView(label: "Loading the menu…")

        case let .failed(message, isRetryable):
            ErrorStateView(message: message, retry: isRetryable ? { menu.load() } : nil)

        case .empty:
            EmptyStateView(title: "Nothing on the menu", message: "The kitchen has not published anything yet.")

        case let .loaded(catalogue):
            let visible = catalogue.products.filter(filter.matches)

            if visible.isEmpty {
                EmptyStateView(title: "Nothing here yet", message: "No products match this filter.")
            } else {
                /*
                 * `LazyVGrid`, not `VStack` + `ForEach`.
                 *
                 * "Lazy" means rows are built only as they approach the viewport. With a dozen
                 * products the difference is invisible; the habit is what keeps a 500-item menu
                 * from constructing 500 views before the first one is on screen. The eager
                 * container is `VStack`, and reaching for it here is the single most common
                 * SwiftUI list performance mistake.
                 */
                LazyVGrid(columns: columns, spacing: Spacing.md) {
                    ForEach(visible) { product in
                        ProductCardView(product: product) { productBeingBuilt = product }
                    }
                }
            }
        }
    }
}

#if DEBUG
#Preview("Loaded") {
    let environment = AppEnvironment.preview()
    return NavigationStack {
        MenuView()
            .environment(environment.menu)
            .environment(environment.cart)
            .environment(environment.toasts)
    }
}

#Preview("Failed") {
    let environment = AppEnvironment.preview(
        catalogue: PreviewCatalogRepository(error: APIError.network(message: "The backend is not running."))
    )
    return NavigationStack {
        MenuView()
            .environment(environment.menu)
            .environment(environment.cart)
            .environment(environment.toasts)
    }
}
#endif
