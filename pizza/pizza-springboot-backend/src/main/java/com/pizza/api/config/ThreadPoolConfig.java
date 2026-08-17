package com.pizza.api.config;

import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

@Slf4j
@Configuration
@EnableAsync
@EnableScheduling
public class ThreadPoolConfig implements AsyncConfigurer, SchedulingConfigurer {

    /*
     * corePoolSize parameter is the amount of core threads which will be instantiated and kept in the pool. If all core
     * threads are busy and more tasks are submitted, then the pool is allowed to grow up to a maximumPoolSize.
     */
    @Bean(name = "taskExecutor")
    public ThreadPoolTaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        // initial number of threads
        executor.setCorePoolSize(25);

        // max number of threads
        executor.setMaxPoolSize(150);

        // some tasks may be put into a queue to wait for their turn.
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("Pizza-API-");
        executor.setAllowCoreThreadTimeOut(true);
        executor.setKeepAliveSeconds(60);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setTaskDecorator(new LogTaskDecorator());
        executor.initialize();

        return executor;
    }

    /** Task scheduler for @Scheduled tasks */
    @Bean(name = "taskScheduler")
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);
        scheduler.setThreadNamePrefix("Pizza-API-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(60);
        scheduler.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        scheduler.setTaskDecorator(new LogTaskDecorator());
        scheduler.initialize();
        return scheduler;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {

        return (ex, method, listOfObjects) -> {
            log.error("****** AsyncConfig - handleUncaughtException(...) ******");
            log.error("*  Class name: {}", method.getDeclaringClass());
            log.error("*  Method name - {}", method.getName());
            log.error("*  Exception message - {}", ex.getMessage());

            for (Object param : listOfObjects) {
                log.error("*  Param - {}", param);
            }
            log.error("*************************************");
        };
    }

    /** Configure @Scheduled tasks to use the taskScheduler thread pool */
    @Override
    public void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        taskRegistrar.setScheduler(taskScheduler());
    }

    /**
     * Keep context tags to use in the new thread<br>
     * For example, we are using the memberUuid in the new thread.
     */
    class LogTaskDecorator implements TaskDecorator {

        @Override
        public Runnable decorate(Runnable runnable) {
            Map<String, String> contextMap = MDC.getCopyOfContextMap();
            return () -> {
                try {
                    if (contextMap != null) {
                        MDC.setContextMap(contextMap);
                    }
                    runnable.run();
                } catch (Exception e) {

                } finally {
                    try {
                        MDC.clear();
                    } catch (Exception e) {
                        // TODO: handle exception
                    }
                }
            };
        }
    }
}
