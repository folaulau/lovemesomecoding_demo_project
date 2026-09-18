import SwiftUI

/// A white surface with a soft shadow — the web app's `.card.border-0.shadow-sm`.
///
/// The shadow comes from `Theme` rather than being written here, so every raised surface in the app
/// shares one definition. On React Native this indirection is load-bearing (iOS and Android express
/// a shadow with completely different properties); on iOS it is merely good hygiene.
struct CardContainer<Content: View>: View {
    /// Removes the internal padding, for a card whose child manages its own edges (e.g. an image
    /// that has to reach the rounded corner).
    var isFlush = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(isFlush ? 0 : Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.colors.surface)
            /*
             * `.clipShape` before `.cardShadow()` matters. Modifier order in SwiftUI is
             * inside-out: clipping first rounds the surface and *then* the shadow is drawn from
             * that rounded silhouette. Reversing them clips the shadow away along with the corners,
             * which looks like the shadow modifier simply did nothing.
             */
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .cardShadow()
    }
}

/// A titled block inside a card — the shape almost every screen repeats.
struct CardSection<Content: View>: View {
    let title: String
    var accessory: AnyView?
    @ViewBuilder let content: () -> Content

    init(_ title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.accessory = nil
        self.content = content
    }

    init(_ title: String, accessory: some View, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.accessory = AnyView(accessory)
        self.content = content
    }

    var body: some View {
        CardContainer {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack(spacing: Spacing.sm) {
                    Text(title).textStyle(.label, tone: .muted)
                    if let accessory {
                        Spacer(minLength: Spacing.sm)
                        accessory
                    }
                }
                content()
            }
        }
    }
}
