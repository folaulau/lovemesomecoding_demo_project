import SwiftUI

/// Create an account.
@MainActor
struct RegisterView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(ToastCenter.self) private var toasts
    @Environment(AppRouter.self) private var router

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""

    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case fullName
        case email
        case password
    }

    var body: some View {
        NavigationStack {
            ScreenContainer {
                /*
                 * Worth stating plainly, because the API enforces it: registration ALWAYS creates a
                 * customer. There is no role field to send, and adding one would achieve nothing —
                 * the server ignores it. Saying so here is honest rather than decorative.
                 */
                Text("New accounts are always customers.").textStyle(.caption, tone: .muted)

                if let errorMessage = auth.errorMessage {
                    ErrorStateView(message: errorMessage)
                }

                CardContainer {
                    VStack(spacing: Spacing.md) {
                        LabeledTextField(
                            title: "Full name",
                            text: $fullName,
                            isRequired: true,
                            error: auth.fieldErrors["fullName"]
                        )
                        .textInputAutocapitalization(.words)
                        .textContentType(.name)
                        .submitLabel(.next)
                        .focused($focusedField, equals: .fullName)

                        LabeledTextField(
                            title: "Email",
                            text: $email,
                            isRequired: true,
                            error: auth.fieldErrors["email"]
                        )
                        .emailField()
                        .submitLabel(.next)
                        .focused($focusedField, equals: .email)

                        LabeledTextField(
                            title: "Password",
                            text: $password,
                            isRequired: true,
                            hint: "At least 8 characters.",
                            error: auth.fieldErrors["password"],
                            isSecure: true
                        )
                        /*
                         * `.newPassword`, not `.password` — it is what makes iOS offer to GENERATE
                         * and save a strong one, rather than autofilling an existing credential
                         * that does not exist yet.
                         */
                        .textContentType(.newPassword)
                        .submitLabel(.go)
                        .focused($focusedField, equals: .password)

                        AsyncButton("Create account", isLoading: auth.isSubmitting) {
                            Task { await submit() }
                        }
                        .buttonStyle(.pizza(.primary, size: .large, fullWidth: true))
                        .padding(.top, Spacing.sm)
                    }
                }

                Button("I already have an account") {
                    router.presentedSheet = .signIn
                }
                .buttonStyle(.pizza(.ghost, size: .medium, fullWidth: true))
            }
            .navigationTitle("Create account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { router.dismissSheet() }
                }
            }
            .onSubmit {
                switch focusedField {
                case .fullName: focusedField = .email
                case .email: focusedField = .password
                case .password: Task { await submit() }
                case nil: break
                }
            }
        }
    }

    private func submit() async {
        focusedField = nil
        let succeeded = await auth.register(
            email: email.trimmed,
            password: password,
            fullName: fullName.trimmed
        )
        guard succeeded else { return }
        toasts.show("Welcome to StayHub Pizza")
        router.dismissSheet()
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return RegisterView()
        .environment(environment.auth)
        .environment(environment.toasts)
        .environment(AppRouter())
}
#endif
