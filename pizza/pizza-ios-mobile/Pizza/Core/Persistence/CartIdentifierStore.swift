import Foundation

/// Remembers which server-side cart belongs to this device.
///
/// Only the cart's UUID is kept locally; the contents live in the backend, which is what makes a
/// cart survive a force-quit. The id is not a secret — it identifies a basket, not a person, and
/// the server treats it as a claim rather than an authorisation — so `UserDefaults` is the right
/// home and the Keychain would be the wrong one.
struct CartIdentifierStore: Sendable {
    private let store: KeyValueStore

    init(store: KeyValueStore) { self.store = store }

    var identifier: UUIDString? { store.string(for: .cartIdentifier) }

    func save(_ identifier: UUIDString) { store.set(identifier, for: .cartIdentifier) }

    /// Called when the saved cart turns out to be gone — deleted server-side, or a stale id left
    /// over from pointing the app at a different environment. Forgetting it beats leaving the
    /// device aimed at a cart that will never load again.
    func clear() { store.removeValue(for: .cartIdentifier) }
}
