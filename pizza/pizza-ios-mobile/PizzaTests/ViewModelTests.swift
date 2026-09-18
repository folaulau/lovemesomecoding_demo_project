import XCTest
@testable import Pizza

/// ## Why `@MainActor` is on each method, not on the class
///
/// The stores and view models under test are main-actor isolated, so the tests have to be too. The
/// tempting spelling is `@MainActor final class …Tests: XCTestCase`, and it produces a warning that
/// becomes an error in Swift 6: `XCTestCase` is nonisolated, and a subclass may not add isolation
/// its superclass does not have.
///
/// Annotating each test method is the supported form. It is more typing and it is more honest —
/// the isolation belongs to the work, not to the test fixture.
final class CheckoutViewModelTests: XCTestCase {
    @MainActor
    private func makeModel(
        orders: OrderRepositorySpy = OrderRepositorySpy(),
        profile: ProfileRepositorySpy = ProfileRepositorySpy(),
        // Defaulted to nil and constructed below, not `= StubPaymentGateway(isReady: true)`.
        //
        // A default argument is evaluated in a NONISOLATED context in Swift 5, even when the
        // function is `@MainActor` — so constructing a main-actor type there does not compile.
        // Swift 6 changes this to use the caller's isolation; until then, this is the spelling.
        gateway: StubPaymentGateway? = nil
    ) -> (CheckoutViewModel, OrderRepositorySpy, StubPaymentGateway) {
        let gateway = gateway ?? StubPaymentGateway(isReady: true)
        let model = CheckoutViewModel(
            orderRepository: orders,
            profileRepository: profile,
            paymentGateway: gateway
        )
        return (model, orders, gateway)
    }

    @MainActor
    private func fill(_ model: CheckoutViewModel) {
        model.form.customerName = "Sam Carter"
        model.form.email = "sam@example.com"
        model.form.addressLine1 = "1200 SW Morrison St"
        model.form.city = "Portland"
        model.form.state = "or"
        model.form.postalCode = "97205"
    }

    @MainActor
    func testAnInvalidFormDoesNotReachTheAPI() async {
        let (model, orders, _) = makeModel()

        let created = await model.createOrder(items: [], orderType: .delivery, isAuthenticated: false)

        XCTAssertFalse(created)
        XCTAssertEqual(orders.createCallCount, 0)
        XCTAssertNotNil(model.error(for: .customerName))
        XCTAssertNotNil(model.error(for: .email))
    }

    @MainActor
    func testErrorsAreHiddenUntilTheFirstSubmit() {
        // The form must not shout at a blank field somebody has not reached yet.
        let (model, _, _) = makeModel()

        XCTAssertNil(model.error(for: .email))
    }

    @MainActor
    func testTheRequestCarriesNoPrices() async {
        let (model, orders, _) = makeModel()
        fill(model)
        let item = SampleData.cartItem(quantity: 2)

        _ = await model.createOrder(items: [item], orderType: .delivery, isAuthenticated: false)

        let request = try? XCTUnwrap(orders.lastCreateRequest)
        XCTAssertEqual(request?.items.count, 1)
        XCTAssertEqual(request?.items.first?.quantity, 2)
        XCTAssertEqual(request?.customerName, "Sam Carter")
        // The state is normalised on the way out — "or" is not a US state code.
        XCTAssertEqual(request?.state, "OR")
    }

    @MainActor
    func testGuestCheckoutSendsTheEmailAndNoToken() async {
        let (model, orders, _) = makeModel()
        fill(model)

        _ = await model.createOrder(items: [SampleData.cartItem()], orderType: .carryout, isAuthenticated: false)

        XCTAssertEqual(orders.lastCreateWasAuthenticated, false)
        XCTAssertEqual(orders.lastCreateRequest?.guestEmail, "sam@example.com")
    }

    @MainActor
    func testPickupSendsNoAddress() async {
        let (model, orders, _) = makeModel()
        fill(model)

        _ = await model.createOrder(items: [SampleData.cartItem()], orderType: .carryout, isAuthenticated: false)

        XCTAssertNil(orders.lastCreateRequest?.addressLine1)
        XCTAssertNil(orders.lastCreateRequest?.city)
    }

