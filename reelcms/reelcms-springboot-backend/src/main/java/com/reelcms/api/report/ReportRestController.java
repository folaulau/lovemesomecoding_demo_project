package com.reelcms.api.report;

import com.reelcms.api.dto.Dtos.ReportDto;
import com.reelcms.api.stream.ReelStatsStreamService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Tag(name = "Admin · Reports")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class ReportRestController {

    private final ReportService reportService;
    private final ReelStatsStreamService statsStream;

    @Operation(summary = "Every dashboard figure, from live aggregation pipelines")
    @GetMapping("/reports")
    public ReportDto reports() {
        return reportService.dashboard();
    }

    /**
     * Live view counts over SSE, fed by a MongoDB change stream.
     *
     * <p>The token arrives as a query parameter rather than a header because EventSource cannot set
     * headers — see JwtAuthenticationFilter, which accepts it only on this path.
     */
    @Operation(summary = "Live stats stream (SSE)")
    @GetMapping(value = "/stream/stats", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return statsStream.subscribe();
    }
}
