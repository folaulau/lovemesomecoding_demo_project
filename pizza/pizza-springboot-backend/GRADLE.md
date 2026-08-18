# Building this project with Gradle

This branch (`springboot-tutorial-gradle`) adds a Gradle build alongside the Maven one, as the
source for the **Spring Boot – Building with Gradle** lesson on lovemesomecoding.com.

**It lives on its own branch on purpose.** Two build files in one directory makes IDEs ask which
one to import, and an accidental import of the wrong one produces confusing failures. `main` and
`springboot-tutorial-examples` keep Maven only.

```bash
./gradlew build          # compile, jar, spotlessCheck  (equivalent to ./mvnw package)
./gradlew test           # equivalent to ./mvnw test          - needs local MySQL
./gradlew bootRun        # equivalent to ./mvnw spring-boot:run
./gradlew spotlessApply  # equivalent to ./mvnw spotless:apply
```

Both builds compile the same `src/` tree. **If you change a dependency, change it in both** —
nothing enforces that they agree.

## Why there is a wrapper

Spring Boot 4.1's Gradle plugin requires **Gradle 8.14 or later** (or 9.x). A machine with an
older Gradle on its `PATH` fails with:

```
Spring Boot plugin requires Gradle 8.x (8.14 or later) or 9.x. The current version is Gradle 8.12
```

`./gradlew` pins 8.14.3 and downloads it on first use, so the build does not depend on what happens
to be installed. This is the same argument as `./mvnw`, and it is why you should invoke the wrapper
rather than a global `gradle`.

## Differences worth knowing when porting a pom by hand

| Maven | Gradle |
|---|---|
| `<parent>` spring-boot-starter-parent | `io.spring.dependency-management` plugin — without it, every dependency needs an explicit version |
| `<scope>runtime</scope>` | `runtimeOnly` |
| `<optional>true</optional>` (Lombok) | `compileOnly` + `annotationProcessor` |
| Surefire finds JUnit 5 by itself | `tasks.withType<Test> { useJUnitPlatform() }`, plus a `junit-platform-launcher` on the test runtime classpath |
| `<java.version>` | a `toolchain`, which makes Gradle find or fetch that JDK rather than trusting the one running the build |

The annotation-processor ordering — Lombok, then `lombok-mapstruct-binding`, then
`mapstruct-processor` — is load-bearing in both. Getting it wrong does not fail the build; it
produces mappers that map nothing.
