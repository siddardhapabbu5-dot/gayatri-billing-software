# Gayatri Convention — one image: React UI + Spring Boot API
# Deploy on Railway with Root Directory = repo root, Dockerfile builder.

FROM node:20-alpine AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
# Same-origin /api on Railway — leave VITE_API_BASE empty
RUN npm run build

FROM maven:3.9.9-eclipse-temurin-17 AS api
WORKDIR /app
COPY backend/pom.xml .
COPY backend/src ./src
# Serve UI from Spring Boot static resources
COPY --from=web /web/dist/ ./src/main/resources/static/
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=api /app/target/*.jar app.jar
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "java -Dserver.port=${PORT} -jar app.jar"]
