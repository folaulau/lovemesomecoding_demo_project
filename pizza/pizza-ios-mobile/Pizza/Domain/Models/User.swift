import Foundation

enum UserRole: String, Codable, Hashable {
    case customer = "CUSTOMER"
    case admin = "ADMIN"
}

struct User: Codable, Identifiable, Hashable {
    let id: UUIDString
    let email: String
    let fullName: String?
    let role: UserRole
    let createdAt: String
}

struct AuthenticationResponse: Decodable {
    let token: String
    let expiresInMinutes: Int
    let user: User
}

struct Address: Codable, Identifiable, Hashable {
    let id: UUIDString
    let label: String?
    let recipientName: String?
    let phone: String?
    let line1: String
    let line2: String?
    let city: String
    let state: String
    let postalCode: String
    /// Exactly one address is the primary one; the server enforces that, not the app.
    let primary: Bool

    /// "12 Oak St, Portland, OR 97201" — the one-line form the pickers and the profile both show.
    var singleLine: String {
        let street = line2.map { "\(line1), \($0)" } ?? line1
        return "\(street), \(city), \(state) \(postalCode)"
    }
}

struct AddressWriteRequest: Codable, Equatable {
    var label: String?
    var recipientName: String?
    var phone: String?
    var line1: String
    var line2: String?
    var city: String
    var state: String
    var postalCode: String
    var primary: Bool?

    static let empty = AddressWriteRequest(
        label: "", line1: "", line2: "", city: "", state: "", postalCode: ""
    )

    /// An `Address` from the API, flattened into the shape the form edits.
    init(from address: Address?) {
        guard let address else { self = .empty; return }
        self.init(
            label: address.label ?? "",
            line1: address.line1,
            line2: address.line2 ?? "",
            city: address.city,
            state: address.state,
            postalCode: address.postalCode
        )
    }

    init(
        label: String? = nil,
        recipientName: String? = nil,
        phone: String? = nil,
        line1: String,
        line2: String? = nil,
        city: String,
        state: String,
        postalCode: String,
        primary: Bool? = nil
    ) {
        self.label = label
        self.recipientName = recipientName
        self.phone = phone
        self.line1 = line1
        self.line2 = line2
        self.city = city
        self.state = state
        self.postalCode = postalCode
        self.primary = primary
    }
}

/// A saved card as the app sees it.
///
/// Display metadata only — no card number, no CVC, and not even the Stripe token: the device has no
/// use for it, since only the server can charge with it. If a `cardNumber` property ever appears in
/// this file, something has gone badly wrong.
struct PaymentMethod: Codable, Identifiable, Hashable {
    let id: UUIDString
    let brand: String?
    let last4: String?
    let expMonth: Int?
    let expYear: Int?
    let primary: Bool

    var displayName: String { "\(brand ?? "Card") •••• \(last4 ?? "????")" }

    var expiryLabel: String {
        guard let expMonth, let expYear else { return "Expiry unknown" }
        return String(format: "Expires %02d/%d", expMonth, expYear)
    }
}
