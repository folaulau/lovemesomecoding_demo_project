// ============================================================================
// The Gradle equivalent of this project's pom.xml.
//
// ⚠️ Maven is still the primary build for this app: `./mvnw test` is what CI and the
// tutorial instructions run. This file exists so the /spring-boot Gradle lesson can
// snippet a build that provably works rather than one invented for the article.
// Both build the same source tree; keep them in step if you change a dependency.
// ============================================================================

plugins {
    java

    // Packages the app as an executable jar and wires in `bootRun`. This is the plugin
    // that corresponds to spring-boot-maven-plugin.
    id("org.springframework.boot") version "4.1.0"

    // The dependency-management plugin is what gives Gradle Maven's <parent> behaviour:
    // it applies the Spring Boot BOM so versions can be omitted below. Without it every
    // `implementation("org.springframework.boot:...")` line would need an explicit
    // version, which is the single most common difference between a Maven pom and a
    // Gradle script people port by hand.
    id("io.spring.dependency-management") version "1.1.7"

    id("com.diffplug.spotless") version "7.0.2"
}

group = "com.pizza"
version = "0.0.1-SNAPSHOT"
description = "Pizza ordering demo API for lovemesomecoding.com"

java {
    toolchain {
        // A toolchain, not `sourceCompatibility`. This makes Gradle FIND (or download) a
        // JDK 21 rather than assuming whichever JVM happens to be running the build, so
        // the build is reproducible on a machine whose default java is 17 or 25.
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

// Versions Boot does not manage for us — the same set pinned in <properties> in the pom.
val springdocVersion = "2.8.6"
val mapstructVersion = "1.6.3"
val lombokMapstructBindingVersion = "0.2.0"
val stripeVersion = "29.2.0"
val jjwtVersion = "0.12.6"

dependencies {
    // ---------------------------------------------------------------- web
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // ------------------------------------------------- aop / cache / search
    // Boot 4 renamed spring-boot-starter-aop to spring-boot-starter-aspectj.
    implementation("org.springframework.boot:spring-boot-starter-aspectj")
    implementation("org.springframework.boot:spring-boot-starter-cache")
    implementation("org.springframework.boot:spring-boot-starter-data-elasticsearch")

    // ---------------------------------------------------------- persistence
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-liquibase")
    // `runtimeOnly` is Gradle's <scope>runtime</scope>: the driver is needed to RUN but
    // nothing should compile against it, and Gradle enforces that where Maven only asks.
    runtimeOnly("com.mysql:mysql-connector-j")

    // ------------------------------------------------------------- security
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    implementation("io.jsonwebtoken:jjwt-api:$jjwtVersion")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:$jjwtVersion")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:$jjwtVersion")

    // ------------------------------------------------- messaging / mail / views
    implementation("org.springframework.boot:spring-boot-starter-artemis")
    implementation("org.springframework.boot:spring-boot-starter-mail")
    implementation("org.springframework.boot:spring-boot-starter-thymeleaf")

    // ------------------------------------------------------------- payments
    implementation("com.stripe:stripe-java:$stripeVersion")

    // ----------------------------------------------------------------- docs
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:$springdocVersion")

    // -------------------------------------------------- mapping/boilerplate
    implementation("org.mapstruct:mapstruct:$mapstructVersion")

    // `compileOnly` + `annotationProcessor` is the Gradle spelling of Maven's
    // <optional>true</optional> on Lombok: on the compile classpath, absent from the jar.
    compileOnly("org.projectlombok:lombok")
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // ⚠️ ORDER IS LOAD-BEARING, exactly as in the pom. Lombok must run before MapStruct,
    // and lombok-mapstruct-binding is what lets MapStruct see the accessors Lombok
    // generated. Get it wrong and the build still succeeds — it just produces mappers
    // that map nothing, which is a genuinely horrible afternoon.
    annotationProcessor("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok-mapstruct-binding:$lombokMapstructBindingVersion")
    annotationProcessor("org.mapstruct:mapstruct-processor:$mapstructVersion")

    // ----------------------------------------------------------------- test
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.security:spring-security-test")
    // Gradle does not put JUnit's launcher on the test runtime classpath automatically.
    // Leaving this out produces "Please make sure that the JUnit Platform is on the
    // classpath", which sounds like a missing test framework rather than a missing runner.
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")
}

tasks.withType<Test> {
    // Maven's Surefire picks JUnit 5 up on its own; Gradle has to be told.
    useJUnitPlatform()
}

spotless {
    java {
        importOrder()
        removeUnusedImports()
        formatAnnotations()
        palantirJavaFormat()
    }
}
