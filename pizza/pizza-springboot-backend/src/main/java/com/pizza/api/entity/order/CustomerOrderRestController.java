package com.pizza.api.entity.order;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.OrderCreateDTO;
import com.pizza.api.dto.OrderCreateResponseDTO;
import com.pizza.api.dto.OrderDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Orders", description = "Placing and tracking orders")
@RequestMapping("/api/orders")
@RestController
@Slf4j
public class CustomerOrderRestController {

    @Autowired
    private CustomerOrderService orderService;

    /**
     * Open to anonymous callers — that is what makes guest checkout work.
     *
     * <p>{@code Principal} is null for a guest and carries the email for a signed-in user, so one
     * endpoint serves both without branching in the client.
     */
    @Operation(summary = "Place an order and open a Stripe PaymentIntent")
    @PostMapping
    public ResponseEntity<OrderCreateResponseDTO> createOrder(
            @Valid @RequestBody OrderCreateDTO dto, Principal principal) {
        String email = principal == null ? null : principal.getName();
        log.info("POST /api/orders guest={}", email == null);
        return new ResponseEntity<>(orderService.createOrder(dto, email), CREATED);
    }

    @Operation(summary = "Fetch an order by its public UUID")
    @GetMapping("/{id}")
    public ResponseEntity<OrderDTO> getOrder(@PathVariable UUID id) {
        log.info("GET /api/orders/{}", id);
        return new ResponseEntity<>(orderService.getOrderByPublicId(id), OK);
    }

    @Operation(
            summary = "Re-check payment with Stripe",
            description = "The confirmation page polls this, because webhooks do not reach localhost "
                    + "unless `stripe listen` is running.")
    @GetMapping("/{id}/payment-status")
    public ResponseEntity<OrderDTO> getPaymentStatus(@PathVariable UUID id) {
        return new ResponseEntity<>(orderService.refreshPaymentStatus(id), OK);
    }

    @Operation(summary = "The signed-in user's order history")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/mine")
    public ResponseEntity<Page<OrderDTO>> getMyOrders(
            Principal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return new ResponseEntity<>(orderService.getMyOrders(principal.getName(), PageRequest.of(page, size)), OK);
    }
}

@Tag(name = "Admin · Orders", description = "Order management (ADMIN only)")
@RequestMapping("/api/admin/orders")
@RestController
@SecurityRequirement(name = "bearerAuth")
@Slf4j
class AdminOrderRestController {

    @Autowired
    private CustomerOrderService orderService;

    @Operation(summary = "All orders, newest first")
    @GetMapping
    public ResponseEntity<Page<OrderDTO>> getAllOrders(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        log.info("GET /api/admin/orders page={} size={}", page, size);
        return new ResponseEntity<>(orderService.getAllOrders(PageRequest.of(page, size)), OK);
    }

    @Operation(summary = "Move an order through its lifecycle")
    @PatchMapping("/{id}/status")
    public ResponseEntity<OrderDTO> updateStatus(@PathVariable UUID id, @RequestBody StatusUpdateDTO update) {
        log.info("PATCH /api/admin/orders/{}/status -> {}", id, update.status());
        return new ResponseEntity<>(orderService.updateStatus(id, update.status()), OK);
    }

    record StatusUpdateDTO(OrderStatus status) {}
}
