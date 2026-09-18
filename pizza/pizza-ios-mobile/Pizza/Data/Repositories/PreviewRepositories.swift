#if DEBUG
import Foundation

/// Canned data and in-memory repositories, for SwiftUI previews and tests.
///
/// ## Why this is worth the file
///
/// A preview that needs a running Spring Boot backend is a preview nobody uses, and a preview that
/// hangs on a spinner teaches the reader nothing about the screen. Everything here returns
/// immediately, so `#Preview` renders the real view against real-shaped data.
///
/// It is wrapped in `#if DEBUG` so none of it — including the sample email addresses — is compiled
/// into a release build.
///
/// `SampleData` is deliberately *realistic*: a pizza with three sizes, a crust with a surcharge, a
/// topping in each category. Preview data that is too tidy hides exactly the layout problems
/// previews exist to catch — the two-line product name, the long topping list, the $0.00 crust.
enum SampleData {
    static let margherita = Product(
        id: "11111111-1111-1111-1111-111111111111",
        name: "Margherita",
        description: "San Marzano tomatoes, fresh mozzarella, basil.",
        type: .pizza,
        imageUrl: nil,
        active: true,
        displayOrder: 1,
        sizes: [
            ProductSize(id: "s1", size: .small, price: 9.99),
            ProductSize(id: "m1", size: .medium, price: 13.99),
            ProductSize(id: "l1", size: .large, price: 17.99),
        ],
        createdAt: "2026-01-01T00:00:00",
        updatedAt: "2026-01-01T00:00:00"
    )

    static let pepperoni = Product(
        id: "22222222-2222-2222-2222-222222222222",
        name: "Classic Pepperoni",
        description: "Double pepperoni, mozzarella, our house tomato sauce.",
        type: .pizza,
        imageUrl: nil,
        active: true,
        displayOrder: 2,
        sizes: [
            ProductSize(id: "s2", size: .small, price: 11.49),
            ProductSize(id: "m2", size: .medium, price: 15.49),
            ProductSize(id: "l2", size: .large, price: 19.49),
        ],
        createdAt: "2026-01-01T00:00:00",
        updatedAt: "2026-01-01T00:00:00"
    )

    static let cola = Product(
        id: "33333333-3333-3333-3333-333333333333",
        name: "Cola",
        description: "Ice cold, 20 oz.",
        type: .drink,
        imageUrl: nil,
        active: true,
        displayOrder: 10,
        sizes: [ProductSize(id: "s3", size: .medium, price: 2.49)],
        createdAt: "2026-01-01T00:00:00",
        updatedAt: "2026-01-01T00:00:00"
    )

    static let products = [margherita, pepperoni, cola]

    static let toppings = [
        Topping(id: "t1", name: "Pepperoni", price: 1.75, category: .meat, active: true),
        Topping(id: "t2", name: "Italian Sausage", price: 1.75, category: .meat, active: true),
        Topping(id: "t3", name: "Mushroom", price: 1.25, category: .veggie, active: true),
        Topping(id: "t4", name: "Red Onion", price: 1.00, category: .veggie, active: true),
        Topping(id: "t5", name: "Extra Mozzarella", price: 1.50, category: .cheese, active: true),
    ]

    static let crusts = [
        Crust(id: "c1", name: "Hand Tossed", priceDelta: 0, active: true, displayOrder: 1),
        Crust(id: "c2", name: "Thin & Crispy", priceDelta: 0, active: true, displayOrder: 2),
        Crust(id: "c3", name: "Stuffed Crust", priceDelta: 2.50, active: true, displayOrder: 3),
    ]

    static let customer = User(
        id: "u1",
        email: "customer@pizza.test",
        fullName: "Sam Carter",
        role: .customer,
        createdAt: "2026-01-01T00:00:00"
    )

    static let address = Address(
        id: "a1",
        label: "Home",
        recipientName: "Sam Carter",
        phone: "5035550142",
        line1: "1200 SW Morrison St",
        line2: "Apt 4B",
        city: "Portland",
        state: "OR",
        postalCode: "97205",
        primary: true
    )

    static let paymentMethod = PaymentMethod(
        id: "pm1",
        brand: "Visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2030,
        primary: true
    )

    static func cartItem(
        product: Product = pepperoni,
        size: SizeName = .medium,
        quantity: Int = 1,
        toppings: [Topping] = [toppings[0], toppings[2]]
    ) -> CartItem {
        CartItem(
            productID: product.id,
            productName: product.name,
            productType: product.type,
            size: size,
            basePrice: product.price(for: size) ?? 0,
            crustID: crusts[0].id,
            crustName: crusts[0].name,
            crustPriceDelta: crusts[0].priceDelta,
            toppings: toppings,
            quantity: quantity
        )
    }

