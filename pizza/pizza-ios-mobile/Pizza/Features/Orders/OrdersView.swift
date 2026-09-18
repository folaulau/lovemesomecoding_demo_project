import SwiftUI

/// The Orders tab: the customer's own history, gated behind sign-in.
@MainActor
struct OrdersView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(AuthStore.self) private var auth
    @Environment(AppRouter.self) private var router

    @State private var model: OrdersViewModel?

    var body: some View {
        RequireAuthentication {
            Group {
                if let model {
                    content(model: model)
                } else {
                    LoadingStateView(label: "Loading your orders…")
                }
            }
            .task {
                /*
                 * Built and loaded on every appearance of the signed-in branch.
                 *
                 * Unlike checkout, this deliberately re-fetches each time the tab is opened: an
                 * order placed a moment ago should be at the top of the list, and a history that
                 * only loads once is a list the customer cannot refresh without relaunching.
                 */
                let model = self.model ?? OrdersViewModel(repository: environment.orderRepository)
                self.model = model
                await model.load(showsLoadingState: model.state.value == nil)
            }
        }
        .navigationTitle("My orders")
    }

    @ViewBuilder
    private func content(model: OrdersViewModel) -> some View {
        switch model.state {
        case .idle, .loading:
            LoadingStateView(label: "Loading your orders…")

        case let .failed(message, isRetryable):
            ScreenContainer {
                ErrorStateView(
                    message: message,
                    retry: isRetryable ? { Task { await model.load() } } : nil
                )
            }

        case .empty:
            ScreenContainer {
                EmptyStateView(
                    emoji: "🧾",
                    title: "No orders yet",
                    message: "Your past orders will appear here.",
                    actionTitle: "Browse the menu"
                ) {
                    router.select(.menu)
                }
            }

        case let .loaded(orders):
            list(orders: orders, model: model)
        }
    }

    private func list(orders: [Order], model: OrdersViewModel) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.md) {
                if let email = auth.user?.email {
                    Text(email)
                        .textStyle(.caption, tone: .muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                ForEach(orders) { order in
                    Button {
                        router.push(.order(id: order.id))
                    } label: {
                        orderCard(order)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(accessibilityLabel(for: order))
                }
            }
            .padding(Spacing.lg)
        }
        .background(Theme.colors.background)
        /*
         * Pull-to-refresh. There is no reload button on a phone, so a list that fetches once and
         * never again is a list the customer cannot fix when something looks stale.
         */
        .refreshable { await model.load(showsLoadingState: false) }
    }

    private func orderCard(_ order: Order) -> some View {
        CardContainer {
            VStack(spacing: Spacing.sm) {
                HStack {
                    Text("\(order.shortID)…").textStyle(.mono, tone: .muted)
                    Spacer()
                    OrderStatusBadge(status: order.status)
                }

                HStack {
                    Text("\(OrderDateFormatter.short(order.createdAt)) · \(order.orderType.displayName.lowercased())")
                        .textStyle(.caption, tone: .muted)
                    Spacer()
                    Text(Money.format(order.total)).textStyle(.bodyStrong).monospacedDigit()
                }
            }
        }
    }

    private func accessibilityLabel(for order: Order) -> String {
        "Order \(order.shortID), \(order.status.displayName), \(Money.format(order.total))"
    }
}

/// Dates, formatted for a human.
///
/// ## Two formatters, and why both are needed
///
/// The API sends an ISO-8601 timestamp; a customer wants "18 Sep 2026" in *their* locale and time
/// zone. Parsing and formatting are therefore separate steps with separate configurations, and
/// conflating them is how an app ends up showing an ISO string to a customer or sending a localised
/// one to a server.
///
/// The parser is lenient because Spring's `LocalDateTime` serialises **without** a time zone
/// (`2026-09-18T18:24:00`), which `ISO8601DateFormatter` rejects by default. Falling back rather
/// than returning nil means a missing time zone costs a date, not a blank row.
enum OrderDateFormatter {
    private static let parser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let fallbackParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        // A fixed format needs a fixed locale, or a device set to a non-Gregorian calendar parses
        // it wrongly. This is the single most common date-parsing bug on iOS.
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private static let display: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static func short(_ isoString: String) -> String {
        guard let date = parse(isoString) else { return isoString }
        return display.string(from: date)
    }

    static func parse(_ isoString: String) -> Date? {
        parser.date(from: isoString) ?? fallbackParser.date(from: isoString)
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return NavigationStack {
        OrdersView()
            .environment(environment)
            .environment(environment.auth)
            .environment(AppRouter())
    }
}
#endif
