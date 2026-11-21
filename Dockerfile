FROM node:22 AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
# The esbuild bundles are self-contained, so no node_modules at runtime.
# If a native dependency is ever added, copy node_modules (or the package) here too.
COPY --from=build /src/server/dist ./dist
COPY --from=build /src/web/dist ./public
ENV NODE_ENV=production
USER nonroot
EXPOSE 8080 8081
# The entrypoint is node: the worker runs the same image with args ["dist/worker.js"].
CMD ["dist/main.js"]
