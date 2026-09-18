import Foundation

/// Every persistence key in one place.
///
/// Typos in a storage key fail silently — the read returns nil and the app behaves as if the
/// customer had never signed in. Naming them once removes that whole class of bug, and makes it
/// obvious at a glance what this app leaves on the device.
enum StorageKey: String, CaseIterable {
    /// The JWT. Goes in the Keychain, never in `UserDefaults`.
    case authToken = "pizza.token"
    /// Which server-side cart belongs to this device. Not a secret — see `CartIdentifierStore`.
    case cartIdentifier = "pizza.cartId"
}
