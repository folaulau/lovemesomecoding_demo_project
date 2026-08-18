package com.pizza.api.entity.order;

import com.pizza.api.dto.OrderDTO;
import io.swagger.v3.oas.annotations.Hidden;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * A server-rendered order receipt.
 *
 * <p><b>{@code @Controller}, not {@code @RestController}.</b> That single difference is the whole
 * lesson. {@code @RestController} is {@code @Controller} plus {@code @ResponseBody}, and
 * {@code @ResponseBody} means "serialise the return value into the response". Here the return value
 * is the string {@code "receipt"}, and we do not want the literal text {@code receipt} sent to the
 * browser — we want it resolved to {@code templates/receipt.html}. Adding {@code @RestController}
 * out of habit produces exactly that bug: a blank page showing one word, and no error anywhere.
 *
 * <h2>Why this page exists at all, next to a perfectly good JSON API</h2>
 *
 * <ul>
 *   <li>It has to be printable, and printing is a document problem, not an application problem.
 *   <li>It has to work from a link in an email, where there is no React app to boot.
 *   <li>The same template renders the email body itself — see {@code MailService}.
 * </ul>
 *
 * <p>Server-side rendering earns its place when the output is a <i>document</i>. It does not earn
 * its place for the menu or the cart, which are interactive and stay in React.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
@Hidden // A browser page, not part of the JSON API — keep it out of the OpenAPI document.
public class OrderReceiptController {

    private final CustomerOrderService orderService;

    /**
     * The model is the contract between this method and the template. Everything
     * {@code receipt.html} dereferences must be put here, and nothing else is visible to it.
     *
     * <p>Note that the DTO goes into the model, not the entity. Handing a JPA entity to a template
     * is how {@code LazyInitializationException} arrives in the view layer: rendering happens after
     * the controller returns, by which time {@code open-in-view=false} has already closed the
     * persistence context.
     */
    @GetMapping("/orders/{id}/receipt")
    public String receipt(@PathVariable UUID id, Model model) {
        log.info("GET /orders/{}/receipt", id);

        OrderDTO order = orderService.getOrderByPublicId(id);
        model.addAttribute("order", order);

        // Resolved by the Thymeleaf view resolver to templates/receipt.html — the prefix and
        // suffix come from spring.thymeleaf.* and default to "classpath:/templates/" and ".html".
        return "receipt";
    }
}
