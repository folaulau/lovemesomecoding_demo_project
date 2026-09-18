import XCTest
@testable import Pizza

/// The reducer is a function from a value to a value, so its tests need no view, no network, no
/// async and no main actor. This whole file runs in microseconds — which is the argument for
/// writing the rules as a reducer in the first place.
final class CartReducerTests: XCTestCase {
    private func item(
        product: Product = SampleData.pepperoni,
        size: SizeName = .medium,
        crust: Crust? = SampleData.crusts[0],
        toppings: [Topping] = [],
        quantity: Int = 1
    ) -> CartItem {
        CartItem(
            productID: product.id,
            productName: product.name,
            productType: product.type,
            size: size,
            basePrice: product.price(for: size) ?? 0,
            crustID: crust?.id,
            crustName: crust?.name,
            crustPriceDelta: crust?.priceDelta ?? 0,
            toppings: toppings,
            quantity: quantity
        )
    }

    // MARK: - Adding

    func testAddingToAnEmptyCartCreatesALine() {
        let state = CartReducer.reduce(.initial, .add(item()))

        XCTAssertEqual(state.items.count, 1)
        XCTAssertEqual(state.items[0].quantity, 1)
    }

    func testAddingTheSameConfigurationBumpsTheQuantity() {
        var state = CartReducer.reduce(.initial, .add(item(quantity: 2)))
        state = CartReducer.reduce(state, .add(item(quantity: 3)))

        XCTAssertEqual(state.items.count, 1, "The same pizza twice is one line, not two.")
        XCTAssertEqual(state.items[0].quantity, 5)
    }

    func testADifferentToppingSetIsADifferentLine() {
        // Without this, a plain pepperoni and a pepperoni with extra cheese would collapse into one
        // line and the customer would be charged for the wrong pizza.
        var state = CartReducer.reduce(.initial, .add(item(toppings: [])))
        state = CartReducer.reduce(state, .add(item(toppings: [SampleData.toppings[4]])))

        XCTAssertEqual(state.items.count, 2)
    }

    func testToppingOrderDoesNotMakeADifferentConfiguration() {
        // {pepperoni, mushroom} and {mushroom, pepperoni} are one pizza. Selection order is not
        // part of what was ordered.
        let a = item(toppings: [SampleData.toppings[0], SampleData.toppings[2]])
        let b = item(toppings: [SampleData.toppings[2], SampleData.toppings[0]])

        var state = CartReducer.reduce(.initial, .add(a))
        state = CartReducer.reduce(state, .add(b))

        XCTAssertEqual(state.items.count, 1)
        XCTAssertEqual(state.items[0].quantity, 2)
    }

    func testADifferentSizeIsADifferentLine() {
        var state = CartReducer.reduce(.initial, .add(item(size: .medium)))
        state = CartReducer.reduce(state, .add(item(size: .large)))

        XCTAssertEqual(state.items.count, 2)
    }

    func testADifferentCrustIsADifferentLine() {
        var state = CartReducer.reduce(.initial, .add(item(crust: SampleData.crusts[0])))
        state = CartReducer.reduce(state, .add(item(crust: SampleData.crusts[2])))

        XCTAssertEqual(state.items.count, 2)
    }

    // MARK: - Quantity

    func testSettingQuantityToZeroRemovesTheLine() {
        // It is what a customer expects from a "−" button, and it keeps "a line with quantity 0"
        // out of every downstream calculation.
        let line = item(quantity: 1)
        var state = CartReducer.reduce(.initial, .add(line))
        state = CartReducer.reduce(state, .setQuantity(lineID: line.lineID, quantity: 0))

        XCTAssertTrue(state.isEmpty)
    }

    func testSettingANegativeQuantityRemovesTheLine() {
        let line = item()
        var state = CartReducer.reduce(.initial, .add(line))
        state = CartReducer.reduce(state, .setQuantity(lineID: line.lineID, quantity: -4))

        XCTAssertTrue(state.isEmpty)
    }

    func testSettingQuantityOnAnUnknownLineChangesNothing() {
        let state = CartReducer.reduce(.initial, .add(item()))
        let after = CartReducer.reduce(state, .setQuantity(lineID: UUID(), quantity: 9))

        XCTAssertEqual(state, after)
    }

    // MARK: - Removal and clearing

    func testRemoveDropsOnlyTheNamedLine() {
        let first = item(size: .small)
        let second = item(size: .large)

        var state = CartReducer.reduce(.initial, .add(first))
        state = CartReducer.reduce(state, .add(second))
        state = CartReducer.reduce(state, .remove(lineID: first.lineID))

        XCTAssertEqual(state.items.map(\.lineID), [second.lineID])
    }

    func testClearEmptiesItemsButKeepsTheOrderType() {
        // A customer who chose pickup and then ordered has not asked to switch back to delivery.
        var state = CartReducer.reduce(.initial, .setOrderType(.carryout))
        state = CartReducer.reduce(state, .add(item()))
        state = CartReducer.reduce(state, .clear)

        XCTAssertTrue(state.isEmpty)
        XCTAssertEqual(state.orderType, .carryout)
    }

    func testHydrateReplacesEverything() {
        var state = CartReducer.reduce(.initial, .add(item()))
        let saved = CartState(items: [item(product: SampleData.cola, quantity: 4)], orderType: .carryout)

        state = CartReducer.reduce(state, .hydrate(saved))

        XCTAssertEqual(state, saved)
    }

    // MARK: - Purity

    func testReducingDoesNotMutateTheInputState() {
        let original = CartReducer.reduce(.initial, .add(item(quantity: 1)))
        _ = CartReducer.reduce(original, .add(item(quantity: 5)))

        XCTAssertEqual(
            original.items[0].quantity, 1,
            "A reducer returns a new state; it never edits the one it was given."
        )
    }
}
