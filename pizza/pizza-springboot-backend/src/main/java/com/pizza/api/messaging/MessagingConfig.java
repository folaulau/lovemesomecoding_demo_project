package com.pizza.api.messaging;

import jakarta.jms.ConnectionFactory;
import org.springframework.boot.jms.autoconfigure.DefaultJmsListenerContainerFactoryConfigurer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jms.annotation.EnableJms;
import org.springframework.jms.config.DefaultJmsListenerContainerFactory;
import org.springframework.jms.support.converter.JacksonJsonMessageConverter;
import org.springframework.jms.support.converter.MessageConverter;
import org.springframework.jms.support.converter.MessageType;

/**
 * JMS wiring, deliberately behind a profile.
 *
 * <p>{@code @Profile("messaging")} is doing real work here rather than decorating. A
 * {@code @JmsListener} container starts polling as soon as the context is up, so merely having the
 * Artemis starter on the classpath with a listener declared would make the application try to reach
 * a broker at every startup — and fill the log with connection retries on any machine that has not
 * got one. Gating the listener means the default experience is unchanged: MySQL, and nothing else.
 *
 * <p>Run it for real with a broker up and
 * {@code -Dspring-boot.run.profiles=local,messaging}.
 *
 * <h2>Why a message converter is not optional</h2>
 *
 * <p>Out of the box, JMS moves a {@code SimpleMessageConverter} payload: String, byte[],
 * Serializable, Map. Sending a record such as {@link OrderMessage} through that either fails or
 * drags Java serialisation into your wire format, which then couples both ends of the queue to your
 * class files. JSON keeps the contract readable and lets the consumer be written in something other
 * than Java.
 */
@Configuration
@EnableJms
@Profile("messaging")
public class MessagingConfig {

    /** The queue orders are announced on. A constant, so producer and consumer cannot disagree. */
    public static final String ORDER_QUEUE = "pizza.orders";

    /**
     * The dead-letter destination.
     *
     * <p>Without somewhere for poison messages to go, a message that always fails is redelivered
     * forever: it blocks the queue, burns CPU and fills the log, and the underlying bug is hidden
     * behind the noise. Artemis will move a message here after its redelivery attempts are
     * exhausted.
     */
    public static final String ORDER_DLQ = "DLQ.pizza.orders";

    /**
     * ⚠️ Two Boot 4 / Spring 7 renames are baked into this class:
     *
     * <ul>
     *   <li>{@code MappingJackson2MessageConverter} is deprecated for removal in Spring 7 (it is
     *       tied to Jackson 2). {@link JacksonJsonMessageConverter} is the Jackson 3 replacement.
     *   <li>{@code DefaultJmsListenerContainerFactoryConfigurer} moved from
     *       {@code org.springframework.boot.autoconfigure.jms} to
     *       {@code org.springframework.boot.jms.autoconfigure} when Boot 4 split autoconfiguration
     *       into per-technology modules. The old import simply does not resolve.
     * </ul>
     */
    @Bean
    public MessageConverter jacksonJmsMessageConverter() {
        JacksonJsonMessageConverter converter = new JacksonJsonMessageConverter();
        converter.setTargetType(MessageType.TEXT);
        // The consumer needs to know which class to deserialise into. This names the JMS string
        // property carrying that type id — without it, the receiving side gets a LinkedHashMap.
        converter.setTypeIdPropertyName("_type");
        return converter;
    }

    /**
     * The listener container factory.
     *
     * <p>Taking Boot's {@code Configurer} first and then overriding is the pattern to copy: it
     * keeps every sensible default Boot computed (including the converter above) instead of
     * silently discarding them, which is what building a bare factory by hand does.
     */
    @Bean
    public DefaultJmsListenerContainerFactory jmsListenerContainerFactory(
            ConnectionFactory connectionFactory, DefaultJmsListenerContainerFactoryConfigurer configurer) {

        DefaultJmsListenerContainerFactory factory = new DefaultJmsListenerContainerFactory();
        configurer.configure(factory, connectionFactory);

        // Transacted sessions: the message is only acknowledged once the listener returns
        // normally. Throw, and it goes back on the queue for redelivery — which is what makes the
        // dead-letter queue above meaningful.
        factory.setSessionTransacted(true);
        factory.setConcurrency("1-3");
        return factory;
    }
}
