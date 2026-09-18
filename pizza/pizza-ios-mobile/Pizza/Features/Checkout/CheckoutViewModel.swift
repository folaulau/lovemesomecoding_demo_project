import Foundation
import Observation

/// Checkout, in two steps.
///
/// 1. Collect contact and address details and `POST /api/orders`. The server prices the cart from
///    the database, saves the order as `PENDING_PAYMENT` and opens a Stripe PaymentIntent, returning
///    its client secret.
/// 2. Hand that client secret to the payment sheet.
///
/// The order has to exist before the sheet can open, because the PaymentIntent is what the sheet
/// confirms. That ordering is why this is two steps rather than one submit — and why the state
/// below is an enum: "collecting details" and "awaiting payment" are genuinely different screens
/// with different actions, and modelling them as a `createdOrder != nil` check invites a third,
/// undefined state where an order exists but the form is still editable.
@MainActor
@Observable
final class CheckoutViewModel {
    enum Step: Equatable {
        case collectingDetails
        case awaitingPayment(OrderCreateResponse)

        static func == (lhs: Step, rhs: Step) -> Bool {
            switch (lhs, rhs) {
            case (.collectingDetails, .collectingDetails): true
            case let (.awaitingPayment(l), .awaitingPayment(r)): l.order.id == r.order.id
            default: false
            }
        }
    }

    /// The sentinel meaning "type a fresh address instead of using a saved one".
    ///
    /// Modelling it as one of the *selection values* rather than as a separate boolean keeps the
    /// radio group honest: exactly one option is selected at any time, and there is no state where
    /// both a saved address and the typed form are considered active.
    static let newAddressID = "NEW"

    var form = CheckoutForm()
    var selectedAddressID: UUIDString = CheckoutViewModel.newAddressID

    private(set) var step: Step = .collectingDetails
    private(set) var savedAddresses: [Address] = []
    private(set) var fieldErrors: [CheckoutForm.Field: String] = [:]
    private(set) var errorMessage: String?
    private(set) var isSubmitting = false
    private(set) var isPaying = false

    /// Errors stay hidden until the first submit, so the form does not shout at a blank field
    /// somebody has not reached yet.
    private var hasAttemptedSubmit = false

    private let orderRepository: OrderRepository
    private let profileRepository: ProfileRepository
    private let paymentGateway: PaymentGateway

    init(
        orderRepository: OrderRepository,
        profileRepository: ProfileRepository,
        paymentGateway: PaymentGateway
    ) {
        self.orderRepository = orderRepository
        self.profileRepository = profileRepository
        self.paymentGateway = paymentGateway
    }

    var isUsingNewAddress: Bool { selectedAddressID == Self.newAddressID }
    var isPaymentAvailable: Bool { paymentGateway.isReady }

    func error(for field: CheckoutForm.Field) -> String? {
        hasAttemptedSubmit ? fieldErrors[field] : nil
    }

    /// Seeds the form from the signed-in account, so a returning customer is not retyping their
    /// own name. Guests get empty fields, which is correct.
    func prefill(from user: User?) {
        guard let user else { return }
        if form.customerName.isEmpty { form.customerName = user.fullName ?? "" }
        if form.email.isEmpty { form.email = user.email }
    }

    /// Loads the customer's saved addresses and preselects their primary one. Guests skip this.
    func loadSavedAddresses(isAuthenticated: Bool) async {
        guard isAuthenticated else { return }

        do {
            let addresses = try await profileRepository.addresses()
            savedAddresses = addresses
            if let preferred = addresses.first(where: \.primary) ?? addresses.first {
                selectedAddressID = preferred.id
            }
        } catch {
            // A profile that will not load must not block checkout — fall back to typing an
            // address. This is the one failure on this screen that is deliberately not surfaced.
            guard !ErrorPresenter.isCancellation(error) else { return }
            AppLog.checkout.info("Saved addresses could not be loaded; falling back to a typed address.")
        }
    }

    // MARK: - Step 1: create the order

