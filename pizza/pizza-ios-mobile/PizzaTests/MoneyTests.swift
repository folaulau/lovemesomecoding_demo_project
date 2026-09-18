import XCTest
@testable import Pizza

/// Money is the part of the app a customer checks, so it is the part most worth testing.
final class MoneyTests: XCTestCase {
    func testRoundingFixesBinaryFloatingPointDrift() {
        // The motivating case: 13.99 + 1.5 + 1.75 evaluates to 17.240000000000002 in binary
        // floating point. Displaying that to a customer is a bug report.
        XCTAssertEqual(Money.rounded(13.99 + 1.5 + 1.75), 17.24)
    }

    func testRoundingIsHalfUpRatherThanBankers() {
        // Swift's default `.rounded()` is `.toNearestOrEven`, which would give 0.12 here. A price
        // is rounded half UP, which is what a customer expects and what a till does.
        XCTAssertEqual(Money.rounded(0.125), 0.13)
        XCTAssertEqual(Money.rounded(0.135), 0.14)
    }

    func testRoundingHandlesNegativesAwayFromZero() {
        XCTAssertEqual(Money.rounded(-0.125), -0.13)
    }

    func testFormatUsesUSCurrencyRegardlessOfDeviceLocale() {
        // The price IS in dollars. Formatting it as "13,99 €" for a customer whose phone is set to
        // French would not convert anything — it would lie about the currency.
        XCTAssertEqual(Money.format(13.99), "$13.99")
        XCTAssertEqual(Money.format(0), "$0.00")
        XCTAssertEqual(Money.format(1234.5), "$1,234.50")
    }

    func testFormatRoundsBeforeFormatting() {
        XCTAssertEqual(Money.format(17.240000000000002), "$17.24")
    }
}
