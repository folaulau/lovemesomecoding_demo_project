import SwiftUI

/// Sign in. Presented as a sheet, because ordering never requires it.
///
/// A sheet rather than a pushed screen is the platform's way of saying "this is a detour, swipe
/// down to leave". Making sign-in a destination in the navigation stack would imply the customer
/// has to get through it, which is precisely the opposite of how this app works.
@MainActor
struct SignInView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(ToastCenter.self) private var toasts
    @Environment(AppRouter.self) private var router

    @State private var email = ""
    @State private var password = ""

    /// Which field the keyboard is in, so "next" moves to the password and "go" submits.
    ///
    /// `@FocusState` is the SwiftUI mechanism, and it is two-way: the view can *move* focus, not
    /// only observe it. On a phone that matters — there is no Tab key, so a form that does not wire
    /// this up leaves the customer dismissing the keyboard between every field.
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email
        case password
    }

    var body: some View {
        NavigationStack {
            ScreenContainer {
                Text("Ordering never requires an account — signing in just saves your orders, addresses and cards.")
                    .textStyle(.caption, tone: .muted)

                if let errorMessage = auth.errorMessage {
                    ErrorStateView(message: errorMessage)
                }

                CardContainer {
                    VStack(spacing: Spacing.md) {
                        LabeledTextField(
                            title: "Email",
                            text: $email,
                            isRequired: true,
                            error: auth.fieldErrors["email"]
                        )
                        .emailField()
                        .textContentType(.username)
                        .submitLabel(.next)
                        .focused($focusedField, equals: .email)

                        LabeledTextField(
                            title: "Password",
                            text: $password,
                            isRequired: true,
                            error: auth.fieldErrors["password"],
                            isSecure: true
                        )
                        /*
                         * `.password` is what offers the iOS Keychain's AutoFill bar above the
                         * keyboard. Without it a saved password is invisible to the customer and
                         * they retype it every single time.
                         */
                        .textContentType(.password)
                        .submitLabel(.go)
                        .focused($focusedField, equals: .password)

                        AsyncButton("Sign in", isLoading: auth.isSubmitting) {
                            Task { await submit() }
                        }
                        .buttonStyle(.pizza(.primary, size: .large, fullWidth: true))
                        .padding(.top, Spacing.sm)
                    }
                }

                Button("Create an account") {
                    router.presentedSheet = .register
                }
                .buttonStyle(.pizza(.ghost, size: .medium, fullWidth: true))

                demoCard
            }
            .navigationTitle("Sign in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { router.dismissSheet() }
                }
            }
            .onSubmit {
                switch focusedField {
                case .email: focusedField = .password
                case .password: Task { await submit() }
                case nil: break
                }
            }
        }
    }

    private var demoCard: some View {
        CardContainer {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Demo logins").textStyle(.label, tone: .muted)
                Text("customer@pizza.test · pizza123").textStyle(.caption, tone: .muted)
                Text("admin@pizza.test · admin123 (admin screens are web-only)")
                    .textStyle(.caption, tone: .muted)
            }
        }
        .background(Theme.colors.surfaceAlt, in: RoundedRectangle(cornerRadius: Radius.md))
    }

    private func submit() async {
        focusedField = nil
        guard await auth.signIn(email: email.trimmed, password: password) else { return }
        toasts.show("Signed in")
        router.dismissSheet()
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return SignInView()
        .environment(environment.auth)
        .environment(environment.toasts)
        .environment(AppRouter())
}
#endif
