package com.pizza.api.exception;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import org.springframework.http.HttpStatus;

/**
 * The single error shape every endpoint returns.
 *
 * <p>One predictable envelope means the frontend has exactly one error path to handle instead of
 * guessing at whatever each framework default happens to produce.
 */
@Setter
@Getter
@ToString
@JsonInclude(value = Include.NON_NULL)
public class ApiError {

    public static final String DEFAULT_MSG = "Something went wrong.";

    private String message;

    /** The path that failed, to make a log line actionable. */
    private String path;

    private LocalDateTime timestamp = LocalDateTime.now();

    /** Detail for the developer. Never a stack trace — those stay in the server log. */
    private String debugMessage;

    /** Field-level failures, when the error is a validation failure. */
    private List<ApiSubError> errors;

    /** Not serialised: it becomes the HTTP status rather than part of the body. */
    @JsonIgnore
    private HttpStatus status = HttpStatus.BAD_REQUEST;

    public ApiError() {
        this(HttpStatus.BAD_REQUEST, DEFAULT_MSG);
    }

    public ApiError(String message) {
        this(HttpStatus.BAD_REQUEST, message);
    }

    public ApiError(HttpStatus status, String message) {
        this.status = status == null ? HttpStatus.BAD_REQUEST : status;
        this.message = message == null ? DEFAULT_MSG : message;
        this.timestamp = LocalDateTime.now();
    }

    public ApiError(HttpStatus status, String message, String path) {
        this(status, message);
        this.path = path;
    }

    public void addSubError(ApiSubError subError) {
        if (errors == null) {
            errors = new ArrayList<>();
        }
        errors.add(subError);
    }

    public void addValidationError(String field, String message) {
        addSubError(ApiSubError.of(field, message));
    }

    public int getStatusCode() {
        return status.value();
    }

    public String getError() {
        return status.getReasonPhrase();
    }
}