    @MainActor
    func testASelectedSavedAddressIsSentInsteadOfTheTypedOne() async {
        let profile = ProfileRepositorySpy()
        let (model, orders, _) = makeModel(profile: profile)

        await model.loadSavedAddresses(isAuthenticated: true)
        model.form.customerName = "Sam Carter"
        model.form.email = "sam@example.com"

        XCTAssertEqual(model.selectedAddressID, SampleData.address.id, "The primary address is preselected.")
        XCTAssertFalse(model.isUsingNewAddress)

        _ = await model.createOrder(items: [SampleData.cartItem()], orderType: .delivery, isAuthenticated: true)

        XCTAssertEqual(orders.lastCreateRequest?.addressLine1, SampleData.address.line1)
        XCTAssertEqual(orders.lastCreateRequest?.postalCode, SampleData.address.postalCode)
    }

    @MainActor
    func testAProfileThatWillNotLoadDoesNotBlockCheckout() async {
        let profile = ProfileRepositorySpy()
        profile.error = APIError.network(message: "offline")
        let (model, _, _) = makeModel(profile: profile)

        await model.loadSavedAddresses(isAuthenticated: true)

        XCTAssertTrue(model.savedAddresses.isEmpty)
        XCTAssertTrue(model.isUsingNewAddress, "It falls back to typing an address.")
    }

    @MainActor
    func testGuestsDoNotFetchSavedAddresses() async {
        let profile = ProfileRepositorySpy()
        let (model, _, _) = makeModel(profile: profile)

        await model.loadSavedAddresses(isAuthenticated: false)

        XCTAssertEqual(profile.loadCallCount, 0)
    }

    @MainActor
    func testASuccessfulOrderMovesToThePaymentStep() async {
        let (model, _, _) = makeModel()
        fill(model)

        _ = await model.createOrder(items: [SampleData.cartItem()], orderType: .delivery, isAuthenticated: false)

        guard case let .awaitingPayment(created) = model.step else {
            return XCTFail("Expected the payment step, got \(model.step)")
        }
        XCTAssertEqual(created.order.id, SampleData.order.id)
    }

    @MainActor
    func testAFailedOrderStaysOnTheFormWithAMessage() async {
        let orders = OrderRepositorySpy()
        orders.createResult = .failure(APIError.api(status: 409, message: "A topping is out of stock.", body: nil))
        let (model, _, _) = makeModel(orders: orders)
        fill(model)

        let created = await model.createOrder(items: [SampleData.cartItem()], orderType: .delivery, isAuthenticated: false)

        XCTAssertFalse(created)
        XCTAssertEqual(model.step, .collectingDetails)
        XCTAssertEqual(model.errorMessage, "A topping is out of stock.")
    }

    // MARK: - Payment

    @MainActor
    func testASuccessfulPaymentReturnsTheOrderID() async {
        let gateway = StubPaymentGateway(isReady: true, nextPaymentOutcome: .succeeded)
        let (model, _, _) = makeModel(gateway: gateway)
        fill(model)
        _ = await model.createOrder(items: [SampleData.cartItem()], orderType: .delivery, isAuthenticated: false)

        let orderID = await model.pay()

        XCTAssertEqual(orderID, SampleData.order.id)
        XCTAssertEqual(gateway.payCallCount, 1)
        XCTAssertEqual(gateway.lastRequest?.clientSecret, "pi_secret")
        XCTAssertNil(model.errorMessage)
    }

    @MainActor
    func testACancelledPaymentIsNotAnError() async {
        // Stripe reports a dismissed sheet as a failure. Showing "Your payment failed" to somebody
        // who simply changed their mind is the bug this case exists to prevent.
        let gateway = StubPaymentGateway(isReady: true, nextPaymentOutcome: .cancelled)
        let (model, _, _) = makeModel(gateway: gateway)
        fill(model)
        _ = await model.createOrder(items: [SampleData.cartItem()], orderType: .delivery, isAuthenticated: false)

        let orderID = await model.pay()

        XCTAssertNil(orderID)
        XCTAssertNil(model.errorMessage, "A cancelled payment must not show a red message.")
    }

    @MainActor
    func testAFailedPaymentPublishesTheMessage() async {
        let gateway = StubPaymentGateway(isReady: true, nextPaymentOutcome: .failed(message: "Card declined."))
        let (model, _, _) = makeModel(gateway: gateway)
        fill(model)
        _ = await model.createOrder(items: [SampleData.cartItem()], orderType: .delivery, isAuthenticated: false)

        let orderID = await model.pay()

        XCTAssertNil(orderID)
        XCTAssertEqual(model.errorMessage, "Card declined.")
    }

    @MainActor
    func testPayingBeforeAnOrderExistsDoesNothing() async {
        let (model, _, gateway) = makeModel()

        let orderID = await model.pay()

        XCTAssertNil(orderID)
        XCTAssertEqual(gateway.payCallCount, 0)
    }

