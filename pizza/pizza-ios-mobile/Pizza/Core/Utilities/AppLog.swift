import Foundation
import OSLog

/// Logging, centralised.
///
/// `OSLog`/`Logger` rather than `print`, and the difference is not stylistic:
///
/// - `print` compiles into release builds and writes to a stream nobody reads on a real device.
///   `Logger` goes to the unified log, viewable in Console.app against a device in the field.
/// - `Logger` is **privacy-aware**. Interpolated values default to `private` and are redacted in
///   logs collected from a customer's phone unless explicitly marked `.public`. That default is the
///   reason an email address cannot leak into a sysdiagnose by accident — with `print` it always
///   would.
///
/// The subsystem is the bundle identifier by convention, which is what lets Console filter this
/// app's lines out of a very noisy stream.
enum AppLog {
    static let subsystem = Bundle.main.bundleIdentifier ?? "com.lovemesomecoding.pizza.ios"

    static let http = Logger(subsystem: subsystem, category: "http")
    static let keychain = Logger(subsystem: subsystem, category: "keychain")
    static let cart = Logger(subsystem: subsystem, category: "cart")
    static let auth = Logger(subsystem: subsystem, category: "auth")
    static let checkout = Logger(subsystem: subsystem, category: "checkout")
    static let storage = Logger(subsystem: subsystem, category: "storage")
}
