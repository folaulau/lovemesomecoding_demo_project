import Foundation

/// Money formatting and rounding.
///
/// ## Why `Double` and not `Decimal`
///
/// The rule for money is normally "never use a binary floating-point type", and it is a good rule.
/// It is knowingly set aside here, for one reason: **the device is never the authority on price.**
/// `PricingService` on the backend recomputes every figure from the database when the order is
/// placed and ignores whatever this app claims — otherwise anyone could patch the binary and buy a
/// large pizza for a cent. Everything computed on this side is a *preview* shown before the
/// customer commits.
///
/// Given that, `Double` is what the API's JSON numbers decode to natively, and converting to
/// `Decimal` and back would introduce its own conversion pitfalls (`Decimal(13.99)` captures the
/// binary approximation, not the decimal literal) in exchange for precision that is discarded a
/// moment later anyway.
///
/// **If the device were authoritative — an offline point-of-sale, a receipt printer — this would be
/// `Decimal` throughout, or integer cents.** That is the production choice; this is the teaching one,
/// and the rounding below is what keeps the preview honest in the meantime.
enum Money {
    /// Rounds to cents.
    ///
    /// Binary floating point cannot represent 13.99, so 13.99 + 1.5 + 1.75 lands on
    /// 17.240000000000002. Rounding at each boundary keeps displayed totals sane rather than
    /// letting the error accumulate across a long cart.
    ///
    /// `.toNearestOrAwayFromZero` is "half up", which is what a customer expects from a price;
    /// Swift's default `.toNearestOrEven` (banker's rounding) would round 0.125 to 0.12.
    static func rounded(_ value: Double) -> Double {
        (value * 100).rounded(.toNearestOrAwayFromZero) / 100
    }

    /// Formats a number as US currency.
    ///
    /// The formatter is created once and reused. `NumberFormatter` is genuinely expensive to
    /// construct — it reads locale data — and building one inside a `body` that runs on every
    /// frame of a scroll is a classic, invisible SwiftUI performance bug.
    ///
    /// The currency is pinned to USD rather than taken from the device locale, because the price
    /// *is* in dollars: formatting 13.99 as "13,99 €" for a customer whose phone is set to French
    /// would not convert anything, it would simply lie about the currency.
    static func format(_ amount: Double) -> String {
        formatter.string(from: NSNumber(value: rounded(amount)))
            ?? String(format: "$%.2f", rounded(amount))
    }

    private static let formatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.locale = Locale(identifier: "en_US")
        return formatter
    }()
}
