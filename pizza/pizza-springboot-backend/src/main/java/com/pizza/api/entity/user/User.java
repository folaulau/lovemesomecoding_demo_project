package com.pizza.api.entity.user;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.pizza.api.entity.DatabaseTableNames;
import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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
 * A registered customer or admin.
 *
 * <p>Mapped to {@code app_user} because {@code user} is a keyword in MySQL and would need quoting
 * in every hand-written query.
 *
 * <p>Guests never get a row here — a guest order simply has a null user and an email on the order
 * itself. That is the whole implementation of "checkout without an account".
 */
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(value = Include.NON_NULL)
@DynamicUpdate
@Entity
@SQLRestriction("deleted = false")
@Table(name = DatabaseTableNames.USER)
public class User implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false, unique = true)
    private Long id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, updatable = false, unique = true, length = 36)
    private UUID publicId;

    @Column(name = "email", nullable = false, length = 180, unique = true)
    private String email;

    /**
     * A BCrypt hash, never a password. The column is 100 chars although BCrypt emits 60, leaving
     * room to migrate to a longer algorithm without a schema change.
     */
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "full_name", length = 150)
    private String fullName;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role = UserRole.CUSTOMER;

    /** Set the first time a card is saved. Payment methods attach to a Stripe Customer. */
    @Column(name = "stripe_customer_id", length = 120)
    private String stripeCustomerId;

    /**
     * Saved delivery addresses. Excluded from equals/toString for the usual @Data-and-JPA reason:
     * walking the collection would force a lazy load and recurse back through the child's user.
     */
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<UserAddress> addresses = new ArrayList<>();

    /** Saved cards — tokens only. See UserPaymentMethod. */
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<UserPaymentMethod> paymentMethods = new ArrayList<>();

    public void addAddress(UserAddress address) {
        addresses.add(address);
        address.setUser(this);
    }

    public void addPaymentMethod(UserPaymentMethod method) {
        paymentMethods.add(method);
        method.setUser(this);
    }

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
