import Foundation

/// The cart's state, as one value.
///
/// Keeping the items and the order type together — rather than as two properties on the store —
/// means "the cart" is a thing that can be passed to a pure function, compared, and asserted on.
struct CartState: Equatable {
    var items: [CartItem]
    var orderType: OrderType

    static let initial = CartState(items: [], orderType: .delivery)

    var isEmpty: Bool { items.isEmpty }
}

/// Every way the cart can change.
///
/// An enum with associated values is Swift's discriminated union, and it buys the same thing the
/// TypeScript version does: `switch` over it is exhaustive, so adding a case makes the reducer stop
/// compiling until it is handled — rather than the cart silently ignoring it at runtime.
enum CartAction: Equatable {
    case add(CartItem)
    case remove(lineID: UUID)
    case setQuantity(lineID: UUID, quantity: Int)
    case setOrderType(OrderType)
    /// Replace everything with what the server had saved.
    case hydrate(CartState)
    case clear
}

/// The cart's state machine — pure, and deliberately free of everything else.
///
/// ## Why a reducer, when SwiftUI already has `@Observable`
///
/// The store next door could mutate `items` directly and SwiftUI would redraw. It does not, for
/// three reasons that matter more as an app grows:
///
/// 1. **The rules are testable without the app.** `reduce` is a function from a value to a value.
///    Its tests construct a state, apply an action, and assert on the result — no view, no network,
///    no async, no `@MainActor`. The suite for this file runs in milliseconds.
/// 2. **Every mutation has a name.** "The quantity changed" is an event with a spelling, not an
///    assignment somewhere in a view's closure. When a cart ends up in a state nobody expected,
///    there is a finite list of things that could have caused it.
/// 3. **The store is left with one job.** Everything in `CartStore` is now effects — persistence,
///    hydration, the background flush — and none of it is tangled with the rules.
///
/// The cost is indirection, and it is a real cost. For four fields of screen-local form state a
/// reducer would be ceremony; for the cart, which four different screens read and three can change,
/// it pays for itself.
enum CartReducer {
    /// The same state plus the same action always produces the same result, and the input is never
    /// mutated — `state` is a value, so `var state = state` below copies it.
    static func reduce(_ state: CartState, _ action: CartAction) -> CartState {
        var state = state

        switch action {
        case let .add(item):
            if let index = state.items.firstIndex(where: { $0.hasSameConfiguration(as: item) }) {
                // Same configuration already in the cart: bump the quantity instead of adding a
                // second identical line, which is what a customer means by tapping "Add" twice.
                state.items[index].quantity += item.quantity
            } else {
                state.items.append(item)
            }

        case let .remove(lineID):
            state.items.removeAll { $0.lineID == lineID }

        case let .setQuantity(lineID, quantity):
            // Dropping to zero removes the line — it is what a customer expects from a "−" button,
            // and a cart line with quantity 0 is a state nothing downstream should have to handle.
            guard quantity > 0 else {
                state.items.removeAll { $0.lineID == lineID }
                break
            }
            guard let index = state.items.firstIndex(where: { $0.lineID == lineID }) else { break }
            state.items[index].quantity = quantity

        case let .setOrderType(orderType):
            state.orderType = orderType

        case let .hydrate(saved):
            state = saved

        case .clear:
            // The order type survives: a customer who chose pickup and then ordered has not asked
            // to switch back to delivery.
            state.items = []
        }

        return state
    }
}
