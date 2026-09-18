import SwiftUI

/// The checkout screen: details, then payment.
///
/// The view itself holds no business logic — it renders `model.step` and forwards intents. Every
/// rule about what is valid, what gets sent and what a payment outcome means lives in
/// `CheckoutViewModel`, where it can be tested without a screen.
@MainActor
struct CheckoutView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(CartStore.self) private var cart
    @Environment(AuthStore.self) private var auth
    @Environment(ToastCenter.self) private var toasts
    @Environment(AppRouter.self) private var router

    @State private var model: CheckoutViewModel?

    private let orderTypeSegments: [SegmentedPicker<OrderType>.Segment] = [
        .init(value: .delivery, label: "Delivery", subtitle: "\(Money.format(CartPricing.deliveryFee)) fee"),
        .init(value: .carryout, label: "Pickup", subtitle: "No fee"),
    ]

    var body: some View {
        Group {
            if let model {
                content(model: model)
            } else {
                // One frame at most, while the model is built in `.task` below.
                LoadingStateView(label: "Preparing checkout…")
            }
        }
        .navigationTitle("Checkout")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            /*
             * The view model is built here, not in `init`.
             *
             * `@Environment` is not readable from an initialiser — the property wrappers are not
             * populated until the view is in the hierarchy — and this model needs three
             * dependencies from the container. Building it in `.task` is the idiomatic answer, and
             * the `guard` keeps it to once per appearance rather than once per redraw.
             */
            guard model == nil else { return }

            let model = CheckoutViewModel(
                orderRepository: environment.orderRepository,
                profileRepository: environment.profileRepository,
                paymentGateway: environment.paymentGateway
            )
            model.prefill(from: auth.user)
            self.model = model

            await model.loadSavedAddresses(isAuthenticated: auth.isAuthenticated)
        }
    }

    @ViewBuilder
    private func content(model: CheckoutViewModel) -> some View {
        @Bindable var model = model

        switch model.step {
        case .collectingDetails where cart.items.isEmpty:
            ScreenContainer {
                EmptyStateView(
                    title: "Your cart is empty",
                    message: "Add a pizza before checking out.",
                    actionTitle: "Browse the menu"
                ) {
                    router.popToRoot()
                    router.select(.menu)
                }
            }

        case .collectingDetails:
            detailsStep(model: model)

        case let .awaitingPayment(created):
            paymentStep(model: model, created: created)
        }
    }

    // MARK: - Step 1

    private func detailsStep(model: CheckoutViewModel) -> some View {
        @Bindable var model = model
        @Bindable var cart = cart

        return ScreenContainer {
            if let errorMessage = model.errorMessage {
                ErrorStateView(message: errorMessage)
            }

            if !auth.isAuthenticated {
                CardContainer {
                    Text("Checking out as a guest. Signing in saves this order to your account — entirely optional.")
                        .textStyle(.caption, tone: .muted)
                }
            }

            CardSection("How would you like it?") {
                SegmentedPicker(segments: orderTypeSegments, selection: $cart.orderType)
            }

            CardSection("Contact") {
                VStack(spacing: Spacing.md) {
                    LabeledTextField(
                        title: "Name",
                        text: $model.form.customerName,
                        isRequired: true,
                        error: model.error(for: .customerName)
                    )
                    .textContentType(.name)

                    LabeledTextField(
                        title: "Email",
                        text: $model.form.email,
                        isRequired: true,
                        error: model.error(for: .email)
                    )
                    .emailField()

                    LabeledTextField(title: "Phone", text: $model.form.phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                }
            }

            if cart.orderType == .delivery {
                deliveryAddressSection(model: model)
            }

            OrderSummaryView(items: cart.items, orderType: cart.orderType, totals: cart.totals)

            AsyncButton("Continue to payment", isLoading: model.isSubmitting) {
                Task {
                    await model.createOrder(
                        items: cart.items,
                        orderType: cart.orderType,
                        isAuthenticated: auth.isAuthenticated
                    )
                }
            }
            .buttonStyle(.pizza(.primary, size: .large, fullWidth: true))
        }
    }

    private func deliveryAddressSection(model: CheckoutViewModel) -> some View {
        @Bindable var model = model

        return CardSection("Delivery address") {
            VStack(spacing: Spacing.md) {
                SavedAddressPicker(
                    addresses: model.savedAddresses,
                    selectedID: $model.selectedAddressID,
                    newAddressID: CheckoutViewModel.newAddressID
                )

                if model.isUsingNewAddress {
                    LabeledTextField(
                        title: "Street address",
                        text: $model.form.addressLine1,
                        isRequired: true,
                        error: model.error(for: .addressLine1)
                    )
                    .textContentType(.streetAddressLine1)

                    LabeledTextField(
                        title: "City",
                        text: $model.form.city,
                        isRequired: true,
                        error: model.error(for: .city)
                    )
                    .textContentType(.addressCity)

                    HStack(alignment: .top, spacing: Spacing.md) {
                        LabeledTextField(
                            title: "State",
                            text: $model.form.state,
                            isRequired: true,
                            error: model.error(for: .state)
                        )
                        .textInputAutocapitalization(.characters)
                        .textContentType(.addressState)

                        LabeledTextField(
                            title: "ZIP",
                            text: $model.form.postalCode,
                            isRequired: true,
                            error: model.error(for: .postalCode)
                        )
                        .postalCodeField()
                    }
                }
            }
        }
    }

    // MARK: - Step 2

    private func paymentStep(model: CheckoutViewModel, created: OrderCreateResponse) -> some View {
        ScreenContainer {
            OrderSummaryView(
                items: cart.items,
                orderType: cart.orderType,
                totals: cart.totals,
                order: created.order
            )

            CardSection("Payment") {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    if let errorMessage = model.errorMessage {
                        ErrorStateView(message: errorMessage)
                    }

                    if created.clientSecret != nil, model.isPaymentAvailable {
                        Text("""
                        Card details are collected by Stripe in its own secure sheet — they never \
                        reach this app. Test mode: use 4242 4242 4242 4242, any future expiry, any CVC.
                        """)
                        .textStyle(.caption, tone: .muted)

                        AsyncButton("Pay now", isLoading: model.isPaying) {
                            Task { await handlePayment(model: model) }
                        }
                        .buttonStyle(.pizza(.primary, size: .large, fullWidth: true))
                    } else {
                        Text(model.paymentUnavailableMessage(for: created))
                            .textStyle(.caption, tone: .muted)
                    }

                    Text("Order \(created.order.shortID)… is reserved. It is not paid until the card is confirmed.")
                        .textStyle(.caption, tone: .subtle)
                }
            }
        }
    }

    private func handlePayment(model: CheckoutViewModel) async {
        guard let orderID = await model.pay() else { return }

        /*
         * Stripe accepted the card. The cart is done; the confirmation screen asks OUR server
         * whether the payment settled, because the device is not the authority on that.
         *
         * `replaceStack`, not `push`: the back gesture must not return to a checkout screen for an
         * order that has already been paid for.
         */
        cart.clear()
        toasts.show("Payment accepted")
        router.replaceStack(with: .order(id: orderID))
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    environment.cart.add(
        product: SampleData.pepperoni,
        size: .medium,
        crust: SampleData.crusts[0],
        toppings: [SampleData.toppings[0]],
        quantity: 2
    )
    return NavigationStack {
        CheckoutView()
            .environment(environment)
            .environment(environment.cart)
            .environment(environment.auth)
            .environment(environment.toasts)
            .environment(AppRouter())
    }
}
#endif
