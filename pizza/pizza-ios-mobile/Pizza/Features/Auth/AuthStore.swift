import Foundation
import Observation

/// Who is signed in, and everything that can change that.
///
/// ## Why this is separate from the cart and the menu
///
/// Three small stores rather than one big one. If they shared a type, every cart change would
/// invalidate the views that only care about the signed-in customer. `@Observable` tracks reads per
/// property and softens that, but it does not fix the *design* problem: a type that owns
/// authentication, the catalogue and the basket has no clear reason to change and no clear set of
/// tests. Splitting by what changes together is the rule.
///
/// ## `isRestoringSession` — the state the web app does not have
///
/// On the web the token comes out of `localStorage` synchronously, so the very first render already
/// knows whether anyone is signed in. Here it is in the Keychain and reading it is asynchronous, so
/// for a moment the app genuinely does not know. Rendering the signed-out UI during that gap makes
/// the app flash "Sign in" and then swap — and a screen gated on `isAuthenticated` would bounce a
/// signed-in customer out of the tab they just opened. `RootView` waits on this flag.
@MainActor
@Observable
final class AuthStore {
    private(set) var user: User?
    private(set) var isSubmitting = false
    private(set) var errorMessage: String?
    /// Field-level messages from the API, keyed by field name — for rendering under an input.
    private(set) var fieldErrors: [String: String] = [:]
    /// True until the stored token has been read AND checked against the API.
    private(set) var isRestoringSession = true

    var isAuthenticated: Bool { user != nil }

    private let repository: AuthRepository
    private let tokenStore: TokenStore

    init(repository: AuthRepository, tokenStore: TokenStore) {
        self.repository = repository
        self.tokenStore = tokenStore
    }

    /// Re-establishes the session from the stored token, if there is one.
    ///
    /// The mere *presence* of a token proves nothing — it may have expired or been revoked — so
    /// `/api/auth/me` is the source of truth. A failure drops the token rather than leaving a dead
    /// one behind that makes every later authenticated call fail with a confusing 401.
    func restoreSession() async {
        defer { isRestoringSession = false }

        guard await tokenStore.currentToken() != nil else { return }

        do {
            user = try await repository.currentUser()
        } catch {
            AppLog.auth.info("Stored session could not be restored; clearing the token.")
            await tokenStore.clear()
            user = nil
        }
    }

    func signIn(email: String, password: String) async -> Bool {
        await authenticate {
            try await self.repository.login(email: email, password: password)
        }
    }

    func register(email: String, password: String, fullName: String) async -> Bool {
        await authenticate {
            try await self.repository.register(email: email, password: password, fullName: fullName)
        }
    }

    func signOut() async {
        // Nothing to call server-side: JWTs are stateless, so "signing out" is forgetting the
        // token. That is also the trade-off — it stays valid until it expires, which is why the
        // expiry is short and why a real logout endpoint would be the next step if it were not.
        await tokenStore.clear()
        user = nil
        errorMessage = nil
        fieldErrors = [:]
    }

    /// Shared by sign-in and register — the only difference is which endpoint is called.
    ///
    /// Returns `Bool` rather than throwing, and that is a deliberate interface decision. The caller
    /// is a view whose only question is "may I navigate away now?"; the *message* is already
    /// published on `errorMessage` for the form to render. Rethrowing would force every screen to
    /// write a `catch` that does nothing but discard the error it has already been handed.
    @discardableResult
    private func authenticate(
        _ call: @escaping () async throws -> AuthenticationResponse
    ) async -> Bool {
        isSubmitting = true
        errorMessage = nil
        fieldErrors = [:]
        defer { isSubmitting = false }

        do {
            let response = try await call()
            await tokenStore.store(response.token)
            user = response.user
            return true
        } catch {
            guard !ErrorPresenter.isCancellation(error) else { return false }

            errorMessage = ErrorPresenter.message(
                for: error,
                fallback: "Could not reach the server. Is the API running?"
            )
            if let apiError = error as? APIError { fieldErrors = apiError.fieldErrors }
            return false
        }
    }
}

#if DEBUG
extension AuthStore {
    /// Puts the store into a signed-in state without a round trip, for previews.
    ///
    /// It lives inside this file because `user` is `private(set)` — settable only from here, which
    /// is exactly the guarantee that makes the store's interface trustworthy. A preview helper is
    /// not a reason to weaken it, so the helper comes to the state rather than the other way round.
    static func previewSignedIn(user: User = SampleData.customer) -> AuthStore {
        let store = AuthStore(
            repository: PreviewAuthRepository(user: user),
            tokenStore: TokenStore(secureStore: InMemorySecureStore())
        )
        store.user = user
        store.isRestoringSession = false
        return store
    }
}
#endif
