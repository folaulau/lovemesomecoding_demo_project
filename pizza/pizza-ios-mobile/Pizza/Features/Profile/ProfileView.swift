import SwiftUI

/// The signed-in customer's profile: addresses, saved cards, and sign-out.
@MainActor
struct ProfileView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(AuthStore.self) private var auth
    @Environment(ToastCenter.self) private var toasts
    @Environment(AppRouter.self) private var router

    @State private var model: ProfileViewModel?

    /// Which address the form sheet is editing.
    ///
    /// ## Why "add" is a case rather than `Address?`
    ///
    /// `.sheet(item:)` needs a non-nil identifiable value, and `nil` already means "no sheet". A
    /// bare `Address?` therefore cannot express "open the sheet with no address to edit". Making it
    /// an enum gives both a spelling, and — because the sheet is rebuilt for each distinct value —
    /// switching from adding to editing resets the form for free.
    private enum AddressFormMode: Identifiable {
        case add
        case edit(Address)

        var id: String {
            switch self {
            case .add: "new"
            case let .edit(address): address.id
            }
        }

        var address: Address? {
            switch self {
            case .add: nil
            case let .edit(address): address
            }
        }
    }

    @State private var addressFormMode: AddressFormMode?
    @State private var pendingDeletion: PendingDeletion?

    /// A confirmation the customer has not answered yet.
    private struct PendingDeletion: Identifiable {
        let id = UUID()
        let title: String
        let message: String
        let confirm: () async -> ActionOutcome
    }

    var body: some View {
        RequireAuthentication {
            Group {
                if let model {
                    content(model: model)
                } else {
                    LoadingStateView(label: "Loading your profile…")
                }
            }
            .task {
                guard model == nil else { return }
                let model = ProfileViewModel(
                    repository: environment.profileRepository,
                    paymentGateway: environment.paymentGateway
                )
                self.model = model
                await model.load()
            }
        }
        .navigationTitle("Profile")
        .sheet(item: $addressFormMode) { mode in
            AddressFormSheet(
                address: mode.address,
                onClose: { addressFormMode = nil },
                onSaved: { message in
                    toasts.show(message)
                    Task { await model?.load(showsLoadingState: false) }
                }
            )
            .environment(environment)
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
        }
        /*
         * A destructive action gets a confirmation, and it is the system's own alert.
         *
         * Deliberately not a custom sheet: for "are you sure you want to delete", matching the
         * platform is what makes it read as serious. `.alert(item:)` also means only one can be
         * pending at a time, so two rapid taps cannot stack two dialogs.
         */
        .alert(item: $pendingDeletion) { deletion in
            Alert(
                title: Text(deletion.title),
                message: Text(deletion.message),
                primaryButton: .destructive(Text("Delete")) {
                    Task { report(await deletion.confirm()) }
                },
                secondaryButton: .cancel()
            )
        }
    }

    @ViewBuilder
    private func content(model: ProfileViewModel) -> some View {
        switch model.state {
        case .idle, .loading:
            LoadingStateView(label: "Loading your profile…")

        case let .failed(message, isRetryable):
            ScreenContainer {
                ErrorStateView(
                    message: message,
                    retry: isRetryable ? { Task { await model.load() } } : nil
                )
            }

        case .empty, .loaded:
            ScreenContainer {
                header
                addressesSection(model: model)
                cardsSection(model: model)

                Button("Sign out") {
                    Task {
                        await auth.signOut()
                        toasts.show("Signed out")
                        router.popToRoot()
                        router.select(.home)
                    }
                }
                .buttonStyle(.pizza(.outline, size: .medium, fullWidth: true))
            }
            .refreshable { await model.load(showsLoadingState: false) }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            if let fullName = auth.user?.fullName, !fullName.isEmpty {
                Text(fullName).textStyle(.subheading)
            }
            if let email = auth.user?.email {
                Text(email).textStyle(.caption, tone: .muted)
            }
        }
    }

    // MARK: - Addresses

    private func addressesSection(model: ProfileViewModel) -> some View {
        CardSection(
            "Delivery addresses",
            accessory: Button("Add") { addressFormMode = .add }
                .buttonStyle(.pizza(.outline, size: .small))
        ) {
            if model.content.addresses.isEmpty {
                EmptyStateView(
                    emoji: "📍",
                    title: "No saved addresses",
                    message: "Add one to speed up checkout."
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(model.content.addresses.enumerated()), id: \.element.id) { index, address in
                        if index > 0 { HairlineDivider() }
                        addressRow(address, model: model)
                    }
                }
            }
        }
    }

    private func addressRow(_ address: Address, model: ProfileViewModel) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Text(address.label?.isEmpty == false ? address.label! : "Address")
                    .textStyle(.bodyStrong)
                if address.primary { StatusBadge(label: "primary", tone: .success) }
            }

            Text(address.singleLine).textStyle(.caption, tone: .muted)

            FlowLayout(spacing: Spacing.lg, lineSpacing: Spacing.sm) {
                if !address.primary {
                    linkButton("Make primary") {
                        report(await model.makeAddressPrimary(id: address.id))
                    }
                }
                linkButton("Edit") { addressFormMode = .edit(address) }
                linkButton("Delete", tone: .danger) {
                    pendingDeletion = PendingDeletion(
                        title: "Delete this address?",
                        message: "\(address.line1), \(address.city)",
                        confirm: { await model.deleteAddress(id: address.id) }
                    )
                }
            }
            .padding(.top, Spacing.xs)
        }
        .padding(.vertical, Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Saved cards

    private func cardsSection(model: ProfileViewModel) -> some View {
        CardSection(
            "Saved cards",
            accessory: AsyncButton(
                "Add card",
                isLoading: model.isSavingCard,
                isDisabled: !model.isCardManagementAvailable
            ) {
                Task { report(await model.addCard()) }
            }
            .buttonStyle(.pizza(.outline, size: .small))
        ) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                if !model.isCardManagementAvailable {
                    Text("Card management needs a Stripe publishable key, which this build does not have.")
                        .textStyle(.caption, tone: .muted)
                }

                if model.content.paymentMethods.isEmpty {
                    EmptyStateView(
                        emoji: "💳",
                        title: "No saved cards",
                        message: "Only the brand, last four digits and expiry are ever stored here — never the number."
                    )
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(model.content.paymentMethods.enumerated()), id: \.element.id) { index, method in
                            if index > 0 { HairlineDivider() }
                            cardRow(method, model: model)
                        }
                    }
                }
            }
        }
    }

    private func cardRow(_ method: PaymentMethod, model: ProfileViewModel) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Text(method.displayName).textStyle(.bodyStrong)
                if method.primary { StatusBadge(label: "primary", tone: .success) }
            }

            Text(method.expiryLabel).textStyle(.caption, tone: .muted)

            FlowLayout(spacing: Spacing.lg, lineSpacing: Spacing.sm) {
                if !method.primary {
                    linkButton("Make primary") {
                        report(await model.makePaymentMethodPrimary(id: method.id))
                    }
                }
                linkButton("Delete", tone: .danger) {
                    pendingDeletion = PendingDeletion(
                        title: "Delete this card?",
                        message: method.displayName,
                        confirm: { await model.deletePaymentMethod(id: method.id) }
                    )
                }
            }
            .padding(.top, Spacing.xs)
        }
        .padding(.vertical, Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Helpers

    /// A text-only action. The row already carries enough visual weight without three more buttons.
    private func linkButton(
        _ title: String,
        tone: TextTone = .primary,
        action: @escaping () async -> Void
    ) -> some View {
        Button(title) {
            Task { await action() }
        }
        .font(.system(size: FontSize.sm, weight: .semibold))
        .foregroundStyle(tone.color)
        .buttonStyle(.plain)
    }

    /// One place turns a write's outcome into a toast, so no call site can forget the failure case.
    private func report(_ outcome: ActionOutcome) {
        guard let message = outcome.message else { return }
        toasts.show(message, style: outcome.isSuccess ? .success : .danger)
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return NavigationStack {
        ProfileView()
            .environment(environment)
            .environment(AuthStore.previewSignedIn())
            .environment(environment.toasts)
            .environment(AppRouter())
    }
}
#endif
