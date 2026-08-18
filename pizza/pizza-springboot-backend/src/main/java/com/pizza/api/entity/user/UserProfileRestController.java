package com.pizza.api.entity.user;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.AddressCreateDTO;
import com.pizza.api.dto.AddressDTO;
import com.pizza.api.dto.PaymentMethodCreateDTO;
import com.pizza.api.dto.PaymentMethodDTO;
import com.pizza.api.dto.SetupIntentDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * The signed-in customer's own profile.
 *
 * <p>Mounted at {@code /api/me/**} on purpose: every route here operates on the CALLER, and the
 * user is resolved from the verified token. There is no {@code userId} path variable to tamper
 * with, which removes a whole class of "read someone else's data" bug by construction.
 */
@Tag(name = "Profile", description = "Saved addresses and payment methods (signed-in customers)")
@RequestMapping("/api/me")
@RestController
@SecurityRequirement(name = "bearerAuth")
@Slf4j
public class UserProfileRestController {

    @Autowired
    private UserProfileService profileService;

    // ---------------------------------------------------------------- addresses

    @Operation(summary = "List my saved addresses, primary first")
    @GetMapping("/addresses")
    public ResponseEntity<List<AddressDTO>> getAddresses(Principal principal) {
        return new ResponseEntity<>(profileService.getAddresses(principal.getName()), OK);
    }

    @Operation(summary = "Save a new address")
    @PostMapping("/addresses")
    public ResponseEntity<AddressDTO> addAddress(Principal principal, @Valid @RequestBody AddressCreateDTO dto) {
        return new ResponseEntity<>(profileService.addAddress(principal.getName(), dto), CREATED);
    }

    @Operation(summary = "Update an address")
    @PutMapping("/addresses/{id}")
    public ResponseEntity<AddressDTO> updateAddress(
            Principal principal, @PathVariable UUID id, @Valid @RequestBody AddressCreateDTO dto) {
        return new ResponseEntity<>(profileService.updateAddress(principal.getName(), id, dto), OK);
    }

    @Operation(summary = "Make this the address selected by default at checkout")
    @PatchMapping("/addresses/{id}/primary")
    public ResponseEntity<AddressDTO> makeAddressPrimary(Principal principal, @PathVariable UUID id) {
        return new ResponseEntity<>(profileService.makeAddressPrimary(principal.getName(), id), OK);
    }

    @Operation(summary = "Delete an address")
    @DeleteMapping("/addresses/{id}")
    public ResponseEntity<Void> deleteAddress(Principal principal, @PathVariable UUID id) {
        profileService.deleteAddress(principal.getName(), id);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------- payment methods

    @Operation(summary = "List my saved cards — display metadata only")
    @GetMapping("/payment-methods")
    public ResponseEntity<List<PaymentMethodDTO>> getPaymentMethods(Principal principal) {
        return new ResponseEntity<>(profileService.getPaymentMethods(principal.getName()), OK);
    }

    @Operation(
            summary = "Start saving a card",
            description = "Returns a Stripe SetupIntent clientSecret. The browser collects the card "
                    + "with Stripe Elements; the details never reach this API.")
    @PostMapping("/payment-methods/setup-intent")
    public ResponseEntity<SetupIntentDTO> createSetupIntent(Principal principal) {
        return new ResponseEntity<>(profileService.createSetupIntent(principal.getName()), CREATED);
    }

    @Operation(summary = "Save a card the browser already collected (send only the pm_... token)")
    @PostMapping("/payment-methods")
    public ResponseEntity<PaymentMethodDTO> addPaymentMethod(
            Principal principal, @Valid @RequestBody PaymentMethodCreateDTO dto) {
        return new ResponseEntity<>(profileService.addPaymentMethod(principal.getName(), dto), CREATED);
    }

    @Operation(summary = "Make this the card selected by default at checkout")
    @PatchMapping("/payment-methods/{id}/primary")
    public ResponseEntity<PaymentMethodDTO> makePaymentMethodPrimary(Principal principal, @PathVariable UUID id) {
        return new ResponseEntity<>(profileService.makePaymentMethodPrimary(principal.getName(), id), OK);
    }

    @Operation(summary = "Forget a card — also detached at Stripe so it cannot be charged again")
    @DeleteMapping("/payment-methods/{id}")
    public ResponseEntity<Void> deletePaymentMethod(Principal principal, @PathVariable UUID id) {
        profileService.deletePaymentMethod(principal.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
