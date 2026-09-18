import SwiftUI

/// The chrome inside a bottom sheet: grabber, title, close button, scrolling body, pinned footer.
///
/// ## What SwiftUI gives, and what it does not
///
/// The *presentation* is entirely SwiftUI's: `.sheet(isPresented:)` plus `.presentationDetents`
/// produces a real sheet with a drag-to-dismiss gesture and the system's own animation. React Native
/// has to build that on top of `Modal`, and the web builds it on Bootstrap's Offcanvas. None of that
/// code exists here.
///
/// What is *not* free is the layout inside: a title row that stays put while a long topping list
/// scrolls under it, and a footer pinned above the safe area with the total and the primary action.
/// That is what this scaffold is.
///
/// `.presentationDragIndicator(.visible)` would draw the grabber, but only at the very top of the
/// sheet; drawing it here keeps it grouped with the title row, which is what the design asks for.
struct SheetScaffold<Content: View, Footer: View>: View {
    let title: String
    let onClose: () -> Void
    @ViewBuilder let content: () -> Content
    @ViewBuilder let footer: () -> Footer

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Theme.colors.border)
                .frame(width: 40, height: 4)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.md)
                // The grabber is decoration; a screen reader stopping on it wastes a swipe.
                .accessibilityHidden(true)

            HStack {
                Text(title)
                    .textStyle(.heading)
                    // Marks this as the element VoiceOver focuses when the sheet opens, and the
                    // one the rotor lists under "Headings".
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: FontSize.md, weight: .semibold))
                        .foregroundStyle(Theme.colors.textMuted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.md)

            ScrollView {
                content()
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, Spacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)

            let footerContent = footer()
            if !(Footer.self == EmptyView.self) {
                VStack(spacing: 0) {
                    HairlineDivider(isSpaced: false)
                    footerContent
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.md)
                }
                .background(Theme.colors.background)
            }
        }
        .background(Theme.colors.background)
    }
}

extension SheetScaffold where Footer == EmptyView {
    init(
        title: String,
        onClose: @escaping () -> Void,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.init(title: title, onClose: onClose, content: content) { EmptyView() }
    }
}
