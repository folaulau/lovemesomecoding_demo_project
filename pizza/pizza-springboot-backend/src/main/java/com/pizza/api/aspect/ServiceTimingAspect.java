package com.pizza.api.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;

/**
 * Times every service call and logs the slow ones.
 *
 * <p>This is the textbook case for AOP: the behaviour is wanted in roughly forty methods, it is
 * identical in all of them, and it has nothing to do with what any of them actually mean. Copying
 * a try/finally and a stopwatch into each one would bury the business logic under plumbing, and
 * the forty-first method would be the one somebody forgot.
 *
 * <h2>How to read a pointcut</h2>
 *
 * <p>{@code execution(* com.pizza.api.entity..*ServiceImpl.*(..))} reads left to right as: any
 * return type, in package {@code com.pizza.api.entity} or below, in a class whose name ends
 * {@code ServiceImpl}, any method, any arguments.
 *
 * <h2>⚠️ The proxy rule — the thing that actually catches people</h2>
 *
 * <p>Spring implements this by wrapping the bean in a proxy. Advice therefore only runs when a call
 * arrives <b>through</b> that proxy — that is, from another bean. A method calling a sibling method
 * on {@code this} goes straight down the vtable and is never advised:
 *
 * <pre>
 * public void a() { b(); }   // b() is NOT timed - internal call, no proxy involved
 * public void b() { ... }    // timed only when some OTHER bean calls it
 * </pre>
 *
 * <p>This is not an AOP quirk. {@code @Transactional}, {@code @Cacheable}, {@code @Async},
 * {@code @Retryable} and {@code @PreAuthorize} are all built on the same proxying mechanism and all
 * fail in exactly the same silent way. If an annotation "isn't working", a self-invocation is the
 * first thing to check.
 */
@Slf4j
@Aspect
@Component
public class ServiceTimingAspect {

    /** Anything slower than this is worth a line in the log. */
    private static final long SLOW_CALL_MILLIS = 250;

    /**
     * Named pointcuts are worth the extra three lines: the expression is declared once, and the
     * advice below reads as prose instead of as a regex.
     */
    @Pointcut("execution(* com.pizza.api.entity..*ServiceImpl.*(..))")
    public void serviceLayer() {}

    @Pointcut("execution(* com.pizza.api.report.*ServiceImpl.*(..))")
    public void reportLayer() {}

    /**
     * {@code @Around} is the only advice type that can both see the outcome and control whether the
     * call happens at all. Note what this one does NOT do: it never swallows the exception. It
     * rethrows, because an aspect that quietly turns a failure into a null is how observability
     * code becomes the bug.
     */
    @Around("serviceLayer() || reportLayer()")
    public Object time(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.nanoTime();
        String target = joinPoint.getSignature().toShortString();

        try {
            return joinPoint.proceed();
        } catch (Throwable ex) {
            long millis = (System.nanoTime() - start) / 1_000_000;
            log.warn("{} failed after {} ms: {}", target, millis, ex.toString());
            throw ex;
        } finally {
            long millis = (System.nanoTime() - start) / 1_000_000;
            if (millis >= SLOW_CALL_MILLIS) {
                log.warn("SLOW {} took {} ms", target, millis);
            } else if (log.isDebugEnabled()) {
                log.debug("{} took {} ms", target, millis);
            }
        }
    }
}
