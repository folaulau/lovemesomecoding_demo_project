import SwiftUI

/// A toggleable pill — one topping, or one crust, in the builder. The web app's `.topping-chip`.
///
/// ## The accessibility part people skip
///
/// A chip is visually obvious and semantically invisible: without the two modifiers at the bottom,
/// VoiceOver announces "Pepperoni, button" and never says whether it is selected. `.isToggle` plus
/// `.isSelected` is what makes it read as "Pepperoni, selected, toggle button" — and it is the
/// difference between a usable form and an unusable one for anyone who cannot see the fill colour.
struct ToppingChip: View {
    let label: String
    var detail: String?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.xs) {
                Text(label)
                    .font(.system(size: FontSize.sm, weight: isSelected ? .semibold : .medium))
                if let detail {
                    Text(detail)
                        .font(.system(size: FontSize.sm))
                        .opacity(0.7)
                }
            }
            .foregroundStyle(isSelected ? Theme.colors.onPrimary : Theme.colors.text)
            .padding(.vertical, Spacing.sm)
            .padding(.horizontal, Spacing.md)
            .background(isSelected ? Theme.colors.primary : Theme.colors.surface, in: Capsule())
            .overlay(
                Capsule().strokeBorder(
                    isSelected ? Theme.colors.primary : Theme.colors.border,
                    lineWidth: 1.5
                )
            )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isToggle)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        .accessibilityLabel(detail.map { "\(label), \($0)" } ?? label)
    }
}
