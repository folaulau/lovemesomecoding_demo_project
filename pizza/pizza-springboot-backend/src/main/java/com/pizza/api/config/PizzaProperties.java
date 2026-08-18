package com.pizza.api.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Every {@code pizza.*} setting, bound once into typed objects.
 *
 * <p>This class replaced nine scattered {@code @Value} annotations. Two of them — the tax rate and
 * the delivery fee — were declared in <i>both</i> {@code PricingService} and {@code CartServiceImpl},
 * which is the failure mode {@code @Value} invites: the same key spelled out in two places, with
 * nothing checking that they still agree. Bind it once and the duplication has nowhere to live.
 *
 * <p><b>Why records.</b> A record component can only be set by the constructor, so these values are
 * immutable after startup. Spring Boot binds constructor arguments by name, which is why no setters
 * and no {@code @ConstructorBinding} are needed here.
 *
 * <p><b>Why {@code @Validated} matters more than it looks.</b> The constraints below are checked
 * while the context is starting, so a missing or nonsensical value fails the application at boot
 * with a message naming the property. The {@code @Value} version failed later and worse: a missing
 * {@code pizza.jwt.secret} became a null field, and the first person to log in got a
 * {@code NullPointerException} from deep inside the JWT library.
 *
 * @see <a href="https://docs.spring.io/spring-boot/reference/features/external-config.html">Spring
 *     Boot externalized configuration</a>
 */
@Validated
@ConfigurationProperties(prefix = "pizza")
public record PizzaProperties(
        @Valid Pricing pricing,
        @Valid Jwt jwt,
        @Valid Stripe stripe,
        @Valid Cors cors,
        @Valid Storage storage,
        @Valid Mail mail) {

    /**
     * Prices the server computes and the client never sends.
     *
     * <p>See {@code PricingService} for why that distinction is a security boundary rather than a
     * style preference.
     */
    public record Pricing(
            @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal taxRate, @DecimalMin("0.0") BigDecimal deliveryFee) {}

    /**
     * Token signing.
     *
     * <p>The 32-character minimum is not arbitrary: HS256 requires a key of at least 256 bits, and
     * jjwt throws {@code WeakKeyException} if you hand it anything shorter. Catching that here
     * turns a runtime failure on the first login into a startup failure with a clear message.
     */
    public record Jwt(@NotBlank @Size(min = 32) String secret, @Positive long expirationMinutes) {}

    /**
     * Stripe credentials.
     *
     * <p>Deliberately NOT {@code @NotBlank}: {@code application.properties} defaults these to empty
     * so the app still starts without Stripe keys. Payment endpoints then fail loudly when used,
     * which is the right trade for a demo someone is cloning for the first time.
     */
    public record Stripe(String secretKey, String publishableKey, String webhookSecret) {}

    /**
     * Browser origins allowed to call this API.
     *
     * <p>Binding to {@code List<String>} rather than a {@code String} removes the
     * {@code split(",")} that every {@code @Value} version of this ends up doing by hand. Boot
     * splits a comma-separated property into a list for you.
     */
    public record Cors(@NotEmpty List<String> allowedOrigins) {}

    /**
     * Where uploaded product images land.
     *
     * <p>{@code maxImageBytes} is checked in application code and is deliberately SMALLER than
     * {@code spring.servlet.multipart.max-file-size}. The two limits are not redundant: the servlet
     * limit is enforced while the request is still being parsed and produces a raw
     * {@code MaxUploadSizeExceededException}, whereas this one produces a normal 400 with a message
     * a user can act on. The servlet limit is the backstop; this is the rule.
     */
    public record Storage(@NotBlank String uploadDir, @Positive long maxImageBytes) {}

    /**
     * Outgoing mail.
     *
     * <p>Only the envelope sender lives here — the SMTP host, port and credentials are Boot's own
     * {@code spring.mail.*} properties, and duplicating them under {@code pizza.*} would just give
     * the two copies a chance to disagree. Bind your own settings, not the framework's.
     */
    public record Mail(@NotBlank String from) {}
}