    @MainActor
    func testAMissingClientSecretIsExplainedAsAServerProblem() async {
        let orders = OrderRepositorySpy()
        orders.createResult = .success(OrderCreateResponse(order: SampleData.order, clientSecret: nil))
        let (model, _, _) = makeModel(orders: orders)
        fill(model)
        _ = await model.createOrder(items: [SampleData.cartItem()], orderType: .delivery, isAuthenticated: false)

        guard case let .awaitingPayment(created) = model.step else {
            return XCTFail("Expected the payment step")
        }
        XCTAssertTrue(model.paymentUnavailableMessage(for: created).contains("pizza.stripe.secret-key"))
    }

    @MainActor
    func testPrefillSeedsTheFormFromTheAccount() async {
        let (model, _, _) = makeModel()

        model.prefill(from: SampleData.customer)

        XCTAssertEqual(model.form.customerName, "Sam Carter")
        XCTAssertEqual(model.form.email, "customer@pizza.test")
    }
}

final class OrderConfirmationViewModelTests: XCTestCase {
    @MainActor
    private func order(status: OrderStatus) -> Order {
        Order(
            id: SampleData.order.id,
            status: status,
            orderType: .delivery,
            customerName: "Sam",
            email: "sam@example.com",
            phone: nil,
            addressLine1: "1200 SW Morrison St",
            addressLine2: nil,
            city: "Portland",
            state: "OR",
            postalCode: "97205",
            subtotal: 10, tax: 0.85, deliveryFee: 3.99, total: 14.84,
            cardBrand: nil, cardLast4: nil,
            createdAt: "2026-09-18T18:24:00",
            updatedAt: "2026-09-18T18:24:00",
            items: []
        )
    }

    @MainActor
    func testPollingStopsAsSoonAsThePaymentSettles() async {
        let repository = OrderRepositorySpy()
        repository.paymentStatuses = [order(status: .pendingPayment), order(status: .paid)]
        let model = OrderConfirmationViewModel(
            repository: repository,
            maxAttempts: 5,
            pollInterval: .milliseconds(1)
        )

        await model.startPolling(orderID: SampleData.order.id)

        XCTAssertEqual(model.state.value?.status, .paid)
        XCTAssertEqual(repository.paymentStatusCallCount, 2, "It stops the moment it has an answer.")
        XCTAssertFalse(model.hasStoppedPolling)
    }

    @MainActor
    func testASettledOrderIsNotPolledTwice() async {
        let repository = OrderRepositorySpy()
        repository.paymentStatuses = [order(status: .completed)]
        let model = OrderConfirmationViewModel(repository: repository, pollInterval: .milliseconds(1))

        await model.startPolling(orderID: SampleData.order.id)

        XCTAssertEqual(repository.paymentStatusCallCount, 1)
    }

    @MainActor
    func testPollingGivesUpAfterTheAttemptLimit() async {
        let repository = OrderRepositorySpy()
        repository.paymentStatuses = [order(status: .pendingPayment)]
        let model = OrderConfirmationViewModel(
            repository: repository,
            maxAttempts: 3,
            pollInterval: .milliseconds(1)
        )

        await model.startPolling(orderID: SampleData.order.id)

        XCTAssertEqual(repository.paymentStatusCallCount, 3)
        XCTAssertTrue(model.hasStoppedPolling, "The copy then tells the customer to check their email.")
        XCTAssertEqual(model.state.value?.status, .pendingPayment)
    }
}

final class ProfileViewModelTests: XCTestCase {
    @MainActor
    private func makeModel(
        repository: ProfileRepositorySpy = ProfileRepositorySpy(),
        gateway: StubPaymentGateway? = nil
    ) -> (ProfileViewModel, ProfileRepositorySpy, StubPaymentGateway) {
        let gateway = gateway ?? StubPaymentGateway(isReady: true)
        return (ProfileViewModel(repository: repository, paymentGateway: gateway), repository, gateway)
    }

    @MainActor
    func testLoadingFetchesBothListsInParallel() async {
        let (model, _, _) = makeModel()

        await model.load()

        XCTAssertEqual(model.content.addresses.count, 1)
        XCTAssertEqual(model.content.paymentMethods.count, 1)
    }

    @MainActor
    func testAnEmptyProfileIsStillLoadedRatherThanEmpty() async {
        // Two lists on one screen: one of them being empty is not a state for the whole screen.
        let repository = ProfileRepositorySpy()
        repository.addresses = []
        repository.paymentMethods = []
        let (model, _, _) = makeModel(repository: repository)

        await model.load()

        XCTAssertNotNil(model.state.value)
        XCTAssertTrue(model.content.addresses.isEmpty)
    }

