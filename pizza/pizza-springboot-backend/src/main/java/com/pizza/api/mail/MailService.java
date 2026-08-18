package com.pizza.api.mail;

import com.pizza.api.dto.OrderDTO;

/** Transactional email. */
public interface MailService {

    /** True when a mail server is actually configured — see {@code MailServiceImpl}. */
    boolean isConfigured();

    /** Sends the order confirmation, rendering the same template the receipt page uses. */
    void sendOrderConfirmation(OrderDTO order);
}
