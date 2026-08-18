package com.pizza.api.mail;

import com.pizza.api.config.PizzaProperties;
import com.pizza.api.dto.OrderDTO;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Sends the order confirmation email.
 *
 * <h2>Why {@link ObjectProvider} instead of injecting {@link JavaMailSender} directly</h2>
 *
 * <p>Boot only creates a {@code JavaMailSender} when {@code spring.mail.host} is set. Injecting it
 * as a normal required dependency would therefore make the entire application fail to start on any
 * machine without mail configured — which, for a demo somebody just cloned, is a terrible first
 * experience. {@code ObjectProvider} is the container's supported way to say "give me this bean if
 * it exists": {@link ObjectProvider#getIfAvailable()} returns {@code null} rather than throwing.
 *
 * <p>The alternative, {@code @Autowired(required = false)}, does the same job less explicitly and
 * does not work with constructor injection. This is the same shape {@code StripeService} uses for
 * a missing API key, deliberately — one pattern for "optional integration", used consistently.
 *
 * <h2>Rendering</h2>
 *
 * <p>The body is produced by running {@code templates/receipt.html} through Thymeleaf by hand,
 * rather than by Spring MVC resolving a view. Same engine, same template, same model — but there
 * is no HTTP request involved, so there is no view resolution either. That is the whole trick to
 * templated email: {@code process()} returns the HTML as a String and you decide where it goes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MailServiceImpl implements MailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final TemplateEngine templateEngine;
    private final PizzaProperties properties;

    @Override
    public boolean isConfigured() {
        return mailSenderProvider.getIfAvailable() != null;
    }

    @Override
    public void sendOrderConfirmation(OrderDTO order) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            log.debug("No mail server configured — skipping the confirmation for order {}", order.id());
            return;
        }
        if (order.email() == null || order.email().isBlank()) {
            log.warn("Order {} has no email address — nothing to send to", order.id());
            return;
        }

        try {
            // The Context is the model. Thymeleaf has no idea it is producing an email; it sees the
            // same variable name the receipt page sets, which is why one template serves both.
            Context context = new Context();
            context.setVariable("order", order);
            String html = templateEngine.process("receipt", context);

            MimeMessage message = sender.createMimeMessage();
            // multipart=true is required to attach anything; the charset must be stated or a
            // customer named Zoë gets mojibake in the subject line.
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());

            helper.setFrom(properties.mail().from());
            helper.setTo(order.email());
            helper.setSubject("Your Pizza order " + order.id());
            // The second argument is what makes this HTML rather than a wall of angle brackets.
            // A production sender would pass a plain-text alternative as the first argument, for
            // clients that refuse HTML.
            helper.setText(html, true);

            sender.send(message);
            log.info("Confirmation for order {} sent to {}", order.id(), order.email());

        } catch (Exception ex) {
            // Swallowed on purpose, and logged loudly. This is called from an AFTER_COMMIT
            // listener: the order exists and is paid for. Letting a mail failure propagate would
            // achieve nothing except noise, since there is no transaction left to roll back.
            log.error("Could not send the confirmation for order {} — the order is unaffected", order.id(), ex);
        }
    }
}
