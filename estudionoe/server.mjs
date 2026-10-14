import { createServer } from "node:http";
import { createExamService, createFirestoreStore, createMemoryStore, HttpError } from "./exam-service.mjs";
import { createGitHubRankingStore } from "./github-ranking-store.mjs";

export function createApi(service, { origins, development = false, storage = "github" }) {
  const requests = new Map();
  const sweep = setInterval(() => {
    for (const [key, value] of requests) if (value.resetAt < Date.now()) requests.delete(key);
  }, 60000);
  sweep.unref();
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) {
      res.writeHead(403); res.end(JSON.stringify({ error: "Origen no permitido." })); return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/health") {
        res.end(JSON.stringify({ ok: true, storage: development ? "memory-development" : storage })); return;
      }
      // Render proporciona X-Forwarded-For; no se conserva la IP fuera de este límite temporal.
      const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress).split(",").at(-1).trim();
      const limit = requests.get(ip);
      if (!limit || limit.resetAt < Date.now()) requests.set(ip, { count: 1, resetAt: Date.now() + 60000 });
      else if (++limit.count > 90) throw new HttpError(429, "Demasiadas peticiones. Espera un minuto.");
      if (req.method === "GET" && url.pathname === "/api/ranking") {
        const topic = url.searchParams.get("topic") ?? "history";
        res.end(JSON.stringify({ entries: await service.ranking(url.searchParams.get("mode"), topic), topic, storage: development ? "memory-development" : storage })); return;
      }
      const match = url.pathname.match(/^\/api\/exams\/([a-f0-9-]{36})(\/finish)?$/);
      if ((req.method === "POST" && (["/api/exams", "/api/results"].includes(url.pathname) || match?.[2])) || (req.method === "DELETE" && match && !match[2])) {
        if (!req.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "Envía JSON.");
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 150000) throw new HttpError(413, "El examen enviado es demasiado grande.");
          chunks.push(chunk);
        }
        let input;
        try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "JSON no válido."); }
        if (req.method === "DELETE") {
          await service.remove(match[1], input?.token);
          res.end(JSON.stringify({ deleted: true })); return;
        }
        const result = url.pathname === "/api/results" ? await service.submit(input)
          : match ? await service.finish(match[1], input?.token, input?.answers) : await service.start(input);
        res.writeHead(match ? 200 : 201);
        res.end(JSON.stringify({ ...result, storage: development ? "memory-development" : storage })); return;
      }
      throw new HttpError(404, "Ruta no encontrada.");
    } catch (error) {
      if (!(error instanceof HttpError)) console.error("Error de la API de estudio:", error);
      if (!res.headersSent) res.writeHead(error instanceof HttpError ? error.status : 503);
      res.end(JSON.stringify({ error: error instanceof HttpError ? error.message : "No se puede acceder al ranking. Inténtalo de nuevo más tarde." }));
    }
  });
  server.on("close", () => clearInterval(sweep));
  return server;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const development = process.env.RANKING_STORAGE === "memory";
  if (development && process.env.NODE_ENV === "production") throw new Error("El modo memoria no está permitido en producción.");
  let store;
  if (development) {
    console.warn("DESARROLLO: ranking en memoria, se pierde al reiniciar.");
    store = createMemoryStore();
  } else if (process.env.RANKING_STORAGE === "firestore") {
    if (!process.env.GOOGLE_CLOUD_PROJECT) throw new Error("Configura GOOGLE_CLOUD_PROJECT y las credenciales de Firestore.");
    const { Firestore } = await import("@google-cloud/firestore");
    store = createFirestoreStore(new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT }));
  } else {
    store = createGitHubRankingStore({
      token: process.env.GITHUB_TOKEN,
      repository: process.env.GITHUB_REPOSITORY ?? "mvisions/estudionoe",
      branch: process.env.GITHUB_DATA_BRANCH ?? "ranking-data",
    });
  }
  const origins = (process.env.ALLOWED_ORIGINS ?? "http://127.0.0.1:8080,http://localhost:8080").split(",").map(value => value.trim());
  createApi(createExamService(store), { origins, development, storage: process.env.RANKING_STORAGE ?? "github" }).listen(Number(process.env.PORT ?? 8081), "0.0.0.0", () => {
    console.log("API de estudio lista.");
  });
}
