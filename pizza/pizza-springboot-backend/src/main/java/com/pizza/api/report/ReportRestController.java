package com.pizza.api.report;

import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.ReportDTOs;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin · Reports", description = "Sales reporting (ADMIN only)")
@RequestMapping("/api/admin/reports")
@RestController
@SecurityRequirement(name = "bearerAuth")
@Slf4j
public class ReportRestController {

    @Autowired
    private ReportService reportService;

    @Operation(
            summary = "Everything the reports dashboard needs, in one request",
            description = "One round trip rather than four, because the four charts are always shown together.")
    @GetMapping("/dashboard")
    public ResponseEntity<ReportDTOs.Dashboard> getDashboard(@RequestParam(defaultValue = "30") int days) {
        log.info("GET /api/admin/reports/dashboard days={}", days);
        return new ResponseEntity<>(reportService.getDashboard(days), OK);
    }
}
