import SwiftUI

/// The cart, in a bottom sheet.
///
/// The web app uses Bootstrap's Offcanvas, which slides in from the right. A phone has no room for
/// that: a bottom sheet is the platform-native shape, and it keeps the primary action within thumb
/// reach rather than at the top of the screen.
@MainActor
struct CartSheetView: View {
    @Environment(CartStore.self) private var cart
    @Environment(AppRouter.self) private var router

    private let orderTypeSegments: [SegmentedPicker<OrderType>.Segment] = OrderType.allCases.map {
        .init(value: $0, label: $0.displayName)
    }

    var body: some View {
        // `@Bindable` projects bindings out of an `@Observable` object — the replacement for
        // `@ObservedObject`'s `$` syntax, and what lets the picker below write `cart.orderType`
        // directly while every mutation still goes through the store's reducer.
        @Bindable var cart = cart

        SheetScaffold(title: "Your order", onClose: { router.dismissSheet() }) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                SegmentedPicker(segments: orderTypeSegments, selection: $cart.orderType)

                if cart.items.isEmpty {
                    EmptyStateView(
                        title: "Your cart is empty",
                        message: "Add a pizza to get started."
                    )
                } else {
                    lines
                }
            }
        } footer: {
            if !cart.items.isEmpty { summary }
        }
    }

    private var lines: some View {
        VStack(spacing: 0) {
            ForEach(Array(cart.items.enumerated()), id: \.element.id) { index, item in
                if index > 0 { HairlineDivider(isSpaced: false) }

                CartLineRow(
                    item: item,
                    onQuantityChange: { cart.setQuantity($0, for: item.lineID) },
                    onRemove: { cart.remove(lineID: item.lineID) }
                )
            }
        }
    }

    private var summary: some View {
        VStack(spacing: 0) {
            PriceRow(label: "Subtotal", amount: cart.totals.subtotal)
            PriceRow(label: "Tax", amount: cart.totals.tax)
            if cart.totals.deliveryFee > 0 {
                PriceRow(label: "Delivery", amount: cart.totals.deliveryFee)
            }
            PriceRow(label: "Total", amount: cart.totals.total, isEmphasised: true)

            Button("Checkout") {
                /*
                 * Dismiss first, then navigate.
                 *
                 * A sheet still presented over a pushed screen swallows every tap on it. The
                 * router dismisses synchronously and the push happens on the same run loop pass,
                 * so there is no visible gap — but the order matters.
                 */
                router.dismissSheet()
                router.push(.checkout)
            }
            .buttonStyle(.pizza(.primary, size: .large, fullWidth: true))
            .padding(.top, Spacing.lg)

            Text("Prices are confirmed by the server at checkout.")
                .textStyle(.caption, tone: .subtle)
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.sm)
        }
        .padding(.bottom, Spacing.sm)
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return Color.clear.sheet(isPresented: .constant(true)) {
        CartSheetView()
            .environment(environment.cart)
            .environment(AppRouter())
    }
}
#endif