    static let order = Order(
        id: "0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9",
        status: .paid,
        orderType: .delivery,
        customerName: "Sam Carter",
        email: "customer@pizza.test",
        phone: "5035550142",
        addressLine1: "1200 SW Morrison St",
        addressLine2: "Apt 4B",
        city: "Portland",
        state: "OR",
        postalCode: "97205",
        subtotal: 31.98,
        tax: 2.72,
        deliveryFee: 3.99,
        total: 38.69,
        cardBrand: "Visa",
        cardLast4: "4242",
        createdAt: "2026-09-18T18:24:00",
        updatedAt: "2026-09-18T18:25:00",
        items: [
            OrderItem(
                id: "oi1",
                productId: pepperoni.id,
                productName: "Classic Pepperoni",
                size: .medium,
                crustId: "c1",
                crustName: "Hand Tossed",
                quantity: 2,
                unitPrice: 15.99,
                lineTotal: 31.98,
                toppings: [
                    OrderItemTopping(id: "oit1", toppingId: "t3", toppingName: "Mushroom", price: 1.25),
                ]
            ),
        ]
    )
}

// MARK: - In-memory repositories

struct PreviewCatalogRepository: CatalogRepository {
    var products: [Product] = SampleData.products
    var toppings: [Topping] = SampleData.toppings
    var crusts: [Crust] = SampleData.crusts
    /// Set to simulate the failure branch — the state previews most often forget to look at.
    var error: Error?

    func products() async throws -> [Product] { try result(products) }
    func toppings() async throws -> [Topping] { try result(toppings) }
    func crusts() async throws -> [Crust] { try result(crusts) }

    private func result<T>(_ value: T) throws -> T {
        if let error { throw error }
        return value
    }
}

struct PreviewAuthRepository: AuthRepository {
    var user: User = SampleData.customer

    func login(email _: String, password _: String) async throws -> AuthenticationResponse {
        AuthenticationResponse(token: "preview.token", expiresInMinutes: 60, user: user)
    }

    func register(
        email _: String,
        password _: String,
        fullName _: String
    ) async throws -> AuthenticationResponse {
        AuthenticationResponse(token: "preview.token", expiresInMinutes: 60, user: user)
    }

    func currentUser() async throws -> User { user }
}

struct PreviewCartRepository: CartRepository {
    func createCart() async throws -> ServerCart { empty }
    func cart(id _: UUIDString) async throws -> ServerCart { empty }
    func replaceCart(id _: UUIDString, with _: CartWriteRequest) async throws -> ServerCart { empty }

    private var empty: ServerCart {
        ServerCart(
            id: "preview-cart",
            orderType: .delivery,
            items: [],
            subtotal: 0,
            tax: 0,
            deliveryFee: 0,
            total: 0,
            itemCount: 0
        )
    }
}

struct PreviewOrderRepository: OrderRepository {
    var orders: [Order] = [SampleData.order]
    var error: Error?

    func createOrder(
        _: OrderCreateRequest,
        authenticated _: Bool
    ) async throws -> OrderCreateResponse {
        if let error { throw error }
        return OrderCreateResponse(order: SampleData.order, clientSecret: "pi_preview_secret")
    }

    func paymentStatus(orderID _: UUIDString) async throws -> Order {
        if let error { throw error }
        return SampleData.order
    }

    func myOrders(page _: Int, size: Int) async throws -> Page<Order> {
        if let error { throw error }
        return Page(
            content: orders,
            totalElements: orders.count,
            totalPages: 1,
            number: 0,
            size: size
        )
    }
}

struct PreviewProfileRepository: ProfileRepository {
    var addresses: [Address] = [SampleData.address]
    var paymentMethods: [PaymentMethod] = [SampleData.paymentMethod]
    var error: Error?

    func addresses() async throws -> [Address] { try result(addresses) }
    func addAddress(_: AddressWriteRequest) async throws -> Address { try result(SampleData.address) }
    func updateAddress(id _: UUIDString, with _: AddressWriteRequest) async throws -> Address {
        try result(SampleData.address)
    }

    func makeAddressPrimary(id _: UUIDString) async throws { _ = try result(()) }
    func deleteAddress(id _: UUIDString) async throws { _ = try result(()) }

    func paymentMethods() async throws -> [PaymentMethod] { try result(paymentMethods) }
    func createSetupIntent() async throws -> String { try result("seti_preview_secret") }
    func addPaymentMethod(stripePaymentMethodID _: String) async throws -> PaymentMethod {
        try result(SampleData.paymentMethod)
    }

    func makePaymentMethodPrimary(id _: UUIDString) async throws { _ = try result(()) }
    func deletePaymentMethod(id _: UUIDString) async throws { _ = try result(()) }

    private func result<T>(_ value: T) throws -> T {
        if let error { throw error }
        return value
    }
}
#endif
