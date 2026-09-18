import SwiftUI

/// One product in the menu grid.
///
/// ## What replaced `React.memo`
///
/// The React Native version wraps this component in `memo` and threads a `useCallback` down from the
/// list, because without both, opening the cart re-renders every card on screen.
///
/// SwiftUI needs neither. A `View` is a value, and the framework compares the old and new values
/// structurally before deciding to redraw — so a card whose `product` is unchanged is not
/// re-rendered even though its parent was. The memoisation is the framework's job, not the author's.
///
/// The obligation that *does* transfer is keeping the value cheap to compare: no closures over
/// large state, no non-`Equatable` reference types held as properties. Passing `product` and an
/// `onSelect` closure satisfies that.
@MainActor
struct ProductCardView: View {
    let product: Product
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 0) {
                thumbnail
                details
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .cardShadow()
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint(product.type == .pizza ? "Opens the pizza builder" : "Opens the size picker")
    }

    private var thumbnail: some View {
        Text(product.type == .pizza ? "🍕" : "🥤")
            .font(.system(size: 40))
            .frame(maxWidth: .infinity)
            .frame(height: 96)
            .background(Theme.colors.primarySoft)
            .accessibilityHidden(true)
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(product.name)
                .textStyle(.subheading)
                .lineLimit(1)

            Text(product.description)
                .textStyle(.caption, tone: .muted)
                /*
                 * A fixed two-line block, not just a line limit. Without the `minHeight` a
                 * one-line description makes its card shorter than the one beside it and the grid
                 * stops lining up — the native equivalent of the web's fixed-height clamp.
                 */
                .lineLimit(2, reservesSpace: true)

            HStack {
                priceLabel
                Spacer(minLength: Spacing.sm)
                Text(product.type == .pizza ? "Build it →" : "Add →")
                    .font(.system(size: FontSize.sm, weight: .semibold))
                    .foregroundStyle(Theme.colors.primary)
            }
            .padding(.top, Spacing.xs)
        }
        .padding(Spacing.md)
    }

    @ViewBuilder
    private var priceLabel: some View {
        if let cheapest = product.cheapestPrice {
            HStack(spacing: Spacing.xs) {
                Text("from").textStyle(.caption, tone: .muted)
                Text(Money.format(cheapest)).textStyle(.bodyStrong, tone: .primary)
            }
        } else {
            Text("Unavailable").textStyle(.caption, tone: .subtle)
        }
    }

    private var accessibilityLabel: String {
        var parts = [product.name]
        if let cheapest = product.cheapestPrice { parts.append("from \(Money.format(cheapest))") }
        parts.append(product.type == .pizza ? "Build it" : "Add to cart")
        return parts.joined(separator: ", ")
    }
}

#if DEBUG
#Preview {
    HStack(spacing: Spacing.md) {
        ProductCardView(product: SampleData.pepperoni) {}
        ProductCardView(product: SampleData.cola) {}
    }
    .padding()
    .background(Theme.colors.background)
}
#endif
