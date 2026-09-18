import SwiftUI

/// The three states every data screen has: loading, empty, failed.
///
/// They live in one file because they are one decision, not three. A screen that renders a spinner
/// but forgets the failure branch shows an eternal spinner when the backend is down — the single
/// most common bug in a fetch-and-render app, and the reason `ViewState` makes the three a closed
/// enum rather than a convention each screen re-implements.
struct LoadingStateView: View {
    var label = "Loading…"

    var body: some View {
        VStack(spacing: Spacing.sm) {
            ProgressView()
                .progressViewStyle(.circular)
                .tint(Theme.colors.primary)
            Text(label).textStyle(.caption, tone: .muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xxxl)
        // A spinner is invisible to VoiceOver without this; the label is the only announcement.
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
    }
}

struct EmptyStateView: View {
    var emoji = "🍕"
    let title: String
    var message: String?
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: Spacing.sm) {
            Text(emoji)
                .font(.system(size: 44))
                .accessibilityHidden(true)
            Text(title)
                .textStyle(.subheading)
                .multilineTextAlignment(.center)
            if let message {
                Text(message)
                    .textStyle(.caption, tone: .muted)
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.pizzaPrimary)
                    .padding(.top, Spacing.md)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xxxl)
    }
}

struct ErrorStateView: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            /*
             * The two text lines are combined into ONE accessibility element so VoiceOver announces
             * "Something went wrong, could not load the menu" as a single stop rather than two.
             *
             * The retry button is deliberately OUTSIDE that group. Combining children hides them
             * from the accessibility tree, so a button nested inside would become unreachable —
             * the classic way this pattern goes wrong.
             */
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Something went wrong").textStyle(.bodyStrong, tone: .danger)
                Text(message).textStyle(.caption, tone: .muted)
            }
            .accessibilityElement(children: .combine)

            if let retry {
                Button("Try again", action: retry)
                    .buttonStyle(.pizza(.outline, size: .small))
                    .padding(.top, Spacing.sm)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.lg)
        .background(Theme.colors.dangerSoft, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Theme.colors.danger, lineWidth: 1)
        )
    }
}
