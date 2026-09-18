import Foundation
import Observation

/// The builder's selections and the live price they produce.
///
/// ## Why this screen has a view model when `HomeView` does not
///
/// There is a rule worth stating: a view model earns its place when there is state with *rules*, or
/// derived values worth testing. Here there are both — four interacting selections, a price that
/// falls out of them, and a topping list that has to be grouped and toggled. Pulling that out
/// leaves the view describing layout and nothing else, and it means the pricing can be asserted on
/// without rendering anything.
///
/// Drinks reuse this same model and sheet, and only get the size step. One type rather than two
/// near-identical ones that drift the moment a field is added to one of them.
@MainActor
@Observable
final class PizzaBuilderViewModel {
    let product: Product

    var selectedSize: SizeName
    var selectedCrustID: UUIDString?
    var quantity: Int = 1

    /// A `Set`, not an array. Membership is O(1) rather than O(n) on every chip's redraw, and — more
    /// importantly — a set cannot contain the same topping twice, so "toggled on twice" is not a
    /// state this type can reach.
    private(set) var selectedToppingIDs: Set<UUIDString> = []

    private let catalogue: MenuStore.Catalogue

    init(product: Product, catalogue: MenuStore.Catalogue) {
        self.product = product
        self.catalogue = catalogue

        /*
         * Defaults are chosen in the initialiser, from the product itself.
         *
         * Medium is the intended default, but a product that does not offer it must not open on a
         * size it does not have — the price would read as $0.00 and "Add to cart" would put a
         * zero-priced line in the basket. Falling back to the first available size is the correct
         * behaviour for every product, including the ones that only have one.
         */
        let sizes = product.sizes.map(\.size)
        self.selectedSize = sizes.contains(.medium) ? .medium : (sizes.first ?? .medium)
        self.selectedCrustID = product.type == .pizza ? catalogue.crusts.first?.id : nil
    }

    var isPizza: Bool { product.type == .pizza }

    var crusts: [Crust] { catalogue.crusts }

    var selectedCrust: Crust? {
        guard isPizza else { return nil }
        return catalogue.crust(id: selectedCrustID)
    }

    var selectedToppings: [Topping] {
        guard isPizza else { return [] }
        // Filtered from the catalogue rather than collected from the set, so the result is in menu
        // order every time. Iterating a `Set` gives an arbitrary order that changes between runs,
        // and a cart line whose toppings shuffle on each redraw looks broken.
        return catalogue.toppings.filter { selectedToppingIDs.contains($0.id) }
    }

    var sizeSegments: [SegmentedPicker<SizeName>.Segment] {
        product.sizes.map { size in
            .init(value: size.size, label: size.size.displayName, subtitle: Money.format(size.price))
        }
    }

    /// Toppings grouped by category, in a fixed order, skipping any group the menu has none of.
    var toppingGroups: [(title: String, category: ToppingCategory, toppings: [Topping])] {
        let titles: [(String, ToppingCategory)] = [
            ("Meats", .meat), ("Veggies", .veggie), ("Cheeses", .cheese),
        ]

        return titles.compactMap { title, category in
            let inGroup = catalogue.toppings.filter { $0.category == category }
            return inGroup.isEmpty ? nil : (title, category, inGroup)
        }
    }

    // MARK: - Pricing

    /// Price of one unit, as currently configured.
    ///
    /// Computed rather than stored. A stored `unitPrice` updated from each setter is four places
    /// that can forget, and the failure mode — a total that is briefly wrong after a tap — is
    /// exactly the kind of bug that survives review. A computed property cannot be stale.
    var unitPrice: Double {
        let base = product.price(for: selectedSize) ?? 0
        let toppingsTotal = selectedToppings.reduce(0) { $0 + $1.price }
        return Money.rounded(base + (selectedCrust?.priceDelta ?? 0) + toppingsTotal)
    }

    var totalPrice: Double { Money.rounded(unitPrice * Double(quantity)) }

    // MARK: - Commands

    func isSelected(_ topping: Topping) -> Bool { selectedToppingIDs.contains(topping.id) }

    func toggle(_ topping: Topping) {
        if selectedToppingIDs.contains(topping.id) {
            selectedToppingIDs.remove(topping.id)
        } else {
            selectedToppingIDs.insert(topping.id)
        }
    }

    /// Adds the configured item to the cart and returns the confirmation to show.
    ///
    /// Returning the message rather than reaching for the toast center keeps this type free of UI
    /// dependencies — it can be constructed and exercised in a test with nothing but a catalogue
    /// and a cart store.
    func addToCart(using cart: CartStore) -> String {
        cart.add(
            product: product,
            size: selectedSize,
            crust: selectedCrust,
            toppings: selectedToppings,
            quantity: quantity
        )
        return "\(quantity) × \(product.name) added to your cart"
    }
}
