import SwiftUI

/// A row of mutually exclusive options — delivery vs pickup, and the menu's type filter.
///
/// SwiftUI's own `Picker(.segmented)` exists and is not used, for the same reason `Stepper` is not:
/// it renders as a `UISegmentedControl` whose colours are only partly controllable, and it has no
/// room for the "$3.99 fee" subtitle the checkout needs under each option.
///
/// Generic over the value so `selection` is a `OrderType`, not a bare `String` — a typo at a call
/// site is a compile error rather than a segment that silently never matches.
struct SegmentedPicker<Value: Hashable>: View {
    struct Segment: Identifiable {
        let value: Value
        let label: String
        var subtitle: String?

        var id: Value { value }
    }

    let segments: [Segment]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(segments) { segment in
                let isSelected = segment.value == selection

                Button {
                    selection = segment.value
                } label: {
                    VStack(spacing: 2) {
                        Text(segment.label)
                            .textStyle(.bodyStrong)
                            .foregroundStyle(isSelected ? Theme.colors.onPrimary : Theme.colors.textMuted)
                        if let subtitle = segment.subtitle {
                            Text(subtitle)
                                .textStyle(.caption)
                                .foregroundStyle(
                                    isSelected ? Theme.colors.onPrimaryMuted : Theme.colors.textSubtle
                                )
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.sm)
                    .padding(.horizontal, Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.sm)
                            .fill(isSelected ? Theme.colors.primary : .clear)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                /*
                 * `.isToggle` + `.isSelected` is what makes VoiceOver say "Delivery, selected"
                 * instead of reading two unrelated buttons. Without it a customer using VoiceOver
                 * cannot tell which mode their order is in.
                 */
                .accessibilityAddTraits(.isToggle)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
                .accessibilityLabel(segment.subtitle.map { "\(segment.label), \($0)" } ?? segment.label)
            }
        }
        .padding(Spacing.xs)
        .background(Theme.colors.surfaceAlt, in: RoundedRectangle(cornerRadius: Radius.md))
    }
}