    @discardableResult
    func createOrder(
        items: [CartItem],
        orderType: OrderType,
        isAuthenticated: Bool
    ) async -> Bool {
        hasAttemptedSubmit = true
        fieldErrors = CheckoutFormValidator.validate(
            form,
            context: .init(orderType: orderType, needsTypedAddress: isUsingNewAddress)
        )
        guard fieldErrors.isEmpty else { return false }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let address = resolvedAddress(for: orderType)

        let request = OrderCreateRequest(
            orderType: orderType,
            customerName: form.customerName.trimmed,
            // Ignored by the server when a token is present — the account's email wins.
            guestEmail: form.email.trimmed,
            phone: form.phone.trimmed.isEmpty ? nil : form.phone.trimmed,
            addressLine1: address?.line1,
            addressLine2: address?.line2,
            city: address?.city,
            state: address?.state,
            postalCode: address?.postalCode,
            // Identifiers and quantities only. No prices: the server decides what this costs.
            items: items.map { item in
                OrderCreateRequest.Item(
                    productId: item.productID,
                    size: item.size,
                    crustId: item.crustID,
                    toppingIds: item.toppings.map(\.id),
                    quantity: item.quantity
                )
            }
        )

        do {
            let response = try await orderRepository.createOrder(request, authenticated: isAuthenticated)
            step = .awaitingPayment(response)
            return true
        } catch {
            guard !ErrorPresenter.isCancellation(error) else { return false }
            errorMessage = ErrorPresenter.message(for: error, fallback: "Could not create the order.")
            return false
        }
    }

    /// The address fields to send: from the chosen saved address, or from the form.
    private func resolvedAddress(for orderType: OrderType)
        -> (line1: String, line2: String?, city: String, state: String, postalCode: String)? {
        guard orderType == .delivery else { return nil }

        if !isUsingNewAddress,
           let chosen = savedAddresses.first(where: { $0.id == selectedAddressID }) {
            return (chosen.line1, chosen.line2, chosen.city, chosen.state, chosen.postalCode)
        }

        return (
            form.addressLine1.trimmed,
            nil,
            form.city.trimmed,
            form.state.trimmed.uppercased(),
            form.postalCode.trimmed
        )
    }

    // MARK: - Step 2: pay

    /// Opens the payment sheet. Returns the paid order's id on success, and nil otherwise.
    ///
    /// Returning an optional rather than throwing keeps the three outcomes — paid, cancelled,
    /// failed — as one decision in the caller. Cancellation in particular must not be an error:
    /// the order is still reserved and the customer can try again.
    func pay() async -> UUIDString? {
        guard case let .awaitingPayment(created) = step,
              let clientSecret = created.clientSecret else { return nil }

        isPaying = true
        errorMessage = nil
        defer { isPaying = false }

        let outcome = await paymentGateway.pay(
            PaymentRequest(
                clientSecret: clientSecret,
                customerName: form.customerName.trimmed,
                customerEmail: form.email.trimmed
            )
        )

        switch outcome {
        case .succeeded:
            return created.order.id
        case .cancelled:
            // Not an error. The order is still reserved and they can try again.
            return nil
        case let .failed(message):
            errorMessage = message
            return nil
        }
    }

    /// The copy shown when card payment is unavailable, which is two different problems.
    ///
    /// Telling them apart is worth the branch: a missing publishable key is fixed in the app's build
    /// settings, and a missing client secret is fixed on the server. One generic message would send
    /// whoever is debugging to the wrong place.
    func paymentUnavailableMessage(for created: OrderCreateResponse) -> String {
        if created.clientSecret == nil {
            return """
            The server created this order but returned no Stripe client secret, which means no \
            Stripe key is configured on the backend. Set pizza.stripe.secret-key in \
            application-local.properties and run with the local profile.
            """
        }
        return """
        Card payment is unavailable because this build has no Stripe publishable key. Set \
        PIZZA_STRIPE_PUBLISHABLE_KEY in Config/Debug.xcconfig and rebuild.
        """
    }
}
