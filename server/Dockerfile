# ── Stage 1: Build admesh from source ────────────────────────────────────────
# Build a pinned upstream commit with CMake for reproducible Docker builds.
FROM node:20-bookworm-slim AS admesh-builder

ARG ADMESH_COMMIT=e1b296b575ba574cc91480587a9876a36bbe2c0d

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential cmake git ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    git clone https://github.com/admesh/admesh.git /tmp/admesh-src && \
    cd /tmp/admesh-src && \
    git checkout "${ADMESH_COMMIT}" && \
    cmake -S /tmp/admesh-src -B /tmp/admesh-build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr/local && \
    cmake --build /tmp/admesh-build --parallel && \
    cmake --install /tmp/admesh-build

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends libgmp10 zlib1g ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy admesh binary and shared library from builder
COPY --from=admesh-builder /usr/local/bin/admesh /usr/local/bin/admesh
COPY --from=admesh-builder /usr/local/lib/libadmesh* /usr/local/lib/
RUN ldconfig

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1
CMD ["node", "server.js"]
