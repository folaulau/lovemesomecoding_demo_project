import Foundation

/// What the checkout form collects.
///
/// A plain value type, separate from the view model, so the validation rules below are a pure
/// function of it — no observation, no main actor, no view. That is what makes them testable in
/// microseconds and reviewable without reading a screen.
struct CheckoutForm: Equatable {
    var customerName = ""
    var email = ""
    var phone = ""
    var addressLine1 = ""
    var city = ""
    var state = ""
    var postalCode = ""

    /// Which field a message belongs under.
    ///
    /// An enum, not a `String` key. `errors["postalCode"]` compiles with any typo and silently
    /// shows nothing; `errors[.postalCode]` does not compile if the case does not exist.
    enum Field: Hashable, CaseIterable {
        case customerName
        case email
        case addressLine1
        case city
        case state
        case postalCode
    }
}

/// The checkout form's rules.
///
/// Deliberately permissive: an address is validated by the delivery driver, not by a regular
/// expression. The rules only have to be strict enough to catch a typo and loose enough never to
/// reject a real address — over-validating an email is a classic way to lose a customer, and the
/// "correct" RFC 5322 pattern rejects addresses that work.
enum CheckoutFormValidator {
    struct Context {
        let orderType: OrderType
        /// False when a saved address is selected — the typed fields are then irrelevant.
        let needsTypedAddress: Bool
    }

    static func validate(_ form: CheckoutForm, context: Context) -> [CheckoutForm.Field: String] {
        var errors: [CheckoutForm.Field: String] = [:]

        if form.customerName.trimmed.isEmpty {
            errors[.customerName] = "Please tell us who the order is for."
        }

        if !isPlausibleEmail(form.email) {
            errors[.email] = "We need a valid email to send the receipt."
        }

        // Address fields only exist for delivery, and only when no saved address is selected.
        guard context.orderType == .delivery, context.needsTypedAddress else { return errors }

        if form.addressLine1.trimmed.isEmpty {
            errors[.addressLine1] = "We cannot deliver without a street address."
        }
        if form.city.trimmed.isEmpty {
            errors[.city] = "City is required."
        }
        if form.state.trimmed.isEmpty {
            errors[.state] = "State is required."
        }
        if !isFiveDigits(form.postalCode) {
            errors[.postalCode] = "Five digits, please."
        }

        return errors
    }

    /// "Something, an @, something, a dot, something."
    ///
    /// Written with `split` rather than a regular expression on purpose: it is easier to read, it
    /// cannot backtrack pathologically, and it says exactly what it checks.
    static func isPlausibleEmail(_ value: String) -> Bool {
        let trimmed = value.trimmed
        guard !trimmed.contains(" ") else { return false }

        let parts = trimmed.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty else { return false }

        let domain = parts[1]
        guard domain.contains(".") else { return false }

        let domainParts = domain.split(separator: ".", omittingEmptySubsequences: false)
        return domainParts.count >= 2 && domainParts.allSatisfy { !$0.isEmpty }
    }

    static func isFiveDigits(_ value: String) -> Bool {
        let trimmed = value.trimmed
        return trimmed.count == 5 && trimmed.allSatisfy(\.isNumber)
    }
}

extension String {
    /// Used everywhere a field is checked, because " " is not a name and `.isEmpty` says it is.
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
