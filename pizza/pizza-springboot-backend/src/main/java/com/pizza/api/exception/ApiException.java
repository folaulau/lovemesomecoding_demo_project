package com.pizza.api.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.io.Serial;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import org.springframework.http.HttpStatus;

/**
 * The application's own exception.
 *
 * <p>Carries an {@link ApiError}, so the thrower decides the status and message and
 * {@link RestExceptionHandler} simply serialises it. Static factories cover the common cases so
 * call sites read as {@code throw ApiException.notFound("Product", id)}.
 */
@JsonInclude(value = Include.NON_NULL)
@Setter
@Getter
@ToString
public class ApiException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    private ApiError error;

    public ApiException() {
        this(new ApiError());
    }

    public ApiException(ApiError error) {
        super(error.getMessage());
        this.error = error;
    }

    public ApiException(String message) {
        super(message);
        this.error = new ApiError(HttpStatus.BAD_REQUEST, message);
    }

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.error = new ApiError(status, message);
    }

    /** 400 — the request is well-formed but semantically wrong. */
    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    /** 404 — no such row. */
    public static ApiException notFound(String what, Object id) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " " + id + " was not found");
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    /** 401 — deliberately vague, so it cannot be used to enumerate accounts. */
    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }
}
