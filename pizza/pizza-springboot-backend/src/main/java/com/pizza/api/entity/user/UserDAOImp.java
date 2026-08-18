package com.pizza.api.entity.user;

import com.pizza.api.dto.AdminUserDTO;
import com.pizza.api.mapper.AdminUserRowMapper;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Users, backed by a repository AND a JdbcTemplate.
 *
 * <p><b>Why both?</b> They are good at different things, and this class is the seam where that
 * choice gets made once instead of being argued about at every call site:
 *
 * <ul>
 *   <li><b>{@link UserRepository}</b> for saves and single-row lookups. Spring Data derives those
 *       from the method name, returns managed entities that dirty-checking can track, and honours
 *       the {@code @SQLRestriction} that hides soft-deleted rows. Hand-writing them would be more
 *       code that does less.
 *   <li><b>{@link NamedParameterJdbcTemplate}</b> for queries that aggregate. JPA has nothing to
 *       offer a query whose result is not an entity — see {@link #findAllForAdmin()}.
 * </ul>
 *
 * <p>{@code NamedParameterJdbcTemplate} rather than the plain one: it wraps a {@code JdbcTemplate}
 * and binds {@code :name} instead of positional {@code ?}, so a query that mentions the same value
 * twice does not depend on argument order.
 */
@Slf4j
@Repository
public class UserDAOImp implements UserDAO {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NamedParameterJdbcTemplate jdbcTemplate;

    @Autowired
    private AdminUserRowMapper adminUserRowMapper;

    // ------------------------------------------------- repository: the simple things

    @Override
    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email);
    }

    @Override
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmailIgnoreCase(email);
    }

    @Override
    public Optional<User> findByPublicId(UUID publicId) {
        return userRepository.findByPublicId(publicId);
    }

    @Override
    public List<User> getAll() {
        return userRepository.findAll();
    }

    @Override
    public List<User> getAllNewestFirst() {
        return userRepository.findAllByOrderByCreatedAtDesc();
    }

    @Override
    public User save(User user) {
        return userRepository.saveAndFlush(user);
    }

    // --------------------------------------------- jdbcTemplate: the custom query

    /**
     * The admin list, as ONE query.
     *
     * <p>This replaced a loop that, for every user, asked for an order count and then loaded the
     * full address and payment-method lists just to call {@code .size()} on them — 1 + 3N queries
     * for N users, two of which materialised entities nobody read a field of. Correlated subqueries
     * do the counting in the database and the whole page arrives in a single round trip.
     *
     * <p>Scalar subqueries are used rather than {@code LEFT JOIN … GROUP BY} deliberately: joining
     * three one-to-many tables at once multiplies the rows together, so a user with 2 addresses and
     * 3 cards would report 6 of each. That bug is subtle, plausible-looking, and very common.
     *
     * <p>{@code deleted = 0} is spelled out in every one of them. This is SQL, so the entities'
     * {@code @SQLRestriction} does not apply — see {@code ReportDAOImp} for the same warning and the
     * bug it is there to prevent.
     */
    @Override
    public List<AdminUserDTO> findAllForAdmin() {
        String query =
                """
                SELECT u.public_id  AS public_id,
                       u.email      AS email,
                       u.full_name  AS full_name,
                       u.role       AS role,
                       u.created_at AS created_at,
                       (SELECT COUNT(*) FROM customer_order o
                         WHERE o.user_id = u.id AND o.deleted = 0)      AS order_count,
                       (SELECT COUNT(*) FROM user_address a
                         WHERE a.user_id = u.id AND a.deleted = 0)      AS address_count,
                       (SELECT COUNT(*) FROM user_payment_method p
                         WHERE p.user_id = u.id AND p.deleted = 0)      AS payment_method_count
                FROM app_user u
                WHERE u.deleted = 0
                ORDER BY u.created_at DESC
                """;

        return jdbcTemplate.query(query, Map.of(), adminUserRowMapper);
    }
}
