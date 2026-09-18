import Foundation

enum OrderType: String, Codable, CaseIterable, Hashable {
    case delivery = "DELIVERY"
    case carryout = "CARRYOUT"

    /// "Pickup" is what a customer understands; CARRYOUT is what the API calls it.
    var displayName: String {
        switch self {
        case .delivery: "Delivery"
        case .carryout: "Pickup"
        }
    }
}

/// One line in the cart, as the APP holds it.
///
/// `lineID` is generated on the device and is NOT sent to the server — the same pizza can appear
/// twice with different toppings, so the product id alone cannot identify a cart line.
///
/// It is a `struct`, which in Swift means value semantics: handing one to another type hands over a
/// copy, so nothing can mutate a line the cart still believes it owns. That property is what lets
/// the reducer next door be trivially correct, and it is the single biggest difference from the
/// React version, where immutability is a discipline the author has to maintain by hand.
struct CartItem: Identifiable, Equatable, Hashable {
    let lineID: UUID
    let productID: UUIDString
    let productName: String
    let productType: ProductType
    let imageURL: String?
    let size: SizeName
    let basePrice: Double
    let crustID: UUIDString?
    let crustName: String?
    let crustPriceDelta: Double
    let toppings: [Topping]
    var quantity: Int

    var id: UUID { lineID }

    init(
        lineID: UUID = UUID(),
        productID: UUIDString,
        productName: String,
        productType: ProductType,
        imageURL: String? = nil,
        size: SizeName,
        basePrice: Double,
        crustID: UUIDString? = nil,
        crustName: String? = nil,
        crustPriceDelta: Double = 0,
        toppings: [Topping] = [],
        quantity: Int
    ) {
        self.lineID = lineID
        self.productID = productID
        self.productName = productName
        self.productType = productType
        self.imageURL = imageURL
        self.size = size
        self.basePrice = basePrice
        self.crustID = crustID
        self.crustName = crustName
        self.crustPriceDelta = crustPriceDelta
        self.toppings = toppings
        self.quantity = quantity
    }

    /// "Medium · Thin crust" — the subtitle every cart and summary row shows.
    var configurationSummary: String {
        crustName.map { "\(size.displayName) · \($0)" } ?? size.displayName
    }

    /// Two cart lines are "the same" only if the product, size, crust AND topping set all match.
    ///
    /// Without this, adding a plain pepperoni and a pepperoni with extra cheese would collapse into
    /// one line and the customer would be charged for the wrong pizza.
    ///
    /// The topping ids are sorted before comparing because selection order is not part of the
    /// pizza — {pepperoni, mushroom} and {mushroom, pepperoni} are one configuration.
    func hasSameConfiguration(as other: CartItem) -> Bool {
        guard productID == other.productID, size == other.size, crustID == other.crustID else {
            return false
        }
        return toppings.map(\.id).sorted() == other.toppings.map(\.id).sorted()
    }
}

// MARK: - The server's view of a cart

/// One line as the SERVER stores it — identifiers, plus prices resolved at read time.
struct ServerCartItem: Decodable, Identifiable {
    struct Topping: Decodable {
        let toppingId: UUIDString
        let toppingName: String
        let price: Double
    }

    let id: UUIDString
    let productId: UUIDString
    let productName: String
    let productType: ProductType
    let size: SizeName
    let crustId: UUIDString?
    let crustName: String?
    let quantity: Int
    let toppings: [Topping]
    let unitPrice: Double
    let lineTotal: Double
}

/// A cart as persisted by the API.
///
/// The stored cart holds identifiers only; the money below is recomputed from the current menu on
/// every read, by the same rules the checkout uses.
struct ServerCart: Decodable, Identifiable {
    let id: UUIDString
    let orderType: OrderType
    let items: [ServerCartItem]
    let subtotal: Double
    let tax: Double
    let deliveryFee: Double
    let total: Double
    let itemCount: Int
}

/// `PUT /api/carts/{id}` — the whole cart, replaced in one idempotent write.
///
/// Idempotent replacement rather than a set of add/remove/update calls is what makes the offline
/// story simple: a retry cannot double an item, and the device never has to reconcile a partial
/// sequence of writes it is unsure landed.
struct CartWriteRequest: Encodable {
    struct Item: Encodable {
        let productId: UUIDString
        let size: SizeName
        let crustId: UUIDString?
        let toppingIds: [UUIDString]
        let quantity: Int
    }

    let orderType: OrderType
    let items: [Item]
}
