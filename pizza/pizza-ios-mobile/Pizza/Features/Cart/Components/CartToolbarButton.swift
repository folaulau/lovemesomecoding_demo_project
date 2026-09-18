import SwiftUI

/// The cart button in the navigation bar, with its item-count badge.
///
/// It reads `isHydrated` as well as the count, because the saved cart is fetched asynchronously at
/// launch. Rendering "0" during that window and then popping to "3" is a small thing that makes an
/// app feel broken; showing no badge until the truth is known does not.
@MainActor
struct CartToolbarButton: View {
    @Environment(CartStore.self) private var cart

    let action: () -> Void

    private var count: Int { cart.totals.itemCount }
    private var showsBadge: Bool { cart.isHydrated && count > 0 }

    var body: some View {
        Button(action: action) {
            Image(systemName: "cart")
                .font(.system(size: FontSize.md, weight: .semibold))
                .overlay(alignment: .topTrailing) {
                    if showsBadge {
                        Text(count > 9 ? "9+" : "\(count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Theme.colors.onPrimary)
                            .padding(.horizontal, 4)
                            .frame(minWidth: 18, minHeight: 18)
                            .background(Theme.colors.primary, in: Capsule())
                            // Pushed clear of the glyph. `offset` rather than padding, so the
                            // badge does not enlarge the button's layout frame and shift the title.
                            .offset(x: 10, y: -8)
                    }
                }
        }
        .accessibilityLabel(
            showsBadge
                ? "Open cart, \(count) \(count == 1 ? "item" : "items")"
                : "Open cart, empty"
        )
    }
}
