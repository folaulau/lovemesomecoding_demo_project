import SwiftUI

/// A small pill of status text — order status, "primary" on an address, a topping name.
struct StatusBadge: View {
    enum Tone {
        case neutral
        case primary
        case success
        case warning
        case info

        var background: Color {
            switch self {
            case .neutral: Theme.colors.surfaceAlt
            case .primary: Theme.colors.primarySoft
            case .success: Theme.colors.successSoft
            case .warning: Theme.colors.warningSoft
            case .info: Theme.colors.infoSoft
            }
        }

        var foreground: Color {
            switch self {
            case .neutral: Theme.colors.textMuted
            case .primary: Theme.colors.primary
            case .success: Theme.colors.success
            case .warning: Theme.colors.warning
            case .info: Theme.colors.info
            }
        }
    }

    let label: String
    var tone: Tone = .neutral

    var body: some View {
        Text(label)
            .font(.system(size: FontSize.xs, weight: .semibold))
            .foregroundStyle(tone.foreground)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 3)
            // `Capsule()` is SwiftUI's way of saying "fully rounded" — there is no `borderRadius:
            // 999` here, and hard-coding a large radius would break at an unusual Dynamic Type size.
            .background(tone.background, in: Capsule())
    }
}

/// Status → colour, as an exhaustive `switch`.
///
/// Exhaustiveness is the whole design: add a case to `OrderStatus` and this stops compiling until it
/// is handled. A dictionary lookup with a `?? .neutral` fallback would compile happily and quietly
/// render every new status grey.
struct OrderStatusBadge: View {
    let status: OrderStatus

    var body: some View {
        StatusBadge(label: status.displayName, tone: tone)
    }

    private var tone: StatusBadge.Tone {
        switch status {
        case .pendingPayment: .warning
        case .paid: .primary
        case .preparing: .info
        case .completed: .success
        case .cancelled: .neutral
        }
    }
}
