import XCTest
@testable import Pizza

final class CheckoutFormValidatorTests: XCTestCase {
    private func validForm() -> CheckoutForm {
        var form = CheckoutForm()
        form.customerName = "Sam Carter"
        form.email = "sam@example.com"
        form.addressLine1 = "1200 SW Morrison St"
        form.city = "Portland"
        form.state = "OR"
        form.postalCode = "97205"
        return form
    }

    private let deliveryTyped = CheckoutFormValidator.Context(orderType: .delivery, needsTypedAddress: true)
    private let deliverySaved = CheckoutFormValidator.Context(orderType: .delivery, needsTypedAddress: false)
    private let pickup = CheckoutFormValidator.Context(orderType: .carryout, needsTypedAddress: true)

    func testACompleteDeliveryFormIsValid() {
        XCTAssertTrue(CheckoutFormValidator.validate(validForm(), context: deliveryTyped).isEmpty)
    }

    func testWhitespaceIsNotAName() {
        var form = validForm()
        form.customerName = "   "

        XCTAssertNotNil(CheckoutFormValidator.validate(form, context: deliveryTyped)[.customerName])
    }

    func testPickupDoesNotRequireAnAddress() {
        // Address fields only exist for delivery, so validating them for pickup would block an
        // order that is perfectly complete.
        var form = validForm()
        form.addressLine1 = ""
        form.city = ""
        form.state = ""
        form.postalCode = ""

        XCTAssertTrue(CheckoutFormValidator.validate(form, context: pickup).isEmpty)
    }

    func testASavedAddressSkipsTheTypedFields() {
        var form = validForm()
        form.addressLine1 = ""
        form.postalCode = ""

        XCTAssertTrue(CheckoutFormValidator.validate(form, context: deliverySaved).isEmpty)
    }

    func testPostalCodeMustBeFiveDigits() {
        for invalid in ["9720", "972055", "9720A", "", "  "] {
            var form = validForm()
            form.postalCode = invalid
            XCTAssertNotNil(
                CheckoutFormValidator.validate(form, context: deliveryTyped)[.postalCode],
                "\(invalid.debugDescription) should be rejected"
            )
        }
    }

    func testPostalCodeToleratesSurroundingWhitespace() {
        var form = validForm()
        form.postalCode = " 97205 "

        XCTAssertNil(CheckoutFormValidator.validate(form, context: deliveryTyped)[.postalCode])
    }

    // MARK: - Email

    func testPlausibleEmailsAreAccepted() {
        // Deliberately permissive. Over-validating an email is a classic way to lose a customer,
        // and every address below is one a real person has.
        let accepted = [
            "sam@example.com",
            "sam.carter+pizza@example.co.uk",
            "s@a.io",
            "UPPER@EXAMPLE.COM",
            " padded@example.com ",
        ]

        for email in accepted {
            XCTAssertTrue(
                CheckoutFormValidator.isPlausibleEmail(email),
                "\(email) should be accepted"
            )
        }
    }

    func testObviousTyposAreRejected() {
        let rejected = [
            "",
            "sam",
            "sam@",
            "@example.com",
            "sam@example",
            "sam@.com",
            "sam@example.",
            "sam carter@example.com",
            "sam@@example.com",
        ]

        for email in rejected {
            XCTAssertFalse(
                CheckoutFormValidator.isPlausibleEmail(email),
                "\(email.debugDescription) should be rejected"
            )
        }
    }
}
