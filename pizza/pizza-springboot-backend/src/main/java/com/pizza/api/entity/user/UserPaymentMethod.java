package com.pizza.api.entity.user;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.pizza.api.entity.DatabaseTableNames;
import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A saved card — as a TOKEN, never as card data.
 *
 * <p><b>There is deliberately no card number, no CVC and no cardholder name on this entity.</b>
 * Storing a PAN drags an application into PCI-DSS scope, and it is unnecessary: Stripe holds the
 * card and gives us an opaque {@code pm_...} handle that is worthless without our secret key.
 *
 * <p>{@code brand}, {@code last4} and the expiry are DISPLAY metadata that Stripe itself returns,
 * kept only so the customer can recognise "Visa ending 4242" in a list. If you find yourself
 * adding a {@code cardNumber} field, stop.
 */
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(value = Include.NON_NULL)
@DynamicUpdate
@Entity
@SQLRestriction("deleted = false")
@Table(
        name = DatabaseTableNames.USER_PAYMENT_METHOD,
        indexes = {@Index(name = "idx_user_payment_method_user", columnList = "user_id")})
public class UserPaymentMethod implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false, unique = true)
    private Long id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, updatable = false, unique = true, length = 36)
    private UUID publicId;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** The opaque Stripe handle. This is the only thing that can actually charge the card. */
    @Column(name = "stripe_payment_method_id", nullable = false, length = 120)
    private String stripePaymentMethodId;

    @Column(name = "brand", length = 40)
    private String brand;

    /** Display only — the last four digits Stripe reports. NOT the card number. */
    @Column(name = "last4", length = 4)
    private String last4;

    @Column(name = "exp_month")
    private Integer expMonth;

    @Column(name = "exp_year")
    private Integer expYear;

    @Builder.Default
    @Column(name = "is_primary", nullable = false)
    private boolean primary = false;

    @Builder.Default
    @Column(name = "deleted", nullable = false)
    private boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    private void preCreate() {
        if (publicId == null) {
            publicId = UUID.randomUUID();
        }
    }
}
