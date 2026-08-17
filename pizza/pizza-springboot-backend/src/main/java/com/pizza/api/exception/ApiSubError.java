package com.pizza.api.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** One specific thing that was wrong — usually a single invalid field. */
@Setter
@Getter
@ToString
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(value = Include.NON_NULL)
public class ApiSubError {

    /** The field that failed, when the error is field-specific. */
    private String field;

    /** The rejected value. Never populated for passwords or other secrets. */
    private Object rejectedValue;

    private String message;

    public ApiSubError(String message) {
        this.message = message;
    }

    public static ApiSubError of(String field, String message) {
        ApiSubError error = new ApiSubError();
        error.setField(field);
        error.setMessage(message);
        return error;
    }
}
