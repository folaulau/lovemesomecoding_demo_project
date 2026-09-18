import SwiftUI

/// A hairline rule.
///
/// The height is one *device pixel*, not one point. On a 3× screen a 1pt line is three physical
/// pixels and reads as a bar rather than a rule; dividing by the screen scale gives the thinnest
/// line the display can actually draw — what `StyleSheet.hairlineWidth` means in React Native and
/// what SwiftUI's own `Divider` does internally.
struct HairlineDivider: View {
    var isSpaced = true

    var body: some View {
        Rectangle()
            .fill(Theme.colors.border)
            .frame(height: 1 / UIScreen.main.scale)
            .padding(.vertical, isSpaced ? Spacing.md : 0)
    }
}
