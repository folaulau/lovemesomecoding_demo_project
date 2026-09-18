import SwiftUI

/// One line of the cart: what it is, what it costs, and how to change or remove it.
@MainActor
struct CartLineRow: View {
    let item: CartItem
    let onQuantityChange: (Int) -> Void
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(alignment: .top, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.productName).textStyle(.bodyStrong)
                    Text(item.configurationSummary).textStyle(.caption, tone: .muted)

                    if !item.toppings.isEmpty {
                        FlowLayout(spacing: Spacing.xs, lineSpacing: Spacing.xs) {
                            ForEach(item.toppings) { topping in
                                StatusBadge(label: topping.name)
                            }
                        }
                        .padding(.top, Spacing.xs)
                    }

                    Text("\(Money.format(CartPricing.unitPrice(of: item))) each")
                        .textStyle(.caption, tone: .subtle)
                        .padding(.top, Spacing.xs)
                }

                Spacer(minLength: Spacing.sm)

                Text(Money.format(CartPricing.lineTotal(of: item)))
                    .textStyle(.bodyStrong)
                    .monospacedDigit()
            }

            HStack {
                QuantityStepper(
                    quantity: Binding(get: { item.quantity }, set: onQuantityChange),
                    itemName: item.productName,
                    range: 0 ... 20
                )

                Spacer()

                Button("Remove", action: onRemove)
                    .font(.system(size: FontSize.sm, weight: .semibold))
                    .foregroundStyle(Theme.colors.danger)
                    .accessibilityLabel("Remove \(item.productName)")
            }
        }
        .padding(.vertical, Spacing.md)
    }
}

#if DEBUG
#Preview {
    VStack {
        CartLineRow(item: SampleData.cartItem(quantity: 2), onQuantityChange: { _ in }, onRemove: {})
        HairlineDivider()
        CartLineRow(item: SampleData.cartItem(product: SampleData.cola, toppings: []), onQuantityChange: { _ in }, onRemove: {})
    }
    .padding()
    .background(Theme.colors.background)
}
#endif
