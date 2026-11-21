FROM node:22 AS build
WORKDIR /src
COPY package.json package-lock.json .npmrc ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run build

# The embedder is kept out of the bundle: it loads native ONNX and image binaries.
FROM node:22 AS runtime-deps
WORKDIR /deps
ENV ONNXRUNTIME_NODE_INSTALL=skip
COPY server/package.json ./server.json
RUN v=$(node -p "require('./server.json').dependencies['@huggingface/transformers']") \
 && npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund "@huggingface/transformers@$v"

FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=runtime-deps /deps/node_modules ./node_modules
COPY --from=build /src/server/dist ./dist
COPY --from=build /src/web/dist ./public
ENV NODE_ENV=production
USER nonroot
EXPOSE 8080 8081
# The entrypoint is node: the worker runs the same image with args ["dist/worker.js"].
CMD ["dist/main.js"]
