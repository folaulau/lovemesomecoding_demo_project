import Foundation

enum OrderStatus: String, Codable, CaseIterable, Hashable {
    case pendingPayment = "PENDING_PAYMENT"
    case paid = "PAID"
    case preparing = "PREPARING"
    case completed = "COMPLETED"
    case cancelled = "CANCELLED"

    /// "pending payment" — what the badge shows.
    var displayName: String { rawValue.replacingOccurrences(of: "_", with: " ").lowercased() }

    /// The confirmation screen keeps polling while this is true.
    var isSettling: Bool { self == .pendingPayment }
}

struct OrderItemTopping: Decodable, Identifiable, Hashable {
    let id: UUIDString
    let toppingId: UUIDString?
    let toppingName: String
    let price: Double
}

struct OrderItem: Decodable, Identifiable, Hashable {
    let id: UUIDString
    let productId: UUIDString?
    let productName: String
    let size: SizeName
    let crustId: UUIDString?
    let crustName: String?
    let quantity: Int
    let unitPrice: Double
    let lineTotal: Double
    let toppings: [OrderItemTopping]

    /// "medium, thin crust · pepperoni, mushroom"
    var configurationSummary: String {
        var parts = [size.rawValue.lowercased()]
        if let crustName { parts.append(crustName) }
        var summary = parts.joined(separator: ", ")
        if !toppings.isEmpty {
            summary += " · " + toppings.map(\.toppingName).joined(separator: ", ")
        }
        return summary
    }
}

struct Order: Decodable, Identifiable, Hashable {
    let id: UUIDString
    let status: OrderStatus
    let orderType: OrderType
    let customerName: String
    let email: String
    let phone: String?
    let addressLine1: String?
    let addressLine2: String?
    let city: String?
    let state: String?
    let postalCode: String?
    let subtotal: Double
    let tax: Double
    let deliveryFee: Double
    let total: Double
    /// Which card paid, for display only. Nil until the payment succeeds.
    let cardBrand: String?
    let cardLast4: String?
    let createdAt: String
    let updatedAt: String
    let items: [OrderItem]

    /// The first eight characters, as every order list and receipt shows it.
    var shortID: String { String(id.prefix(8)) }

    var formattedAddress: String? {
        guard let addressLine1, let city, let state, let postalCode else { return nil }
        let street = addressLine2.map { "\(addressLine1), \($0)" } ?? addressLine1
        return "\(street)\n\(city), \(state) \(postalCode)"
    }

    var paidWithDescription: String? {
        guard let cardBrand, let cardLast4 else { return nil }
        return "Paid with \(cardBrand) ending \(cardLast4)"
    }
}

/// `POST /api/orders` — identifiers only. The server prices everything.
///
/// Note what is absent: every money field. The server decides what the cart costs, and a patched
/// app sending `total: 0.01` changes nothing. `PricingService` on the backend is the security
/// boundary — see `Money.swift` for the device-side preview it overrules.
struct OrderCreateRequest: Encodable {
    struct Item: Encodable {
        let productId: UUIDString
        let size: SizeName
        let crustId: UUIDString?
        let toppingIds: [UUIDString]
        let quantity: Int
    }

    let orderType: OrderType
    let customerName: String
    /// Ignored by the server when a token is present — the account's email wins.
    let guestEmail: String?
    let phone: String?
    let addressLine1: String?
    let addressLine2: String?
    let city: String?
    let state: String?
    let postalCode: String?
    let items: [Item]
}

struct OrderCreateResponse: Decodable {
    let order: Order
    /// Nil when the server has no Stripe key configured.
    let clientSecret: String?
}
