import Foundation

/// The result of asking the customer to pay.
///
/// `cancelled` is its own case, not an error, and that distinction is the whole reason this enum
/// exists. Stripe reports a dismissed sheet as a failure; showing "Your payment failed" to somebody
/// who simply changed their mind is a bug that is easy to ship and hard to notice, because it only
/// happens to customers who did not complete the purchase and therefore never complain.
enum PaymentOutcome: Equatable {
    case succeeded
    case cancelled
    case failed(message: String)
}

enum CardSetupOutcome: Equatable {
    case succeeded(paymentMethodID: String)
    case cancelled
    case failed(message: String)
}

struct PaymentRequest {
    /// From `POST /api/orders`. The sheet confirms THIS intent — the server already priced it.
    let clientSecret: String
    /// Shown at the top of the payment sheet.
    let customerName: String?
    let customerEmail: String?
}

/// The payment contract, written once and implemented twice.
///
/// ## Why an abstraction at all
///
/// Three things fall out of it, and all three are worth more than the indirection costs:
///
/// 1. **Checkout is testable without a payment provider.** `CheckoutViewModel`'s tests inject a
///    gateway that returns `.succeeded` or `.cancelled` on demand. Driving the real Stripe sheet
///    from a test is not merely hard, it is impossible — it is a system UI the test cannot touch.
/// 2. **SwiftUI previews work.** `PaymentSheet` needs a `UIViewController` to present from, which a
///    preview does not have. The stub needs nothing.
/// 3. **Stripe is confined to one file.** Nothing outside this folder imports the SDK, so replacing
///    it is a single-file change rather than an archaeology exercise.
///
/// `@MainActor` because presenting a sheet is UI work, and the compiler should say so rather than
/// leaving it to a runtime assertion.
@MainActor
protocol PaymentGateway {
    /// Opens the payment sheet and returns once the customer is done with it.
    func pay(_ request: PaymentRequest) async -> PaymentOutcome
    /// Collects a card against a SetupIntent WITHOUT charging it, for the profile screen.
    func saveCard(setupIntentClientSecret: String) async -> CardSetupOutcome
    /// False when no publishable key is configured — the UI then explains, rather than failing at
    /// the moment of tapping "Pay".
    var isReady: Bool { get }
}

/// A gateway for previews, unit tests, and builds with no Stripe key.
///
/// It is not a no-op: it returns a *configured* outcome, so a test can exercise the cancelled path
/// and the failed path as easily as the happy one. `isReady` defaults to false so a misconfigured
/// build shows the checkout screen's explanatory copy rather than pretending it can take money.
@MainActor
final class StubPaymentGateway: PaymentGateway {
    var isReady: Bool
    var nextPaymentOutcome: PaymentOutcome
    var nextCardSetupOutcome: CardSetupOutcome

    private(set) var payCallCount = 0
    private(set) var lastRequest: PaymentRequest?

    init(
        isReady: Bool = false,
        nextPaymentOutcome: PaymentOutcome = .succeeded,
        nextCardSetupOutcome: CardSetupOutcome = .succeeded(paymentMethodID: "pm_stub")
    ) {
        self.isReady = isReady
        self.nextPaymentOutcome = nextPaymentOutcome
        self.nextCardSetupOutcome = nextCardSetupOutcome
    }

    func pay(_ request: PaymentRequest) async -> PaymentOutcome {
        payCallCount += 1
        lastRequest = request
        return nextPaymentOutcome
    }

    func saveCard(setupIntentClientSecret _: String) async -> CardSetupOutcome {
        nextCardSetupOutcome
    }
}
