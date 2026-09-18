import Foundation
import Observation

/// The profile screen's data and its writes.
///
/// A view model, not a store, and the distinction is worth naming: nothing outside this screen
/// needs addresses or saved cards. Putting them in a store would keep them in memory for the whole
/// session and re-render unrelated screens when they change. State belongs with whoever owns it.
///
/// ## KNOWN GAP, shared with all three web frontends
///
/// Checkout does not yet offer these saved cards — it always collects a fresh one. They can be
/// added and managed here; wiring "pay with a saved card" is the natural next step.
@MainActor
@Observable
final class ProfileViewModel {
    struct Content: Equatable {
        var addresses: [Address] = []
        var paymentMethods: [PaymentMethod] = []
    }

    private(set) var state: ViewState<Content> = .idle
    private(set) var isSavingCard = false

    var content: Content { state.value ?? Content() }

    private let repository: ProfileRepository
    private let paymentGateway: PaymentGateway

    init(repository: ProfileRepository, paymentGateway: PaymentGateway) {
        self.repository = repository
        self.paymentGateway = paymentGateway
    }

    var isCardManagementAvailable: Bool { paymentGateway.isReady }

    /// Loads both lists.
    ///
    /// `.loaded`, never `.empty`: this screen has *two* lists, and one of them being empty is not a
    /// state for the whole screen. Each section renders its own empty case, which is why
    /// `ViewState.resolved` is deliberately not used here.
    func load(showsLoadingState: Bool = true) async {
        if showsLoadingState { state = .loading }

        do {
            // Independent requests, so they go in parallel rather than one after the other.
            async let addresses = repository.addresses()
            async let paymentMethods = repository.paymentMethods()

            state = try await .loaded(Content(addresses: addresses, paymentMethods: paymentMethods))
        } catch {
            guard !ErrorPresenter.isCancellation(error) else { return }
            state = .failure(error, fallback: "Could not load your profile.")
        }
    }

    // MARK: - Writes

    /// Every write goes through here.
    ///
    /// One implementation of "do it, reload, report" means no action can forget the reload — and
    /// reloading rather than mutating the local array is what guarantees the screen shows what the
    /// server actually stored. Making an address primary demotes another one server-side; a local
    /// edit would show two primaries until the next launch.
    ///
    /// Returns what to tell the customer. The caller owns the toast, so this type stays free of UI
    /// dependencies and is testable without one.
    private func perform(
        _ work: () async throws -> Void,
        success: String,
        failure: String
    ) async -> ActionOutcome {
        do {
            try await work()
            await load(showsLoadingState: false)
            return .succeeded(success)
        } catch {
            guard !ErrorPresenter.isCancellation(error) else { return .cancelled }
            return .failed(ErrorPresenter.message(for: error, fallback: failure) ?? failure)
        }
    }

    func makeAddressPrimary(id: UUIDString) async -> ActionOutcome {
        await perform(
            { try await repository.makeAddressPrimary(id: id) },
            success: "Primary address updated",
            failure: "Could not update the primary address."
        )
    }

    func deleteAddress(id: UUIDString) async -> ActionOutcome {
        await perform(
            { try await repository.deleteAddress(id: id) },
            success: "Address deleted",
            failure: "Could not delete the address."
        )
    }

    func makePaymentMethodPrimary(id: UUIDString) async -> ActionOutcome {
        await perform(
            { try await repository.makePaymentMethodPrimary(id: id) },
            success: "Primary card updated",
            failure: "Could not update the primary card."
        )
    }

    func deletePaymentMethod(id: UUIDString) async -> ActionOutcome {
        await perform(
            { try await repository.deletePaymentMethod(id: id) },
            success: "Card deleted",
            failure: "Could not delete the card."
        )
    }

    /// Adds a card without charging it.
    ///
    /// A SetupIntent, not a PaymentIntent. The server opens it, the payment sheet collects the
    /// details, and only the opaque `pm_…` token comes back to be saved. No card number, CVC or
    /// cardholder name ever reaches this code — the one property of this flow that is not
    /// negotiable.
    func addCard() async -> ActionOutcome {
        isSavingCard = true
        defer { isSavingCard = false }

        do {
            let clientSecret = try await repository.createSetupIntent()
            let outcome = await paymentGateway.saveCard(setupIntentClientSecret: clientSecret)

            switch outcome {
            case .cancelled:
                // `.cancelled`, not a failure: the customer changed their mind and needs no message.
                return .cancelled
            case let .failed(message):
                return .failed(message)
            case let .succeeded(paymentMethodID):
                _ = try await repository.addPaymentMethod(stripePaymentMethodID: paymentMethodID)
                await load(showsLoadingState: false)
                return .succeeded("Card saved")
            }
        } catch {
            guard !ErrorPresenter.isCancellation(error) else { return .cancelled }
            let fallback = "Could not save the card."
            return .failed(ErrorPresenter.message(for: error, fallback: fallback) ?? fallback)
        }
    }
}
