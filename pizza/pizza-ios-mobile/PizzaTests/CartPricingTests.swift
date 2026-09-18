import XCTest
@testable import Pizza

final class CartPricingTests: XCTestCase {
    private let crust = SampleData.crusts[2] // Stuffed Crust, +$2.50
    private let pepperoni = SampleData.toppings[0] // +$1.75
    private let mushroom = SampleData.toppings[2] // +$1.25

    func testUnitPriceIsBasePlusCrustPlusToppings() {
        let item = CartItem(
            productID: "p1",
            productName: "Pepperoni",
            productType: .pizza,
            size: .medium,
            basePrice: 15.49,
            crustID: crust.id,
            crustName: crust.name,
            crustPriceDelta: crust.priceDelta,
            toppings: [pepperoni, mushroom],
            quantity: 1
        )

        XCTAssertEqual(CartPricing.unitPrice(of: item), 20.99)
    }

    func testLineTotalMultipliesByQuantity() {
        let item = SampleData.cartItem(quantity: 3, toppings: [])
        XCTAssertEqual(
            CartPricing.lineTotal(of: item),
            Money.rounded(CartPricing.unitPrice(of: item) * 3)
        )
    }

    func testDeliveryFeeAppliesOnlyToDelivery() {
        let items = [SampleData.cartItem(toppings: [])]

        let delivery = CartPricing.totals(for: items, orderType: .delivery)
        let pickup = CartPricing.totals(for: items, orderType: .carryout)

        XCTAssertEqual(delivery.deliveryFee, CartPricing.deliveryFee)
        XCTAssertEqual(pickup.deliveryFee, 0)
        XCTAssertEqual(delivery.total - pickup.total, CartPricing.deliveryFee, accuracy: 0.001)
    }

    func testEmptyDeliveryCartIsFreeRatherThanTheDeliveryFee() {
        // A $3.99 "total" for an empty basket is the state the cart is in every time the app is
        // first opened, which is why this case is explicit in `CartPricing` rather than implied.
        let totals = CartPricing.totals(for: [], orderType: .delivery)

        XCTAssertEqual(totals.deliveryFee, 0)
        XCTAssertEqual(totals.total, 0)
        XCTAssertEqual(totals.itemCount, 0)
    }

    func testItemCountSumsQuantitiesNotLines() {
        let items = [
            SampleData.cartItem(quantity: 2, toppings: []),
            SampleData.cartItem(product: SampleData.cola, quantity: 3, toppings: []),
        ]

        XCTAssertEqual(CartPricing.totals(for: items, orderType: .carryout).itemCount, 5)
    }

    func testTotalIsSubtotalPlusTaxPlusDelivery() {
        let items = [SampleData.cartItem(quantity: 2, toppings: [])]
        let totals = CartPricing.totals(for: items, orderType: .delivery)

        XCTAssertEqual(
            totals.total,
            Money.rounded(totals.subtotal + totals.tax + totals.deliveryFee),
            accuracy: 0.001
        )
        XCTAssertEqual(totals.tax, Money.rounded(totals.subtotal * CartPricing.taxRate), accuracy: 0.001)
    }
}
