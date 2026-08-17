package com.pizza.api.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Turns exceptions into the {@link ApiError} envelope.
 *
 * <p>{@code @RestControllerAdvice} applies across every controller, so this logic lives in one
 * place rather than being repeated as try/catch in each handler method.
 */
@RestControllerAdvice
@Slf4j
public class RestExceptionHandler {

    /** The application's own exception already carries its status and message. */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex, HttpServletRequest request) {
        ApiError error = ex.getError();
        error.setPath(request.getRequestURI());
        return ResponseEntity.status(error.getStatus()).body(error);
    }

    /** Raised by {@code @Valid} when a request body fails bean validation. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        ApiError error = new ApiError(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Validation failed", request.getRequestURI());

        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            error.addValidationError(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return ResponseEntity.badRequest().body(error);
    }

    /**
     * An unreadable or wrongly-typed request body — most often a malformed UUID such as
     * {@code "productId":"not-a-uuid"}.
     *
     * <p>Without this handler the catch-all below turns it into a 500, which is wrong and actively
     * misleading: the server is fine, the request is not. Bad input is always 4xx.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(
            HttpMessageNotReadableException ex, HttpServletRequest request) {
        log.debug("Rejected an unreadable request body on {}", request.getRequestURI(), ex);
        ApiError error = new ApiError(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "Request body could not be parsed. Check that every id is a valid UUID.",
                request.getRequestURI());
        return ResponseEntity.badRequest().body(error);
    }

    /**
     * A path variable that will not convert — e.g. {@code GET /api/orders/garbage} where the
     * handler expects a UUID. Same reasoning as above: the caller's fault, so 400.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String expected = ex.getRequiredType() == null
                ? "the expected type"
                : ex.getRequiredType().getSimpleName();
        ApiError error = new ApiError(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "'%s' is not a valid %s for parameter '%s'".formatted(ex.getValue(), expected, ex.getName()),
                request.getRequestURI());
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex, HttpServletRequest request) {
        // Deliberately vague: saying "no such user" vs "wrong password" tells an attacker which
        // email addresses are registered.
        ApiError error = new ApiError(
                org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid email or password", request.getRequestURI());
        return ResponseEntity.status(error.getStatus()).body(error);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        ApiError error = new ApiError(
                org.springframework.http.HttpStatus.FORBIDDEN,
                "You do not have permission to do that",
                request.getRequestURI());
        return ResponseEntity.status(error.getStatus()).body(error);
    }

    /** Catch-all. Logs the real cause but never leaks a stack trace to the client. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception on {}", request.getRequestURI(), ex);
        ApiError error = new ApiError(
                org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                "Something went wrong on our end",
                request.getRequestURI());
        return ResponseEntity.status(error.getStatus()).body(error);
    }
}
