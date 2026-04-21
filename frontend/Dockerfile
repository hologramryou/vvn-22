FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG REACT_APP_API_URL
ARG REACT_APP_API_INTERNAL_URL
ENV VITE_API_URL=$VITE_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_API_INTERNAL_URL=$REACT_APP_API_INTERNAL_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/vite.config.ts ./vite.config.ts
EXPOSE 8080
CMD ["sh", "-c", "npx vite preview --port ${PORT:-8080}"]
