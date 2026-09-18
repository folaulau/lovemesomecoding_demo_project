import Foundation

/// What a cart costs, as far as the device is concerned.
///
/// Pure, and deliberately free of SwiftUI, networking and storage. Nothing here imports a view or
/// performs I/O, which is what makes the whole file unit-testable in milliseconds — and it is the
/// part of the app most worth testing, because it is the part a customer checks.
///
/// ⚠️ Every figure produced here is a **preview**. The server recomputes all of it when the order
/// is placed. See `Money` for why that matters more than the arithmetic.
enum CartPricing {
    /// Both rates are the app's copy of a server-side constant. They are duplicated knowingly: the
    /// alternative is a round trip before the cart can show a total, and a stale rate shows a
    /// preview that is a few cents off rather than a wrong charge — the order is priced server-side
    /// either way.
    static let taxRate = 0.085
    static let deliveryFee = 3.99

    /// Price of ONE unit of a cart line: base size price + crust surcharge + toppings.
    static func unitPrice(of item: CartItem) -> Double {
        let toppingsTotal = item.toppings.reduce(0) { $0 + $1.price }
        return Money.rounded(item.basePrice + item.crustPriceDelta + toppingsTotal)
    }

    static func lineTotal(of item: CartItem) -> Double {
        Money.rounded(unitPrice(of: item) * Double(item.quantity))
    }

    static func totals(for items: [CartItem], orderType: OrderType) -> CartTotals {
        let subtotal = Money.rounded(items.reduce(0) { $0 + lineTotal(of: $1) })

        // Pickup has no delivery fee, and neither does an empty cart — a $3.99 "total" for nothing
        // would be absurd, and it is the state the cart is in every time the app is first opened.
        let deliveryFee = (orderType == .delivery && subtotal > 0) ? Self.deliveryFee : 0
        let tax = Money.rounded(subtotal * taxRate)

        return CartTotals(
            subtotal: subtotal,
            tax: tax,
            deliveryFee: deliveryFee,
            total: Money.rounded(subtotal + tax + deliveryFee),
            itemCount: items.reduce(0) { $0 + $1.quantity }
        )
    }
}

/// The four money figures and the badge count, computed together.
///
/// One value rather than five separate computed properties, because they are one calculation: a
/// caller that reads `subtotal` and `total` from two different passes over the cart can, in
/// principle, read them either side of a change and display a pair that never coexisted.
struct CartTotals: Equatable {
    let subtotal: Double
    let tax: Double
    let deliveryFee: Double
    let total: Double
    let itemCount: Int

    static let empty = CartTotals(subtotal: 0, tax: 0, deliveryFee: 0, total: 0, itemCount: 0)
}
