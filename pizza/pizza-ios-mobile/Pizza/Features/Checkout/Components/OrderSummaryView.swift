import SwiftUI

/// The order summary.
///
/// It takes EITHER the device's cart or a server-created order, and the distinction is the point:
/// before the order exists these are the app's own estimated figures, and the moment it exists the
/// server's numbers replace them. Server prices are authoritative — the device's arithmetic is only
/// ever a preview.
@MainActor
struct OrderSummaryView: View {
    let items: [CartItem]
    let orderType: OrderType
    let totals: CartTotals
    /// Once set, every figure below comes from the server instead.
    var order: Order?

    var body: some View {
        CardContainer {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("Order summary · \(orderType.displayName.lowercased())")
                    .textStyle(.label, tone: .muted)

                VStack(alignment: .leading, spacing: Spacing.xs) {
                    if let order {
                        ForEach(order.items) { item in
                            summaryLine(
                                quantity: item.quantity,
                                name: item.productName,
                                detail: item.configurationSummary,
                                amount: item.lineTotal
                            )
                        }
                    } else {
                        ForEach(items) { item in
                            summaryLine(
                                quantity: item.quantity,
                                name: item.productName,
                                detail: item.configurationSummary.lowercased(),
                                amount: CartPricing.lineTotal(of: item)
                            )
                        }
                    }
                }

                HairlineDivider(isSpaced: false)

                VStack(spacing: 0) {
                    PriceRow(label: "Subtotal", amount: money.subtotal)
                    PriceRow(label: "Tax", amount: money.tax)
                    if money.deliveryFee > 0 {
                        PriceRow(label: "Delivery", amount: money.deliveryFee)
                    }
                    PriceRow(label: "Total", amount: money.total, isEmphasised: true)
                }
            }
        }
    }

    private var money: (subtotal: Double, tax: Double, deliveryFee: Double, total: Double) {
        if let order {
            return (order.subtotal, order.tax, order.deliveryFee, order.total)
        }
        return (totals.subtotal, totals.tax, totals.deliveryFee, totals.total)
    }

    private func summaryLine(
        quantity: Int,
        name: String,
        detail: String,
        amount: Double
    ) -> some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Group {
                Text("\(quantity) × \(name)")
                    + Text(" (\(detail))").foregroundColor(Theme.colors.textMuted)
            }
            .textStyle(.caption)
            .lineLimit(2)

            Spacer(minLength: Spacing.sm)

            Text(Money.format(amount)).textStyle(.caption).monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
#Preview {
    let items = [SampleData.cartItem(quantity: 2), SampleData.cartItem(product: SampleData.cola, toppings: [])]
    return OrderSummaryView(
        items: items,
        orderType: .delivery,
        totals: CartPricing.totals(for: items, orderType: .delivery)
    )
    .padding()
    .background(Theme.colors.background)
}
#endif
