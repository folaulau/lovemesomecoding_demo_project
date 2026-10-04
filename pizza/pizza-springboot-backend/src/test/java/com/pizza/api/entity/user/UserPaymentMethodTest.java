package com.pizza.api.entity.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.YearMonth;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The expiry rule. A plain unit test: no Spring, no database — {@code now} is passed in, so the
 * month boundary can be pinned exactly.
 */
@DisplayName("UserPaymentMethod expiry")
class UserPaymentMethodTest {

    private static UserPaymentMethod cardExpiring(Integer month, Integer year) {
        return UserPaymentMethod.builder().expMonth(month).expYear(year).build();
    }

    @Test
    @DisplayName("is still valid during its expiry month")
    void validThroughExpiryMonth() {
        assertThat(cardExpiring(12, 2026).isExpiredAt(YearMonth.of(2026, 12))).isFalse();
    }

    @Test
    @DisplayName("has expired the month after")
    void expiredTheFollowingMonth() {
        assertThat(cardExpiring(12, 2026).isExpiredAt(YearMonth.of(2027, 1))).isTrue();
    }

    @Test
    @DisplayName("compares the year, not just the month")
    void comparesYear() {
        assertThat(cardExpiring(1, 2027).isExpiredAt(YearMonth.of(2026, 12))).isFalse();
        assertThat(cardExpiring(6, 2025).isExpiredAt(YearMonth.of(2026, 1))).isTrue();
    }

    @Test
    @DisplayName("a missing expiry counts as not expired")
    void missingExpiryIsNotExpired() {
        assertThat(cardExpiring(null, 2026).isExpiredAt(YearMonth.of(2030, 1))).isFalse();
        assertThat(cardExpiring(12, null).isExpiredAt(YearMonth.of(2030, 1))).isFalse();
    }
}
