package com.pizza.api.entity.crust;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.CrustCreateDTO;
import com.pizza.api.dto.CrustDTO;
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

@Tag(name = "Crusts", description = "Crust catalogue (public)")
@RequestMapping("/api/crusts")
@RestController
@Slf4j
public class CrustRestController {

    @Autowired
    private CrustService crustService;

    @Operation(summary = "List active crusts in display order")
    @GetMapping
    public ResponseEntity<List<CrustDTO>> getCrusts() {
        log.info("GET /api/crusts");
        return new ResponseEntity<>(crustService.getActiveCrusts(), OK);
    }
}

@Tag(name = "Admin · Crusts", description = "Crust management (ADMIN only)")
@RequestMapping("/api/admin/crusts")
@RestController
@SecurityRequirement(name = "bearerAuth")
@Slf4j
class AdminCrustRestController {

    @Autowired
    private CrustService crustService;

    @GetMapping
    public ResponseEntity<List<CrustDTO>> getAllCrusts() {
        return new ResponseEntity<>(crustService.getAllCrusts(), OK);
    }

    @PostMapping
    public ResponseEntity<CrustDTO> createCrust(@Valid @RequestBody CrustCreateDTO dto) {
        return new ResponseEntity<>(crustService.createCrust(dto), CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CrustDTO> updateCrust(@PathVariable UUID id, @Valid @RequestBody CrustCreateDTO dto) {
        return new ResponseEntity<>(crustService.updateCrust(id, dto), OK);
    }

    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Void> deactivateCrust(@PathVariable UUID id) {
        crustService.deactivateCrust(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCrust(@PathVariable UUID id) {
        crustService.deleteCrust(id);
        return ResponseEntity.noContent().build();
    }
}
