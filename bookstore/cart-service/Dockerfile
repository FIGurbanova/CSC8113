FROM gradle:7.6-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle clean build -x test

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
CMD ["java", "-jar", "app.jar"]
