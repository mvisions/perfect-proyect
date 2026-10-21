import { API_BASE } from "./config.mjs";

export const activityRankings = [
  { label: "Historia · Test fácil", mode: "easy", topic: "history" },
  { label: "Historia · Unir con flechas", mode: "matching", topic: "history" },
  { label: "Historia · Respuesta escrita", mode: "written", topic: "history" },
  { label: "Matemáticas · Test fácil", mode: "easy", topic: "powers" },
  { label: "Matemáticas · Unir con flechas", mode: "matching", topic: "powers" },
  { label: "Matemáticas · Respuesta escrita", mode: "written", topic: "powers" },
  { label: "Inglés · Ordinales", mode: "activity", topic: "english-ordinal" },
  { label: "Inglés · Fechas", mode: "activity", topic: "english-date" },
  { label: "Inglés · Aula", mode: "activity", topic: "english-classroom" },
  { label: "Lengua · Repaso", mode: "activity", topic: "language-review" },
  { label: "Lengua · Diptongos y triptongos", mode: "activity", topic: "language-vowels" },
  { label: "Lengua · Dictado", mode: "activity", topic: "language-dictation" },
];

const receiptKey = "noe-activity-ranking-receipts-v1";
const receiptKeys = [
  receiptKey, "noe-github-ranking-receipts-v1",
  "noe-powers-github-ranking-receipts-v1", "noe-ranking-receipts-v1",
];
const rankingRefreshers = new WeakMap();
const escape = text => String(text).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const duration = milliseconds => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
};
const number = value => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);

