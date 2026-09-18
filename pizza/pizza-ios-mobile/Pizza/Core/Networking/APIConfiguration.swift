import Foundation

/// Where the API lives, and how long to wait for it.
///
/// ## Why this is not a constant
///
/// "The backend" means something different to each thing that can run this binary:
///
/// - **The simulator** shares the Mac's network stack, so `localhost` is the Mac. It works.
/// - **A real device** is a different machine on the Wi-Fi. `localhost` is the *phone*, where
///   nothing is listening. It needs the Mac's LAN address, which changes with the network and so
///   cannot be written down in advance.
/// - **A release build** talks to a real deployment over HTTPS.
///
/// The React Native app solves the middle case by asking Expo which address the phone downloaded
/// the bundle from. A native app has no dev server to ask, so the address comes from **build
/// configuration** instead: `Config/Debug.xcconfig` sets `PIZZA_API_BASE_URL`, the build copies it
/// into `Info.plist`, and this type reads it. Changing it is a build-setting edit, not a code edit,
/// which is the whole point — the same source ships to every environment.
///
/// ## Why it is a struct and not a singleton
///
/// A `static let shared` would be simpler and would make every test that touches networking depend
/// on the app's real configuration. Passing an instance means a test can construct
/// `APIConfiguration(baseURL: .mock)` and be certain nothing reaches a real host.
struct APIConfiguration: Equatable, Sendable {
    let baseURL: URL
    /// Long enough for a cold Spring Boot start, short enough that a dead network is obvious.
    ///
    /// A phone on a weak signal does not fail fast: without a deadline the request sits there and
    /// the customer watches a spinner for minutes.
    let requestTimeout: TimeInterval
    /// The Stripe PUBLISHABLE key — public by design. It identifies the account and can only
    /// create payment intents, never charge one. If a key starting `sk_` ever appears in a build
    /// setting, something has gone badly wrong.
    let stripePublishableKey: String?

    init(baseURL: URL, requestTimeout: TimeInterval = 15, stripePublishableKey: String? = nil) {
        self.baseURL = baseURL
        self.requestTimeout = requestTimeout
        self.stripePublishableKey = stripePublishableKey
    }

    var isStripeConfigured: Bool {
        guard let stripePublishableKey else { return false }
        return !stripePublishableKey.isEmpty
    }
}

extension APIConfiguration {
    /// The port `pizza-springboot-backend` serves on.
    static let defaultPort = 8085

    /// Reads the configuration a build was compiled with.
    ///
    /// The fallback is deliberately asymmetric. In a debug build a missing value means a developer
    /// has not set up `Config/Debug.xcconfig` yet, and defaulting to localhost is the friendly
    /// thing to do. In a release build it means the archive was misconfigured, and shipping a
    /// binary that silently talks to `localhost` is far worse than refusing to launch — so it
    /// traps, loudly, at the one moment someone is still in a position to fix it.
    static func fromBundle(_ bundle: Bundle = .main) -> APIConfiguration {
        let configuredURL = bundle.string(for: .apiBaseURL).flatMap(URL.init(string:))
        let stripeKey = bundle.string(for: .stripePublishableKey)

        #if DEBUG
        let baseURL = configuredURL ?? URL(string: "http://localhost:\(defaultPort)")!
        #else
        guard let baseURL = configuredURL else {
            preconditionFailure(
                """
                PIZZA_API_BASE_URL is not set for this build configuration. A release build has no \
                development server to infer the API host from — set it in Config/Release.xcconfig.
                """
            )
        }
        #endif

        return APIConfiguration(baseURL: baseURL, stripePublishableKey: stripeKey)
    }
}

// MARK: - Info.plist access

/// The Info.plist keys this app reads, named once.
///
/// A typo in a string literal fails silently — the read returns nil and the app behaves as if the
/// value were never configured. Naming them in one enum removes that whole class of bug and makes
/// it obvious what the build is expected to supply.
enum InfoPlistKey: String {
    case apiBaseURL = "PizzaAPIBaseURL"
    case stripePublishableKey = "PizzaStripePublishableKey"
}

extension Bundle {
    /// A trimmed, non-empty string for the key, or nil.
    ///
    /// The trimming matters: an xcconfig value that is defined but blank arrives as `""`, and an
    /// empty base URL would otherwise produce requests against a nonsense host rather than falling
    /// back to the default.
    func string(for key: InfoPlistKey) -> String? {
        guard let raw = object(forInfoDictionaryKey: key.rawValue) as? String else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