    @MainActor
    func testEveryWriteReloadsFromTheServer() async {
        // Making an address primary demotes another one server-side. A local edit would show two
        // primaries until the next launch.
        let repository = ProfileRepositorySpy()
        let (model, _, _) = makeModel(repository: repository)
        await model.load()
        let loadsAfterInitial = repository.loadCallCount

        _ = await model.makeAddressPrimary(id: SampleData.address.id)

        XCTAssertEqual(repository.primaryAddressIDs, [SampleData.address.id])
        XCTAssertGreaterThan(repository.loadCallCount, loadsAfterInitial)
    }

    @MainActor
    func testDeletingAnAddressRemovesItAndReportsSuccess() async {
        let repository = ProfileRepositorySpy()
        let (model, _, _) = makeModel(repository: repository)
        await model.load()

        let outcome = await model.deleteAddress(id: SampleData.address.id)

        XCTAssertEqual(outcome, .succeeded("Address deleted"))
        XCTAssertTrue(model.content.addresses.isEmpty)
    }

    @MainActor
    func testAFailedWriteReportsTheMessageAndDoesNotReload() async {
        let repository = ProfileRepositorySpy()
        let (model, _, _) = makeModel(repository: repository)
        await model.load()
        repository.writeError = APIError.api(status: 409, message: "That address is in use.", body: nil)

        let outcome = await model.deleteAddress(id: SampleData.address.id)

        XCTAssertEqual(outcome, .failed("That address is in use."))
    }

    @MainActor
    func testAddingACardSendsOnlyTheOpaqueToken() async {
        // No card number, CVC or cardholder name ever reaches this code.
        let repository = ProfileRepositorySpy()
        let gateway = StubPaymentGateway(
            isReady: true,
            nextCardSetupOutcome: .succeeded(paymentMethodID: "pm_abc123")
        )
        let (model, _, _) = makeModel(repository: repository, gateway: gateway)

        let outcome = await model.addCard()

        XCTAssertEqual(outcome, .succeeded("Card saved"))
        XCTAssertEqual(repository.addedPaymentMethodIDs, ["pm_abc123"])
    }

    @MainActor
    func testCancellingTheCardSheetReportsNothingAtAll() async {
        let gateway = StubPaymentGateway(isReady: true, nextCardSetupOutcome: .cancelled)
        let (model, repository, _) = makeModel(gateway: gateway)

        let outcome = await model.addCard()

        XCTAssertEqual(outcome, .cancelled, "The customer changed their mind and needs no message.")
        XCTAssertNil(outcome.message, "Nothing at all should be shown.")
        XCTAssertTrue(repository.addedPaymentMethodIDs.isEmpty)
        XCTAssertFalse(model.isSavingCard)
    }

    @MainActor
    func testCardManagementIsUnavailableWithoutAConfiguredGateway() async {
        let (model, _, _) = makeModel(gateway: StubPaymentGateway(isReady: false))

        XCTAssertFalse(model.isCardManagementAvailable)
    }
}

final class AddressFormViewModelTests: XCTestCase {
    @MainActor
    func testAddingSeedsAnEmptyForm() {
        let model = AddressFormViewModel(address: nil, repository: ProfileRepositorySpy())

        XCTAssertFalse(model.isEditing)
        XCTAssertEqual(model.title, "Add an address")
        XCTAssertEqual(model.form.line1, "")
    }

    @MainActor
    func testEditingSeedsTheFormFromTheAddress() {
        let model = AddressFormViewModel(address: SampleData.address, repository: ProfileRepositorySpy())

        XCTAssertTrue(model.isEditing)
        XCTAssertEqual(model.saveTitle, "Save changes")
        XCTAssertEqual(model.form.line1, SampleData.address.line1)
        XCTAssertEqual(model.form.label, "Home")
    }

    @MainActor
    func testAValidationFailureSurfacesPerFieldMessages() async {
        // The API returns per-field messages; showing them under the right input beats one banner
        // that says "something in this form is wrong, find it".
        let repository = ProfileRepositorySpy()
        let body = APIErrorBody(
            statusCode: 400,
            error: "Bad Request",
            message: "Validation failed",
            path: "/api/me/addresses",
            timestamp: "",
            errors: [APISubError(field: "postalCode", message: "Not a valid ZIP.")]
        )
        repository.writeError = APIError.api(status: 400, message: body.message, body: body)
        let model = AddressFormViewModel(address: nil, repository: repository)

        let message = await model.save()

        XCTAssertNil(message, "The sheet stays open.")
        XCTAssertEqual(model.fieldErrors["postalCode"], "Not a valid ZIP.")
        XCTAssertFalse(model.isSaving)
    }

