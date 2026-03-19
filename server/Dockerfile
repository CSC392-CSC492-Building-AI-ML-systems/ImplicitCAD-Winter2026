# ── Stage 1: Build admesh from source ────────────────────────────────────────
# admesh is not in Alpine repos, so we compile from https://github.com/admesh/admesh
FROM node:20-alpine AS admesh-builder

RUN apk add --no-cache build-base autoconf automake libtool git && \
    git clone --depth 1 https://github.com/admesh/admesh.git /tmp/admesh && \
    cd /tmp/admesh && \
    autoreconf -i && \
    ./configure --prefix=/usr/local && \
    make -j"$(nproc)" && \
    make install

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine

# Copy admesh binary and shared library from builder
COPY --from=admesh-builder /usr/local/bin/admesh /usr/local/bin/admesh
COPY --from=admesh-builder /usr/local/lib/libadmesh* /usr/local/lib/
RUN ldconfig /usr/local/lib 2>/dev/null || true

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .

EXPOSE 4000
CMD ["node", "server.js"]
