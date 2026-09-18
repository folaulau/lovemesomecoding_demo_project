import Foundation
import OSLog
import Security

/// Encrypted-at-rest storage for secrets.
///
/// A protocol first, so the token store can be tested without touching the real Keychain — the
/// Keychain is process- and entitlement-sensitive, and a unit test that writes to it is a test that
/// fails differently on a CI machine than on a laptop.
protocol SecureStore: Sendable {
    func string(for key: StorageKey) throws -> String?
    func set(_ value: String, for key: StorageKey) throws
    func removeValue(for key: StorageKey) throws
}

/// The real implementation, on the iOS Keychain.
///
/// ## Why this exists at all
///
/// This is the first real departure from the web app. There, the JWT lives in `localStorage`, with
/// a comment apologising that any XSS bug can read it. On a phone there is a better answer: the
/// Keychain is encrypted by the Secure Enclave-backed class key, is inaccessible to other apps, and
/// survives an app *update* while being wiped on an uninstall.
///
/// ## The accessibility class is the decision that matters
///
/// `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`:
///
/// - **AfterFirstUnlock** — readable once the customer has unlocked the phone since boot, so a
///   background refresh still works with the screen locked. `WhenUnlocked` would be stricter and
///   would break any future background task; `Always` is deprecated and unencrypted at rest.
/// - **ThisDeviceOnly** — never copied into an iCloud Keychain backup. A session token is bound to
///   *this* device; syncing one to a restored iPad is a way to hand a live session to a machine the
///   customer may no longer control.
///
/// ## Why `Foundation`'s CRUD does not exist here
///
/// `SecItemUpdate` fails when the item is absent and `SecItemAdd` fails when it is present, so
/// "save" is written below as delete-then-add. It is not elegant; it is the only spelling that is
/// correct in both states without an extra round trip to find out which one applies.
struct KeychainSecureStore: SecureStore {
    /// Namespaces the items so a second target (an extension, a widget) cannot collide.
    private let service: String

    init(service: String = Bundle.main.bundleIdentifier ?? "com.lovemesomecoding.pizza.ios") {
        self.service = service
    }

    enum Failure: LocalizedError {
        case unexpectedStatus(OSStatus)
        case unreadableData

        var errorDescription: String? {
            switch self {
            case let .unexpectedStatus(status):
                "Keychain operation failed with status \(status)."
            case .unreadableData:
                "The stored value could not be read as text."
            }
        }
    }

    func string(for key: StorageKey) throws -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        switch status {
        case errSecSuccess:
            guard let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
                throw Failure.unreadableData
            }
            return value
        case errSecItemNotFound:
            // Absent is a normal state — nobody has signed in yet — not an error.
            return nil
        default:
            throw Failure.unexpectedStatus(status)
        }
    }

    func set(_ value: String, for key: StorageKey) throws {
        guard let data = value.data(using: .utf8) else { throw Failure.unreadableData }

        // Delete first: SecItemAdd returns errSecDuplicateItem for an existing key.
        try? removeValue(for: key)

        var query = baseQuery(for: key)
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw Failure.unexpectedStatus(status) }
    }

    func removeValue(for key: StorageKey) throws {
        let status = SecItemDelete(baseQuery(for: key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw Failure.unexpectedStatus(status)
        }
    }

    private func baseQuery(for key: StorageKey) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
    }
}

/// An in-memory `SecureStore` for tests and SwiftUI previews.
///
/// A preview runs in a host process with no Keychain entitlement, so the real store fails there —
/// and a test that shares the Keychain with the app under development is a test that passes or
/// fails depending on whether someone happened to be signed in.
final class InMemorySecureStore: SecureStore, @unchecked Sendable {
    private var storage: [StorageKey: String] = [:]
    private let lock = NSLock()

    init(seed: [StorageKey: String] = [:]) { storage = seed }

    func string(for key: StorageKey) throws -> String? {
        lock.withLock { storage[key] }
    }

    func set(_ value: String, for key: StorageKey) throws {
        lock.withLock { storage[key] = value }
    }

    func removeValue(for key: StorageKey) throws {
        lock.withLock { storage[key] = nil }
    }
}
