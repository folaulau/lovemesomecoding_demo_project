package com.reelcms.api.exception;

import com.reelcms.api.exception.ApiError.ApiSubError;
import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Turns every exception into the one error shape the frontend understands. */
@Slf4j
@RestControllerAdvice
public class RestExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApi(ApiException ex) {
        return build(ex.getStatus(), ex.getMessage(), List.of());
    }

    /** Bean-validation failures, flattened into subErrors so the form can highlight fields. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        List<ApiSubError> subs = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ApiSubError(fe.getField(), fe.getRejectedValue(), fe.getDefaultMessage()))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "Validation failed", subs);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleTooLarge(MaxUploadSizeExceededException ex) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "That file is larger than the 100 MB limit.", List.of());
    }

    /**
     * The catch-all. It logs the stack trace but does NOT put it in the response: an exception
     * message can carry a connection string or a query, and this endpoint is public.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleEverythingElse(Exception ex) {
        log.error("Unhandled exception", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong on our side.", List.of());
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String message, List<ApiSubError> subs) {
        return ResponseEntity.status(status)
                .body(new ApiError(status.value(), status.getReasonPhrase(), message, subs, Instant.now()));
    }
}