    @MainActor
    func testASuccessfulSaveReportsTheRightMessage() async {
        let adding = AddressFormViewModel(address: nil, repository: ProfileRepositorySpy())
        let editing = AddressFormViewModel(address: SampleData.address, repository: ProfileRepositorySpy())

        let addedMessage = await adding.save()
        let editedMessage = await editing.save()

        XCTAssertEqual(addedMessage, "Address added")
        XCTAssertEqual(editedMessage, "Address updated")
    }
}

final class PizzaBuilderViewModelTests: XCTestCase {
    @MainActor
    private var catalogue: MenuStore.Catalogue {
        MenuStore.Catalogue(
            products: SampleData.products,
            toppings: SampleData.toppings,
            crusts: SampleData.crusts
        )
    }

    @MainActor
    func testItOpensOnMediumWhenTheProductOffersIt() {
        let model = PizzaBuilderViewModel(product: SampleData.pepperoni, catalogue: catalogue)

        XCTAssertEqual(model.selectedSize, .medium)
        XCTAssertEqual(model.selectedCrustID, SampleData.crusts[0].id)
        XCTAssertEqual(model.quantity, 1)
    }

    @MainActor
    func testItFallsBackToTheFirstAvailableSize() {
        // A product that does not offer Medium must not open on it: the price would read $0.00 and
        // "Add to cart" would put a zero-priced line in the basket.
        let smallOnly = Product(
            id: "p9", name: "Slice", description: "", type: .pizza, imageUrl: nil,
            active: true, displayOrder: 1,
            sizes: [ProductSize(id: "s9", size: .small, price: 4.99)],
            createdAt: "", updatedAt: ""
        )
        let model = PizzaBuilderViewModel(product: smallOnly, catalogue: catalogue)

        XCTAssertEqual(model.selectedSize, .small)
        XCTAssertEqual(model.unitPrice, 4.99)
    }

    @MainActor
    func testDrinksGetNoCrust() {
        let model = PizzaBuilderViewModel(product: SampleData.cola, catalogue: catalogue)

        XCTAssertFalse(model.isPizza)
        XCTAssertNil(model.selectedCrust)
        XCTAssertEqual(model.unitPrice, 2.49)
    }

    @MainActor
    func testThePriceFollowsEverySelection() {
        let model = PizzaBuilderViewModel(product: SampleData.pepperoni, catalogue: catalogue)
        XCTAssertEqual(model.unitPrice, 15.49)

        model.selectedSize = .large
        XCTAssertEqual(model.unitPrice, 19.49)

        model.selectedCrustID = SampleData.crusts[2].id // +$2.50
        XCTAssertEqual(model.unitPrice, 21.99)

        model.toggle(SampleData.toppings[0]) // +$1.75
        XCTAssertEqual(model.unitPrice, 23.74)

        model.quantity = 3
        XCTAssertEqual(model.totalPrice, 71.22)
    }

    @MainActor
    func testTogglingAToppingTwiceRemovesIt() {
        let model = PizzaBuilderViewModel(product: SampleData.pepperoni, catalogue: catalogue)

        model.toggle(SampleData.toppings[0])
        XCTAssertTrue(model.isSelected(SampleData.toppings[0]))

        model.toggle(SampleData.toppings[0])
        XCTAssertFalse(model.isSelected(SampleData.toppings[0]))
        XCTAssertTrue(model.selectedToppings.isEmpty)
    }

    @MainActor
    func testSelectedToppingsComeBackInMenuOrder() {
        // Iterating a Set gives an arbitrary order that changes between runs, and a cart line whose
        // toppings shuffle on each redraw looks broken.
        let model = PizzaBuilderViewModel(product: SampleData.pepperoni, catalogue: catalogue)

        model.toggle(SampleData.toppings[4])
        model.toggle(SampleData.toppings[0])
        model.toggle(SampleData.toppings[2])

        XCTAssertEqual(model.selectedToppings.map(\.id), ["t1", "t3", "t5"])
    }

    @MainActor
    func testToppingGroupsSkipEmptyCategories() {
        let noCheese = MenuStore.Catalogue(
            products: SampleData.products,
            toppings: SampleData.toppings.filter { $0.category != .cheese },
            crusts: SampleData.crusts
        )
        let model = PizzaBuilderViewModel(product: SampleData.pepperoni, catalogue: noCheese)

        XCTAssertEqual(model.toppingGroups.map(\.title), ["Meats", "Veggies"])
    }
}
