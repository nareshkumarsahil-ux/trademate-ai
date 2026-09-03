FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY apps/api/package*.json apps/api/
RUN npm ci
FROM deps AS build
COPY . .
RUN npm run build
FROM nginx:alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
