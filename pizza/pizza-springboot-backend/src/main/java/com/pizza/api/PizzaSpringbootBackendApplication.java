package com.pizza.api;

import java.lang.management.ManagementFactory;
import java.net.InetAddress;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.TimeZone;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@SpringBootApplication
// Finds every @ConfigurationProperties class in this package and below, so
// PizzaProperties does not have to be listed in an @EnableConfigurationProperties.
@ConfigurationPropertiesScan
public class PizzaSpringbootBackendApplication {

    public static void main(String[] args) {
        TimeZone.setDefault(TimeZone.getTimeZone("America/Denver"));
        SpringApplication.run(PizzaSpringbootBackendApplication.class, args);
    }

    @Autowired
    @Qualifier(value = "taskExecutor")
    private ThreadPoolTaskExecutor taskExecutor;

    @Order(Integer.MAX_VALUE)
    @Bean
    public CommandLineRunner commandLineRunner(ApplicationContext ctx) {
        return args -> {

            // Display Environmental Useful Variables
            try {
                System.out.println("\n");
                Runtime runtime = Runtime.getRuntime();
                double mb = 1048576; // megabtye to byte
                double gb = 1073741824; // gigabyte to byte
                Environment env = ctx.getEnvironment();
                TimeZone timeZone = TimeZone.getDefault();

                String hasuraServerPort = env.getProperty("server.hasura.port");

                System.out.println("************************ Pizza API ***********************************");
                System.out.println("** Active Profile: " + Arrays.toString(env.getActiveProfiles()));
                System.out.println("** Port: " + env.getProperty("server.port"));
                System.out.println("** Timezone: " + timeZone.getID());
                System.out.println("** TimeStamp: " + LocalDateTime.now());

                System.out.println("** Internal Url: http://"
                        + env.getProperty("project.host")
                        + ":"
                        + env.getProperty("server.port"));
                System.out.println("** External Url: http://"
                        + InetAddress.getLocalHost().getHostAddress()
                        + ":"
                        + env.getProperty("server.port"));

                System.out.println("** Internal Swagger: http://"
                        + env.getProperty("project.host")
                        + ":"
                        + env.getProperty("server.port")
                        + "/swagger-ui/index.html");
                System.out.println("** External Swagger: http://"
                        + InetAddress.getLocalHost().getHostAddress()
                        + ":"
                        + env.getProperty("server.port")
                        + "/swagger-ui/index.html");
                System.out.println("\n************************* GraphQL *************************************");
                System.out.println("** GraphQL endpoint: http://"
                        + env.getProperty("project.host")
                        + ":"
                        + env.getProperty("server.port")
                        + "/graphiql");
                System.out.println();
                System.out.println("************************* Java - JVM *********************************");
                System.out.println("** Number of processors: " + runtime.availableProcessors());
                String processName = ManagementFactory.getRuntimeMXBean().getName();
                System.out.println("** Process ID: " + processName.split("@")[0]);
                System.out.println("** Total memory: "
                        + (runtime.totalMemory() / mb)
                        + " MB = "
                        + (runtime.totalMemory() / gb)
                        + " GB");
                System.out.println(
                        "** Max memory: " + (runtime.maxMemory() / mb) + " MB = " + (runtime.maxMemory() / gb) + " GB");
                System.out.println("** Free memory: "
                        + (runtime.freeMemory() / mb)
                        + " MB = "
                        + (runtime.freeMemory() / gb)
                        + " GB");
                System.out.println();
                System.out.println("************************* Thread Pool ********************************");
                System.out.println("** Thread Pool Core Size: " + taskExecutor.getCorePoolSize());
                System.out.println("** Thread Pool Active Count: " + taskExecutor.getActiveCount());
                System.out.println("** Thread Pool Max Size: " + taskExecutor.getMaxPoolSize());
                System.out.println("** Thread Pool Keep Alive Secs: " + taskExecutor.getKeepAliveSeconds());
                System.out.println("** Thread Pool Prefix: " + taskExecutor.getThreadNamePrefix());
                System.out.println("** Thread Pool Priority: " + taskExecutor.getThreadPriority());
                System.out.println();
                System.out.println("**********************************************************************");

            } catch (Exception e) {
                e.printStackTrace();
                System.err.println("Exception, commandlineRunner -> " + e.getMessage());
            }
            System.out.println("\n");
        };
    }
}
