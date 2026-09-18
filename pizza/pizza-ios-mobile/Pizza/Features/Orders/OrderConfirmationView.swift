import SwiftUI

/// The receipt: what was ordered, where it is going, and what the server says about the payment.
@MainActor
struct OrderConfirmationView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(AppRouter.self) private var router

    let orderID: UUIDString

    @State private var model: OrderConfirmationViewModel?

    var body: some View {
        Group {
            switch model?.state {
            case .none, .idle, .loading:
                LoadingStateView(label: "Loading your order…")

            case let .failed(message, _):
                ScreenContainer { ErrorStateView(message: message) }

            case .empty:
                ScreenContainer {
                    EmptyStateView(emoji: "🧾", title: "That order could not be found.")
                }

            case let .loaded(order):
                receipt(order: order, hasStoppedPolling: model?.hasStoppedPolling ?? false)
            }
        }
        .navigationTitle("Your order")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            let model = OrderConfirmationViewModel(repository: environment.orderRepository)
            self.model = model
            // Cancelled automatically when this view goes away — see the view model's comment.
            await model.startPolling(orderID: orderID)
        }
    }

    private func receipt(order: Order, hasStoppedPolling: Bool) -> some View {
        ScreenContainer {
            hero(order: order, hasStoppedPolling: hasStoppedPolling)
            destinationCard(order: order)
            itemsCard(order: order)

            Button("Back to the menu") {
                router.popToRoot()
                router.select(.menu)
            }
            .buttonStyle(.pizza(.outline, size: .medium, fullWidth: true))
        }
    }

    private func hero(order: Order, hasStoppedPolling: Bool) -> some View {
        VStack(spacing: Spacing.md) {
            Text("🍕").font(.system(size: 52)).accessibilityHidden(true)

            Text(order.status.isSettling ? "Confirming your payment…" : "Order confirmed")
                .textStyle(.title)
                .multilineTextAlignment(.center)

            Text(order.id)
                .textStyle(.mono, tone: .muted)
                .multilineTextAlignment(.center)
                // Long-press to copy, which is what a customer does before emailing support.
                .textSelection(.enabled)

            OrderStatusBadge(status: order.status)

            if order.status.isSettling {
                Text(
                    hasStoppedPolling
                        ? "This is taking longer than usual. Your receipt will arrive by email once the payment settles."
                        : "Checking with the payment provider. This usually takes a few seconds."
                )
                .textStyle(.caption, tone: .muted)
                .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.lg)
    }

    private func destinationCard(order: Order) -> some View {
        CardSection(order.orderType == .delivery ? "Delivering to" : "Pick up") {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text(order.customerName).textStyle(.bodyStrong)

                if order.orderType == .delivery, let address = order.formattedAddress {
                    Text(address).textStyle(.caption, tone: .muted)
                } else {
                    Text("Collect in store — no delivery fee.").textStyle(.caption, tone: .muted)
                }

                Text("Receipt to \(order.email)").textStyle(.caption, tone: .muted)
            }
        }
    }

    private func itemsCard(order: Order) -> some View {
        CardSection("Items") {
            VStack(alignment: .leading, spacing: Spacing.md) {
                ForEach(order.items) { item in
                    HStack(alignment: .top, spacing: Spacing.md) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(item.quantity) × \(item.productName)").textStyle(.caption)
                            Text(item.configurationSummary).textStyle(.caption, tone: .muted)
                        }
                        Spacer(minLength: Spacing.sm)
                        Text(Money.format(item.lineTotal)).textStyle(.caption).monospacedDigit()
                    }
                    .accessibilityElement(children: .combine)
                }

                HairlineDivider(isSpaced: false)

                // These are the SERVER's figures. They are the ones that count.
                VStack(spacing: 0) {
                    PriceRow(label: "Subtotal", amount: order.subtotal)
                    PriceRow(label: "Tax", amount: order.tax)
                    if order.deliveryFee > 0 {
                        PriceRow(label: "Delivery", amount: order.deliveryFee)
                    }
                    PriceRow(label: "Total", amount: order.total, isEmphasised: true)
                }

                if let paidWith = order.paidWithDescription {
                    Text(paidWith).textStyle(.caption, tone: .muted)
                }
            }
        }
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return NavigationStack {
        OrderConfirmationView(orderID: SampleData.order.id)
            .environment(environment)
            .environment(AppRouter())
    }
}
#endif