async function api(path, method = "GET", body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method, headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(90000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error del servidor (${response.status}).`);
  return data;
}

function renderEntries(container, entries) {
  container.innerHTML = entries.length ? `<div class="table-scroll"><table>
    <caption class="visually-hidden">Clasificación general de todas las asignaturas y actividades</caption>
    <thead><tr><th>Puesto</th><th>Asignatura</th><th>Prueba</th><th>Mascota / alias</th><th>Animal / registro</th><th>Nota / 10</th><th>Tiempo</th><th>Fecha</th></tr></thead>
    <tbody>${entries.map((entry, index) => {
      const item = activityRankings.find(ranking => ranking.mode === entry.mode
        && ranking.topic === (entry.topic ?? "history"));
      const [subject = "Otra", activity = "Actividad"] = item?.label.split(" · ") ?? [];
      return `<tr><td>${index + 1}</td><td>${escape(subject)}</td><td>${escape(activity)}</td>
        <td>${escape(entry.petName ?? entry.name ?? "Resultado antiguo")}</td>
        <td>${escape(entry.animalType ?? `Resultado antiguo · Curso: ${entry.course ?? "no indicado"}`)}</td>
        <td><strong>${number(entry.grade)}</strong></td><td>${duration(entry.durationMs)}</td>
        <td>${escape(new Date(entry.finishedAt).toLocaleDateString("es-ES"))}</td></tr>`;
    }).join("")}</tbody>
    </table></div>` : `<p class="muted">Todavía no hay resultados. ¡Puedes ser el primero en participar!</p>`;
}

export function mountActivityRankings(container, { fallbackEntries = [] } = {}) {
  if (!container) throw new Error("Falta el contenedor de rankings de actividades.");
  container.innerHTML = `<section class="ranking"><div class="section-heading"><h2>Ranking general</h2>
      <button class="secondary" type="button" data-ranking-refresh>Actualizar</button></div>
    <p class="muted">Los 50 mejores resultados completos de todas las asignaturas. Primero la nota y, en empate, el menor tiempo. La duración depende de cada prueba; es una clasificación de práctica, no un examen vigilado.</p>
    <p class="muted">Se muestran asignatura y prueba. Solo se publican mascota, tipo de animal, nota y tiempo cuando se da consentimiento.</p>
    <p class="muted" data-ranking-origin></p>
    <div data-ranking-entries aria-live="polite"><p class="muted">Cargando ranking…</p></div>
    <button class="secondary danger" type="button" data-ranking-remove>Retirar mis resultados de este dispositivo</button>
    <p class="muted" data-ranking-status role="status"></p></section>`;
  const entries = container.querySelector("[data-ranking-entries]");
  const status = container.querySelector("[data-ranking-status]");
  const origin = container.querySelector("[data-ranking-origin]");
  let request = 0;

  async function refresh() {
    const currentRequest = ++request;
    entries.innerHTML = `<p class="muted">Cargando ranking…</p>`;
    try {
      const response = await api("/api/ranking?mode=all");
      if (currentRequest !== request) return;
      renderEntries(entries, response.entries);
      origin.textContent = response.storage === "github"
        ? "Clasificación compartida guardada en GitHub."
        : "Clasificación recibida por una API de pruebas; no está guardada en GitHub.";
    } catch (error) {
      console.error("No se pudo cargar el ranking de actividades.", error);
      if (currentRequest !== request) return;
      if (fallbackEntries.length) {
        renderEntries(entries, fallbackEntries);
        origin.textContent = `API no disponible (${error.message}). Se muestran solo resultados locales de este dispositivo.`;
      } else entries.innerHTML = `<p class="form-error">Ranking no disponible: ${escape(error.message)}.</p>`;
    }
  }

  container.querySelector("[data-ranking-refresh]").addEventListener("click", refresh);
  container.querySelector("[data-ranking-remove]").addEventListener("click", async event => {
    const button = event.currentTarget;
    if (!window.confirm("¿Retirar de los rankings los resultados guardados desde este dispositivo? GitHub conserva el historial de cambios.")) return;
    button.disabled = true;
    try {
      for (const key of receiptKeys) {
        const receipts = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (!Array.isArray(receipts)) throw new Error("Un recibo local de ranking no tiene un formato válido.");
        for (const receipt of receipts) await api(`/api/exams/${receipt.id}`, "DELETE", { token: receipt.token });
      }
      for (const key of receiptKeys) localStorage.removeItem(key);
      status.textContent = "Tus resultados se han retirado de los rankings.";
      await refresh();
    } catch (error) {
      console.error("No se pudieron retirar los resultados del ranking.", error);
      status.textContent = `No se han podido retirar los resultados: ${error.message}. Conservamos los datos para reintentarlo.`;
    } finally { button.disabled = false; }
  });
  rankingRefreshers.set(container, refresh);
  refresh();
  return refresh;
}

export function refreshActivityRankings(container) {
  return rankingRefreshers.get(container)?.();
}

export function offerActivityRanking(container, { activity, ids, answers, startedAt, finishedAt }) {
  if (!container) throw new Error("Falta el espacio para ofrecer el ranking.");
  const panel = document.createElement("section");
  panel.className = "review activity-ranking-invite";
  panel.innerHTML = `<h2>¿Quieres aparecer en el ranking?</h2>
    <p class="muted">Es opcional. Si participas, se publicarán el nombre de tu mascota, el tipo de animal, la nota y el tiempo. No se guardan tus respuestas. Si eres menor, pide permiso a tu responsable.</p>
    <button class="primary" type="button">Participar con consentimiento</button>
    <p class="muted" role="status"></p>`;
  container.append(panel);
  const button = panel.querySelector("button");
  const status = panel.querySelector('[role="status"]');
  button.addEventListener("click", () => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `<h2>Participar en el ranking</h2><form>
      <label class="input-label" for="ranking-pet-name">Nombre de tu mascota</label>
      <input id="ranking-pet-name" name="petName" maxlength="40" required autocomplete="off" placeholder="Por ejemplo: Luna">
      <label class="input-label" for="ranking-animal-type">Tipo de animal</label>
      <input id="ranking-animal-type" name="animalType" maxlength="30" required autocomplete="off" placeholder="Por ejemplo: perro, gato o loro">
      <label class="consent"><input type="checkbox" name="consent" required>
        Acepto publicar estos datos en el ranking compartido de GitHub. GitHub conserva el historial de cambios incluso si retiro el resultado. No escribas tu nombre ni apellidos.</label>
      <p class="form-error" role="alert"></p>
      <div class="nav"><button type="button" class="secondary" data-cancel>Cancelar</button>
      <button type="submit" class="primary">Publicar mi resultado</button></div></form>`;
    document.body.append(dialog);
    dialog.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.querySelector("form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const submit = dialog.querySelector('[type="submit"]');
      const error = dialog.querySelector('[role="alert"]');
      submit.disabled = true;
      error.textContent = "";
      try {
        const result = await api("/api/activity-results", "POST", {
          activity, ids, answers, startedAt, finishedAt, consent: true,
          petName: String(form.get("petName") ?? "").trim(),
          animalType: String(form.get("animalType") ?? "").trim(),
        });
        dialog.close();
        button.disabled = true;
        status.textContent = `Resultado publicado: ${number(result.grade)} / 10.`;
        try {
          const receipts = JSON.parse(localStorage.getItem(receiptKey) ?? "[]");
          if (!Array.isArray(receipts)) throw new Error("El recibo local guardado no tiene un formato válido.");
          receipts.push({ id: result.id, token: result.token });
          localStorage.setItem(receiptKey, JSON.stringify(receipts));
        } catch (storageError) {
          console.error("El resultado se publicó, pero no se pudo guardar el recibo para retirarlo desde este dispositivo.", storageError);
          status.textContent += " No se pudo guardar el recibo para retirarlo desde este dispositivo.";
        }
        const rankingContainer = document.querySelector("[data-activity-rankings]");
        refreshActivityRankings(rankingContainer);
      } catch (submitError) {
        console.error("No se pudo publicar el resultado de la actividad.", submitError);
        error.textContent = submitError.message;
        submit.disabled = false;
      }
    });
    dialog.showModal();
    dialog.querySelector("#ranking-pet-name").focus();
  });
}

if (typeof document !== "undefined") {
  for (const container of document.querySelectorAll("[data-activity-rankings]"))
    mountActivityRankings(container);
}
