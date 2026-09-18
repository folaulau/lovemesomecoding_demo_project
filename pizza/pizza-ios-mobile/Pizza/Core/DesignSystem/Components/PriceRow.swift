import SwiftUI

/// One line of an order summary: a label on the left, money on the right.
struct PriceRow: View {
    let label: String
    let amount: Double
    var isEmphasised = false

    var body: some View {
        HStack {
            Text(label)
            Spacer(minLength: Spacing.md)
            Text(Money.format(amount))
                // Digits that do not shift width as the total changes. Without this the decimal
                // point jitters left and right while a stepper is held down, because the
                // proportional "1" is narrower than the "8" replacing it.
                .monospacedDigit()
        }
        .textStyle(
            isEmphasised ? .subheading : .caption,
            tone: isEmphasised ? .standard : .muted
        )
        .padding(.top, isEmphasised ? Spacing.sm : 0)
        .padding(.vertical, 3)
        /*
         * One accessibility element, not two. Without this, VoiceOver stops on "Total" and then on
         * "$24.16" as unrelated items; with it, the row is announced as a single "Total, $24.16".
         */
        .accessibilityElement(children: .combine)
    }
}
