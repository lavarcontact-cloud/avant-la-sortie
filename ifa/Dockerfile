# Image de production : construit le front puis sert API + front avec Node.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 UPLOAD_DIR=/data/uploads
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/db ./db
COPY --from=build /app/web/dist ./web/dist
RUN mkdir -p /data/uploads && chown -R node:node /data
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "server/index.js"]
