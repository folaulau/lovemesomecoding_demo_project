import Foundation

/// The session token, and the only thing that reads or writes it.
///
/// ## Why an `actor`
///
/// The token is touched from several places at once: the HTTP client reads it on every
/// authenticated request, the sign-in flow writes it, and sign-out clears it. Those can genuinely
/// overlap — a customer can tap "Sign out" while a menu refresh is in flight.
///
/// An `actor` serialises access to its own state, so there is no lock to remember to take and no
/// data race to reason about. The compiler enforces it: every access from outside is `await`ed,
/// and there is no way to reach `cachedToken` without going through the actor.
///
/// ## Why the token is cached in memory
///
/// Every authenticated request needs it, and a Keychain read is a syscall into `securityd` — not
/// slow enough to see, but pointless to repeat dozens of times a session. The cache is authoritative
/// once loaded, and it is the actor that makes "load once, then reuse" safe to write at all.
actor TokenStore: AuthTokenProviding {
    private let secureStore: SecureStore
    private var cachedToken: String?
    private var hasLoaded = false

    init(secureStore: SecureStore) {
        self.secureStore = secureStore
    }

    /// The current token, reading the Keychain the first time and the cache thereafter.
    ///
    /// A Keychain failure is swallowed to nil rather than thrown. The only honest interpretation of
    /// "we cannot read the token" is "there is no session", and every caller would have to turn a
    /// thrown error into exactly that anyway.
    func currentToken() async -> String? {
        if hasLoaded { return cachedToken }
        cachedToken = try? secureStore.string(for: .authToken)
        hasLoaded = true
        return cachedToken
    }

    func store(_ token: String) async {
        cachedToken = token
        hasLoaded = true
        do {
            try secureStore.set(token, for: .authToken)
        } catch {
            /*
             * The Keychain write failed, but the in-memory token is still good. The session works
             * for as long as the app is running; it simply will not survive a relaunch. Failing the
             * sign-in over this would be a worse outcome than a session that is merely short-lived.
             */
            AppLog.storage.error("Could not persist the auth token: \(error.localizedDescription, privacy: .public)")
        }
    }

    func clear() async {
        cachedToken = nil
        hasLoaded = true
        try? secureStore.removeValue(for: .authToken)
    }
}
