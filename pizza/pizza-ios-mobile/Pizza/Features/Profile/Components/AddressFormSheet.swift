import SwiftUI

/// The add/edit address form, in a sheet.
@MainActor
struct AddressFormSheet: View {
    @Environment(AppEnvironment.self) private var environment

    let address: Address?
    let onClose: () -> Void
    let onSaved: (String) -> Void

    @State private var model: AddressFormViewModel?

    var body: some View {
        Group {
            if let model {
                form(model: model)
            } else {
                LoadingStateView()
            }
        }
        .task {
            guard model == nil else { return }
            model = AddressFormViewModel(address: address, repository: environment.profileRepository)
        }
    }

    private func form(model: AddressFormViewModel) -> some View {
        @Bindable var model = model

        return SheetScaffold(title: model.title, onClose: onClose) {
            VStack(spacing: Spacing.md) {
                if let errorMessage = model.errorMessage {
                    ErrorStateView(message: errorMessage)
                }

                LabeledTextField(
                    title: "Label",
                    text: Binding(
                        // `AddressWriteRequest.label` is optional because the API allows it to be
                        // absent; a `TextField` needs a non-optional `String`. This binding is the
                        // adapter, and writing it here keeps the optionality at the model where it
                        // belongs rather than making every field on the wire non-optional.
                        get: { model.form.label ?? "" },
                        set: { model.form.label = $0 }
                    ),
                    hint: "Home, Work — whatever helps you pick it at checkout.",
                    error: model.fieldErrors["label"]
                )

                LabeledTextField(
                    title: "Street address",
                    text: $model.form.line1,
                    isRequired: true,
                    error: model.fieldErrors["line1"]
                )
                .textContentType(.streetAddressLine1)

                LabeledTextField(
                    title: "Apartment, suite",
                    text: Binding(
                        get: { model.form.line2 ?? "" },
                        set: { model.form.line2 = $0 }
                    ),
                    error: model.fieldErrors["line2"]
                )
                .textContentType(.streetAddressLine2)

                LabeledTextField(
                    title: "City",
                    text: $model.form.city,
                    isRequired: true,
                    error: model.fieldErrors["city"]
                )
                .textContentType(.addressCity)

                HStack(alignment: .top, spacing: Spacing.md) {
                    LabeledTextField(
                        title: "State",
                        text: $model.form.state,
                        isRequired: true,
                        error: model.fieldErrors["state"]
                    )
                    .textInputAutocapitalization(.characters)
                    .textContentType(.addressState)

                    LabeledTextField(
                        title: "ZIP",
                        text: $model.form.postalCode,
                        isRequired: true,
                        error: model.fieldErrors["postalCode"]
                    )
                    .postalCodeField()
                }
            }
        } footer: {
            HStack(spacing: Spacing.sm) {
                Spacer()
                Button("Cancel", action: onClose)
                    .buttonStyle(.pizzaGhost)

                AsyncButton(model.saveTitle, isLoading: model.isSaving) {
                    Task {
                        guard let message = await model.save() else { return }
                        onSaved(message)
                        onClose()
                    }
                }
                .buttonStyle(.pizzaPrimary)
            }
            .padding(.bottom, Spacing.sm)
        }
    }
}
