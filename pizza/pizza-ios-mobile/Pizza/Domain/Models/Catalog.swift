import Foundation

/// The product kinds the menu has. Keep it minimal — pizzas and drinks, nothing else.
///
/// A `String`-backed enum rather than a bare `String` is the Swift equivalent of the TypeScript
/// union `'PIZZA' | 'DRINK'`, and it buys the same thing: `switch` over it is exhaustive, so adding
/// a case makes every unhandled site a compile error.
enum ProductType: String, Codable, CaseIterable, Hashable {
    case pizza = "PIZZA"
    case drink = "DRINK"
}

enum SizeName: String, Codable, CaseIterable, Hashable {
    case small = "SMALL"
    case medium = "MEDIUM"
    case large = "LARGE"

    /// "MEDIUM" reads badly in a button; "Medium" does.
    var displayName: String { rawValue.prefix(1) + rawValue.dropFirst().lowercased() }
}

enum ToppingCategory: String, Codable, CaseIterable, Hashable {
    case meat = "MEAT"
    case veggie = "VEGGIE"
    case cheese = "CHEESE"
}

struct ProductSize: Codable, Identifiable, Hashable {
    let id: UUIDString
    let size: SizeName
    let price: Double
}

struct Product: Codable, Identifiable, Hashable {
    let id: UUIDString
    let name: String
    let description: String
    let type: ProductType
    let imageUrl: String?
    let active: Bool
    let displayOrder: Int
    let sizes: [ProductSize]
    let createdAt: String
    let updatedAt: String

    /// The "from $x" figure on a product card.
    ///
    /// Returns `nil` rather than 0 for a product with no sizes, because a product with no sizes is
    /// a valid API response and "from $0.00" would be a lie. The card renders "Unavailable".
    var cheapestPrice: Double? { sizes.map(\.price).min() }

    func price(for size: SizeName) -> Double? {
        sizes.first { $0.size == size }?.price
    }
}

struct Topping: Codable, Identifiable, Hashable {
    let id: UUIDString
    let name: String
    let price: Double
    let category: ToppingCategory
    let active: Bool
}

struct Crust: Codable, Identifiable, Hashable {
    let id: UUIDString
    let name: String
    let priceDelta: Double
    let active: Bool
    let displayOrder: Int
}
