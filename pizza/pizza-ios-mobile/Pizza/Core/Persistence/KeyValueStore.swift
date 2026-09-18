import Foundation

/// Plain, unencrypted device storage — the equivalent of the web's `localStorage`.
///
/// Separate from `SecureStore` on purpose. The split is not about convenience, it is about making
/// the decision explicit at every call site: a value written here is readable by anyone with a
/// backup of the device, so putting a token in it has to be a typo someone can *see*.
///
/// The Keychain would also be the wrong home for a cart id — Keychain items survive app deletion by
/// design in some configurations, and a reinstalled app pointing at a stranger's abandoned cart is
/// a bug that would be very hard to explain.
protocol KeyValueStore: Sendable {
    func string(for key: StorageKey) -> String?
    func set(_ value: String, for key: StorageKey)
    func removeValue(for key: StorageKey)
}

/// `@unchecked Sendable`, with a reason.
///
/// `UserDefaults` is documented as thread-safe — Apple guarantees it — but it predates `Sendable`
/// and has never been annotated, so the compiler cannot know. `@unchecked` is the escape hatch for
/// exactly this case: a promise the author is making on the type's behalf. It should never appear
/// without a comment saying who made the promise and why it holds.
struct UserDefaultsKeyValueStore: KeyValueStore, @unchecked Sendable {
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    func string(for key: StorageKey) -> String? { defaults.string(forKey: key.rawValue) }
    func set(_ value: String, for key: StorageKey) { defaults.set(value, forKey: key.rawValue) }
    func removeValue(for key: StorageKey) { defaults.removeObject(forKey: key.rawValue) }
}

final class InMemoryKeyValueStore: KeyValueStore, @unchecked Sendable {
    private var storage: [StorageKey: String] = [:]
    private let lock = NSLock()

    init(seed: [StorageKey: String] = [:]) { storage = seed }

    func string(for key: StorageKey) -> String? { lock.withLock { storage[key] } }
    func set(_ value: String, for key: StorageKey) { lock.withLock { storage[key] = value } }
    func removeValue(for key: StorageKey) { lock.withLock { storage[key] = nil } }
}
