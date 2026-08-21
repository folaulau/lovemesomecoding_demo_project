# The pizza API as a container image.
#
#   docker build -t pizza-api .
#   docker run --rm -p 8085:8085 pizza-api
#
# This is a MULTI-STAGE build. The first stage needs a full JDK and Maven and
# ends up around 700 MB; the second stage is a JRE and one jar. Only the second
# stage is the image — nothing from `build` is in the result unless it was
# explicitly copied out.

# ------------------------------------------------------------------ stage 1: build
# A JDK, because compiling needs javac. `eclipse-temurin` is the Adoptium build
# of OpenJDK — the same one `sdk install java` gives you by default.
FROM eclipse-temurin:21-jdk AS build

WORKDIR /build

# ⚠️ The order of the next two COPYs is the whole trick.
#
# Docker caches each instruction's result and reuses it as long as its inputs are
# unchanged. Dependencies change when pom.xml changes — rarely. Source changes
# constantly. So copy pom.xml alone, resolve dependencies, and ONLY THEN copy the
# source: an ordinary code change then reuses the cached dependency layer and the
# build skips straight to compiling.
#
# Do it the obvious way — `COPY . .` followed by `./mvnw package` — and every
# one-character edit re-downloads the entire dependency tree, because the layer
# that downloaded them has a changed input.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# go-offline resolves everything the build will need and stops. It is allowed to
# fail: some plugins only reveal their dependencies once they actually run, and a
# non-zero exit here would fail the build over a warm-up step. The real build
# below downloads anything that was missed.
RUN ./mvnw -B dependency:go-offline || true

COPY src/ src/

# -DskipTests, deliberately. Tests belong in CI, where a failure is reported
# against a commit; running them here means every image build pays for them and a
# flaky test blocks a deploy. See .github/workflows/docker.yml, which runs the
# tests first and builds the image second.
RUN ./mvnw -B clean package -DskipTests

# Spring Boot's jar is a nested archive: the app's classes and every dependency
# jar inside one file. Unpacking it into layers means a code change only
# invalidates the small classes layer, not the ~60 MB of dependencies — which is
# what a registry pull actually spends its time on.
RUN java -Djarmode=tools -jar target/*.jar extract --layers --destination extracted

# ⚠️ The extracted jar keeps its versioned name — pizza-springboot-backend-0.0.1-SNAPSHOT.jar.
# Renaming it here is what lets ENTRYPOINT below name a file rather than glob for
# one: ENTRYPOINT is exec form, so there is no shell to expand a `*`, and
# `java -jar /app/*.jar` fails with "Unable to access jarfile /app/*.jar".
# Hard-coding the version instead would mean editing the Dockerfile on every
# release, which is exactly the kind of edit that gets forgotten.
RUN mv extracted/application/*.jar extracted/application/app.jar

# ------------------------------------------------------------------ stage 2: run
# A JRE, not a JDK. There is no compiler in the final image because nothing in it
# compiles: ~180 MB instead of ~450 MB, and one less toolchain for anything that
# gets into the container to use.
FROM eclipse-temurin:21-jre AS runtime

# ⚠️ Without this the container runs as root, and root in the container is uid 0
# on the kernel it shares with the host. A JVM serving HTTP has no need of it.
#
# --system: no password, no home directory, not a login account.
RUN groupadd --system pizza && useradd --system --gid pizza --no-create-home pizza

WORKDIR /app

# Copied in dependency order, most-stable first, so a rebuild after a code change
# only replaces the last one.
COPY --from=build --chown=pizza:pizza /build/extracted/dependencies/ ./
COPY --from=build --chown=pizza:pizza /build/extracted/spring-boot-loader/ ./
COPY --from=build --chown=pizza:pizza /build/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=pizza:pizza /build/extracted/application/ ./

# pizza.storage.upload-dir writes here. It is a plain directory, so uploads are
# lost when the container is replaced — compose mounts a volume over it.
RUN mkdir -p /app/uploads/products && chown -R pizza:pizza /app/uploads

USER pizza

# Documentation, not a firewall rule. EXPOSE publishes nothing on its own; it
# records which port the image expects to serve on, and `docker run -P` reads it.
EXPOSE 8085

# ⚠️ EXEC form (a JSON array), not the shell form. The shell form runs the
# process as a child of /bin/sh, which does not forward signals — so `docker
# stop` kills the shell, the JVM never receives SIGTERM, and ten seconds later
# Docker SIGKILLs it mid-request. In exec form the JVM is PID 1 and shuts down
# gracefully.
#
# Boot 3.2+ ships this launcher; it is what `extract --layers` above lays out.
ENTRYPOINT ["java", "-jar", "app.jar"]
