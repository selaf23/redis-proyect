"use strict";

const express = require("express");
const { createClient } = require("redis");

const CONFIG = {
  PORT: process.env.PORT || 3000,
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  SESSION_TTL: parseInt(process.env.SESSION_TTL, 10) || 3600,
  CACHE_TTL: parseInt(process.env.CACHE_TTL, 10) || 300,
};

const redisClient = createClient({
  url: CONFIG.REDIS_URL,
});

redisClient.on("error", (err) => console.error("[Redis] Error:", err.message));
redisClient.on("connect", () => console.log("[Redis] Connected"));
redisClient.on("reconnecting", () => console.log("[Redis] Reconnecting..."));

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  req.redis = redisClient;
  next();
});


app.post("/session", async (req, res) => {
  const { userId, name, role } = req.body;

  if (!userId || !name || !role) {
    return res
      .status(400)
      .json({ error: "userId, nombre y rol es requerido" });
  }

  const key = `session:${userId}`;

  try {
    await req.redis.hSet(key, {
      userId: String(userId),
      name: String(name),
      role: String(role),
      createdAt: new Date().toISOString(),
    });

    await req.redis.expire(key, CONFIG.SESSION_TTL);

    return res.status(201).json({ ok: true, key });
  } catch (err) {
    console.error("[POST /session]", err);
    return res.status(500).json({ error: "error crear sesion" });
  }
});

app.get("/session/:id", async (req, res) => {
  try {
    const session = await req.redis.hGetAll(`session:${req.params.id}`);

    if (!session || Object.keys(session).length === 0) {
      return res.status(404).json({ error: "Session no encontrada" });
    }

    return res.json(session);
  } catch (err) {
    console.error("[GET /session/:id]", err);
    return res.status(500).json({ error: "error para fetch sesion" });
  }
});


app.put("/session/:id", async (req, res) => {
  try {
    const key = `session:${req.params.id}`;
    const exists = await req.redis.exists(key);

    if (!exists) {
      return res.status(404).json({ error: "Sesion no encontrada" });
    }

    const fields = req.body;
    if (!fields || Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "no hay cambios para modificar" });
    }

    const sanitized = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, String(v)]),
    );

    await req.redis.hSet(key, sanitized);

    return res.json({ ok: true });
  } catch (err) {
    console.error("[PUT /session/:id]", err);
    return res.status(500).json({ error: "no se pudo actualizar sesion" });
  }
});


app.delete("/session/:id", async (req, res) => {
  try {
    const deleted = await req.redis.del(`session:${req.params.id}`);
    return res.json({ deleted: deleted === 1 });
  } catch (err) {
    console.error("[DELETE /session/:id]", err);
    return res.status(500).json({ error: "error para eliminar sesion" });
  }
});

app.get("/productos", async (_req, res) => {
  try {
    await new Promise((r) => setTimeout(r, 300));

    const data = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      nombre: `Producto ${i + 1}`,
      precio: parseFloat((Math.random() * 100).toFixed(2)),
    }));

    return res.json({ source: "db", data });
  } catch (err) {
    console.error("[GET /productos]", err);
    return res.status(500).json({ error: "error para fetch productos" });
  }
});

async function start() {
  try {
    await redisClient.connect();

    app.listen(CONFIG.PORT, () => {
      console.log(`[Server] Running on http://localhost:${CONFIG.PORT}`);
    });
  } catch (err) {
    console.error("[Server] error para iniciar:", err.message);
  }
}

start();
