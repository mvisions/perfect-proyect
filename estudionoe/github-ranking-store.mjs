import { HttpError } from "./exam-service.mjs";

export function parseLog(text) {
  const records = new Map();
  for (const line of text.split("\n").filter(line => line.trim())) {
    const event = JSON.parse(line);
    if (!event || typeof event.id !== "string" || !["result", "delete"].includes(event.type))
      throw new Error("El log de ranking contiene una línea inválida.");
    if (event.type === "delete") records.delete(event.id);
    else {
      const exam = event.exam;
      if (!exam || exam.id !== event.id || !exam.summary || !Number.isFinite(exam.summary.grade)
        || !Number.isFinite(exam.finishedAt) || !Number.isFinite(exam.durationMs)
        || !Array.isArray(exam.ids) || typeof exam.tokenHash !== "string")
        throw new Error("El log contiene un resultado inválido.");
      records.set(event.id, exam);
    }
  }
  return records;
}

export function createGitHubRankingStore({ token, repository, branch = "ranking-data", fetcher = fetch }) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Configura GITHUB_TOKEN y GITHUB_REPOSITORY.");
  const endpoint = `https://api.github.com/repos/${repository}/contents/ranking.txt`;
  const active = new Map();
  const headers = {
    Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json",
  };
  async function read() {
    const response = await fetcher(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers, signal: AbortSignal.timeout(20000) });
    if (response.status === 404) throw new Error("No existe ranking.txt o no hay acceso a la rama ranking-data.");
    if (!response.ok) throw new Error(`GitHub no permite leer el log (${response.status}).`);
    const file = await response.json();
    if (file.encoding !== "base64") throw new Error("El log excede el tamaño admitido por la API de GitHub.");
    const text = Buffer.from(file.content, "base64").toString("utf8");
    return { sha: file.sha, text, records: parseLog(text) };
  }
  async function mutate(change) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const file = await read();
      const result = change(file.records);
      if (!result.event) return result.response;
      const text = `${file.text.trimEnd()}${file.text.trim() ? "\n" : ""}${JSON.stringify(result.event)}\n`;
      if (Buffer.byteLength(text) > 900000) throw new Error("El log ha alcanzado su límite. El administrador debe archivarlo antes de añadir resultados.");
      const response = await fetcher(endpoint, {
        method: "PUT", headers, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          message: "Record study quiz result", branch, sha: file.sha,
          content: Buffer.from(text).toString("base64"),
        }),
      });
      if (response.status === 409 || response.status === 422) continue;
      if (!response.ok) throw new Error(`No se pudo guardar el resultado en GitHub (${response.status}).`);
      return result.response;
    }
    throw new Error("Hay entregas simultáneas. Reintentaremos guardar el resultado.");
  }
  return {
    async create(exam) {
      for (const [id, item] of active) if (Date.now() - item.startedAt > 86400000) active.delete(id);
      if (!active.has(exam.id)) active.set(exam.id, exam);
    },
    async update(id, change) {
      const response = await mutate(records => {
        const stored = records.get(id);
        const result = change(stored ?? active.get(id));
        if (stored) return { response: result.response };
        return { response: result.response, event: { type: "result", id, exam: result.exam } };
      });
      active.delete(id);
      return response;
    },
    async ranking(mode, topic = "history") {
      const { records } = await read();
      return [...records.values()].filter(exam => exam.mode === mode && (exam.topic ?? "history") === topic)
        .sort((a, b) => b.summary.grade - a.summary.grade || a.durationMs - b.durationMs || a.finishedAt - b.finishedAt).slice(0, 50);
    },
    async remove(id, tokenHash) {
      await mutate(records => {
        const exam = records.get(id) ?? active.get(id);
        if (exam && exam.tokenHash !== tokenHash) throw new HttpError(404, "No se encuentra este examen.");
        return records.has(id) ? { event: { type: "delete", id } } : {};
      });
      active.delete(id);
    },
  };
}
