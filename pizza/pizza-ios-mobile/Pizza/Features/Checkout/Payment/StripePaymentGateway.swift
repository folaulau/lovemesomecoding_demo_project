import Foundation
import UIKit

#if canImport(StripePaymentSheet)
import StripePaymentSheet
import StripePayments

/// The real payment implementation, on Stripe's **PaymentSheet**.
///
/// ## Why PaymentSheet and not a card form of our own
///
/// The card number never touches this app's code. The sheet is rendered by Stripe's SDK in its own
/// view, which keeps this binary out of PCI scope and brings Apple Pay, saved cards and 3D Secure
/// along with it. Building a card field by hand is the tempting alternative and it is the wrong
/// call: it handles none of the above, and it puts our code one refactor away from touching a PAN.
///
/// ## `withCheckedContinuation`
///
/// Stripe's API is completion-based. `withCheckedContinuation` bridges it into `async` so the
/// checkout view model can `await` a payment the way it awaits everything else. "Checked" is the
/// variant that traps if the continuation is resumed twice or never — a leak this code could
/// otherwise introduce silently, since a completion handler that is dropped simply hangs the caller
/// forever with no error and no crash.
@MainActor
final class StripePaymentGateway: PaymentGateway {
    private let publishableKey: String
    private let merchantDisplayName: String
    private let returnURL: String

    let isReady: Bool

    init(
        publishableKey: String?,
        merchantDisplayName: String = "StayHub Pizza",
        returnURL: String = "pizzaios://stripe-redirect"
    ) {
        self.publishableKey = publishableKey ?? ""
        self.merchantDisplayName = merchantDisplayName
        self.returnURL = returnURL
        self.isReady = !(publishableKey ?? "").isEmpty

        if isReady {
            StripeAPI.defaultPublishableKey = self.publishableKey
        }
    }

    func pay(_ request: PaymentRequest) async -> PaymentOutcome {
        guard isReady else {
            return .failed(message: "Payment is not configured in this build.")
        }
        guard let presenter = Self.topViewController() else {
            return .failed(message: "Could not present the payment sheet.")
        }

        var configuration = baseConfiguration()
        configuration.defaultBillingDetails.name = request.customerName
        configuration.defaultBillingDetails.email = request.customerEmail

        let sheet = PaymentSheet(
            paymentIntentClientSecret: request.clientSecret,
            configuration: configuration
        )

        let result = await withCheckedContinuation { continuation in
            sheet.present(from: presenter) { result in
                continuation.resume(returning: result)
            }
        }

        switch result {
        case .completed:
            /*
             * Stripe accepted the card. Our order is still PENDING_PAYMENT until the BACKEND hears
             * about it — through the webhook, or through the confirmation screen asking. An order
             * is never marked paid from a device: anyone can call our API.
             */
            return .succeeded
        case .canceled:
            return .cancelled
        case let .failed(error):
            return .failed(message: error.localizedDescription)
        }
    }

    func saveCard(setupIntentClientSecret: String) async -> CardSetupOutcome {
        guard isReady else {
            return .failed(message: "Payment is not configured in this build.")
        }
        guard let presenter = Self.topViewController() else {
            return .failed(message: "Could not present the payment sheet.")
        }

        // A SetupIntent, not a PaymentIntent: this collects a card without charging it.
        let sheet = PaymentSheet(
            setupIntentClientSecret: setupIntentClientSecret,
            configuration: baseConfiguration()
        )

        let result = await withCheckedContinuation { continuation in
            sheet.present(from: presenter) { result in
                continuation.resume(returning: result)
            }
        }

        switch result {
        case .completed:
            return await retrievePaymentMethodID(setupIntentClientSecret: setupIntentClientSecret)
        case .canceled:
            return .cancelled
        case let .failed(error):
            return .failed(message: error.localizedDescription)
        }
    }

    /// The sheet does not hand back the payment method id, so the SetupIntent is read back to find
    /// it. Only that opaque `pm_…` token is sent to our server — never the number, the CVC or the
    /// cardholder name.
    private func retrievePaymentMethodID(setupIntentClientSecret: String) async -> CardSetupOutcome {
        await withCheckedContinuation { continuation in
            STPAPIClient.shared.retrieveSetupIntent(withClientSecret: setupIntentClientSecret) { intent, error in
                if let error {
                    continuation.resume(returning: .failed(message: error.localizedDescription))
                    return
                }
                guard let paymentMethodID = intent?.paymentMethodID else {
                    continuation.resume(
                        returning: .failed(message: "The card was accepted but could not be saved.")
                    )
                    return
                }
                continuation.resume(returning: .succeeded(paymentMethodID: paymentMethodID))
            }
        }
    }

    private func baseConfiguration() -> PaymentSheet.Configuration {
        var configuration = PaymentSheet.Configuration()
        configuration.merchantDisplayName = merchantDisplayName
        /*
         * `returnURL` is what brings the customer BACK after a 3D Secure redirect into their bank's
         * page. It must match a URL scheme declared in Info.plist; get it wrong and the app is
         * simply never reopened, leaving a paid order the customer never sees confirmed.
         */
        configuration.returnURL = returnURL
        configuration.allowsDelayedPaymentMethods = false
        return configuration
    }

    /// The view controller to present from.
    ///
    /// SwiftUI has no view controllers, and `PaymentSheet` needs one. Walking the window hierarchy
    /// is the standard bridge — and the `while` loop is the part that is usually missing: presenting
    /// from the root while a sheet is already up throws "attempt to present on a view controller
    /// whose view is not in the window hierarchy", which is exactly the situation on the checkout
    /// screen if it is ever reached from inside a sheet.
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }

        guard var controller = scene?.keyWindow?.rootViewController else { return nil }
        while let presented = controller.presentedViewController {
            controller = presented
        }
        return controller
    }
}

#else

/// Compiled when the Stripe package is not present.
///
/// The `#if canImport` above is not a way to make Stripe optional in production — it is what keeps
/// this repository buildable for someone who clones it without network access, or who removes the
/// package to read the rest of the app. The fallback refuses loudly rather than silently pretending
/// to take money: `isReady` is false, every call fails with an explanation, and the checkout screen
/// renders the "payment is not configured" branch it already has for a missing key.
@MainActor
final class StripePaymentGateway: PaymentGateway {
    let isReady = false

    init(
        publishableKey _: String?,
        merchantDisplayName _: String = "StayHub Pizza",
        returnURL _: String = "pizzaios://stripe-redirect"
    ) {
        AppLog.checkout.error(
            "The StripePaymentSheet package is not linked. Card payment is unavailable in this build."
        )
    }

    func pay(_: PaymentRequest) async -> PaymentOutcome {
        .failed(message: "The Stripe SDK is not linked into this build.")
    }

    func saveCard(setupIntentClientSecret _: String) async -> CardSetupOutcome {
        .failed(message: "The Stripe SDK is not linked into this build.")
    }
}

#endif
