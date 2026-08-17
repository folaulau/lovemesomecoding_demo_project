package com.pizza.api.entity.topping;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.ToppingCreateDTO;
import com.pizza.api.dto.ToppingDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Toppings", description = "Topping catalogue (public)")
@RequestMapping("/api/toppings")
@RestController
@Slf4j
public class ToppingRestController {

    @Autowired
    private ToppingService toppingService;

    @Operation(summary = "List active toppings, ordered by category then name")
    @GetMapping
    public ResponseEntity<List<ToppingDTO>> getToppings() {
        log.info("GET /api/toppings");
        return new ResponseEntity<>(toppingService.getActiveToppings(), OK);
    }
}

@Tag(name = "Admin · Toppings", description = "Topping management (ADMIN only)")
@RequestMapping("/api/admin/toppings")
@RestController
@SecurityRequirement(name = "bearerAuth")
@Slf4j
class AdminToppingRestController {

    @Autowired
    private ToppingService toppingService;

    @GetMapping
    public ResponseEntity<List<ToppingDTO>> getAllToppings() {
        return new ResponseEntity<>(toppingService.getAllToppings(), OK);
    }

    @PostMapping
    public ResponseEntity<ToppingDTO> createTopping(@Valid @RequestBody ToppingCreateDTO dto) {
        return new ResponseEntity<>(toppingService.createTopping(dto), CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ToppingDTO> updateTopping(@PathVariable UUID id, @Valid @RequestBody ToppingCreateDTO dto) {
        return new ResponseEntity<>(toppingService.updateTopping(id, dto), OK);
    }

    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Void> deactivateTopping(@PathVariable UUID id) {
        toppingService.deactivateTopping(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTopping(@PathVariable UUID id) {
        toppingService.deleteTopping(id);
        return ResponseEntity.noContent().build();
    }
}
