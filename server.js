import { createServer } from "node:http";
import { existsSync, createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 5187);
const isProd = process.env.NODE_ENV === "production";
const rooms = new Map();
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".svg", "image/svg+xml"]
]);

let vite;
if (!isProd) {
  vite = await createViteServer({
    root,
    appType: "spa",
    server: {
      middlewareMode: true,
      hmr: { port: Number(process.env.HMR_PORT || port + 1000) }
    }
  });
}

function cleanRoom(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18);
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function roomPlayers(room, exceptId = null) {
  return [...room.clients.values()]
    .filter((client) => client.id !== exceptId && client.player)
    .map((client) => client.player);
}

function emit(client, data) {
  if (!client.res || client.res.destroyed) return;
  client.res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room, data, exceptId = null) {
  for (const client of room.clients.values()) {
    if (client.id !== exceptId) emit(client, data);
  }
}

function touch(room) {
  room.updatedAt = Date.now();
}

function addClient(room, clientId, player) {
  const existing = room.clients.get(clientId);
  const client = existing || { id: clientId, res: null, player: null };
  client.player = player;
  room.clients.set(clientId, client);
  touch(room);
  return client;
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/multiplayer/health") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/multiplayer/events") {
    const roomCode = cleanRoom(url.searchParams.get("room"));
    const clientId = String(url.searchParams.get("clientId") || "");
    const room = rooms.get(roomCode);
    const client = room?.clients.get(clientId);
    if (!room || !client) {
      sendJson(res, 404, { error: "room not found" });
      return true;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
      "x-accel-buffering": "no"
    });
    client.res = res;
    emit(client, { type: "relay-open", room: roomCode, seed: room.seed });
    const heartbeat = setInterval(() => emit(client, { type: "ping", t: Date.now() }), 15000);
    req.on("close", () => {
      clearInterval(heartbeat);
      if (room.clients.get(clientId)?.res === res) {
        room.clients.delete(clientId);
        broadcast(room, { type: "player-left", id: clientId }, clientId);
        if (!room.clients.size) rooms.delete(roomCode);
      }
    });
    return true;
  }

  if (req.method !== "POST" || !url.pathname.startsWith("/api/multiplayer/")) return false;

  try {
    const body = await readJson(req);
    const roomCode = cleanRoom(body.room);
    const clientId = String(body.clientId || "");
    if (!roomCode || !clientId) {
      sendJson(res, 400, { error: "missing room or client id" });
      return true;
    }

    if (url.pathname === "/api/multiplayer/host") {
      const existing = rooms.get(roomCode);
      if (existing?.clients.size) {
        sendJson(res, 409, { error: "room already taken" });
        return true;
      }
      const room = { code: roomCode, seed: Number(body.seed) || Math.floor(Math.random() * 999999), clients: new Map(), updatedAt: Date.now() };
      rooms.set(roomCode, room);
      addClient(room, clientId, body.player);
      sendJson(res, 200, { room: roomCode, seed: room.seed, players: [] });
      return true;
    }

    if (url.pathname === "/api/multiplayer/join") {
      const room = rooms.get(roomCode);
      if (!room) {
        sendJson(res, 404, { error: "room not found" });
        return true;
      }
      const players = roomPlayers(room, clientId);
      addClient(room, clientId, body.player);
      broadcast(room, body.player, clientId);
      sendJson(res, 200, { room: roomCode, seed: room.seed, players });
      return true;
    }

    if (url.pathname === "/api/multiplayer/message") {
      const room = rooms.get(roomCode);
      const client = room?.clients.get(clientId);
      if (!room || !client) {
        sendJson(res, 404, { error: "room not found" });
        return true;
      }
      if (body.message?.id === clientId && (body.message.type === "hello" || body.message.type === "state")) {
        client.player = body.message;
      }
      touch(room);
      broadcast(room, body.message, clientId);
      sendJson(res, 200, { ok: true });
      return true;
    }
  } catch (error) {
    sendJson(res, 400, { error: error.message || "bad request" });
    return true;
  }

  return false;
}

function serveStatic(req, res, url) {
  const dist = join(root, "dist");
  const pathname = decodeURIComponent(url.pathname);
  const target = pathname === "/" ? join(dist, "index.html") : join(dist, pathname);
  const file = existsSync(target) ? target : join(dist, "index.html");
  res.writeHead(200, { "content-type": mimeTypes.get(extname(file)) || "application/octet-stream" });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (await handleApi(req, res, url)) return;
  if (vite) {
    vite.middlewares(req, res);
    return;
  }
  serveStatic(req, res, url);
});

setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 30;
  for (const [code, room] of rooms.entries()) {
    if (!room.clients.size || room.updatedAt < cutoff) rooms.delete(code);
  }
}, 1000 * 60 * 5).unref();

server.listen(port, "0.0.0.0", () => {
  console.log(`Neon Badge Runner listening on http://localhost:${port}`);
});
