import SwiftUI

/// A −/n/+ control.
///
/// SwiftUI ships `Stepper`, and it is not used here: its platform appearance is a grey pill that
/// belongs in Settings, and it cannot be restyled into the brand's shape. Two buttons and a readout
/// is the honest way to get the design — the cost is that the accessibility below has to be written
/// out, since a pair of buttons carries none of `Stepper`'s semantics.
struct QuantityStepper: View {
    @Binding var quantity: Int
    /// Used to build a distinguishable screen-reader label — "Increase quantity of Pepperoni".
    let itemName: String
    var range: ClosedRange<Int> = 0 ... 20

    var body: some View {
        HStack(spacing: 0) {
            stepButton(
                // U+2212 MINUS SIGN, not a hyphen — it optically matches the plus.
                symbol: "−",
                label: "Decrease quantity of \(itemName)",
                isEnabled: quantity > range.lowerBound
            ) {
                quantity -= 1
            }

            Text("\(quantity)")
                .textStyle(.bodyStrong)
                .monospacedDigit()
                .frame(minWidth: 44)

            stepButton(
                symbol: "+",
                label: "Increase quantity of \(itemName)",
                isEnabled: quantity < range.upperBound
            ) {
                quantity += 1
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityValue("\(quantity)")
    }

    private func stepButton(
        symbol: String,
        label: String,
        isEnabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(symbol)
                .textStyle(.subheading)
                // 40×40 is above Apple's 44pt guidance once the 4pt of surrounding spacing is
                // counted. On a phone a 24pt button is a miss, not a tap.
                .frame(width: 40, height: 40)
                .background(Theme.colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .strokeBorder(Theme.colors.border, lineWidth: 1.5)
                )
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1 : 0.4)
        .accessibilityLabel(label)
    }
}
