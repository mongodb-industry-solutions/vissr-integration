FROM node:22-alpine AS base 

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_VSS_JSON_PATH=/data/zod_vss.json
ARG NEXT_PUBLIC_MQTT_VIN=MDBAX9C12XYZ1234
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_VSS_JSON_PATH=$NEXT_PUBLIC_VSS_JSON_PATH
ENV NEXT_PUBLIC_MQTT_VIN=$NEXT_PUBLIC_MQTT_VIN

RUN npm run build

FROM base AS runner
WORKDIR /app

ARG NEXT_PUBLIC_VSS_JSON_PATH=/data/zod_vss.json
ARG NEXT_PUBLIC_MQTT_VIN=MDBAX9C12XYZ1234
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_VSS_JSON_PATH=$NEXT_PUBLIC_VSS_JSON_PATH
ENV NEXT_PUBLIC_MQTT_VIN=$NEXT_PUBLIC_MQTT_VIN

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 8080 

ENV HOSTNAME="0.0.0.0"
ENV PORT=8080

CMD ["npm", "run", "start"]