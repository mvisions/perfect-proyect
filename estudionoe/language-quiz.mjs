import { languageQuestions, languageGuide, gradeLanguageSelection } from "./language-questions.mjs";
import { shuffle, summarize } from "./grading.mjs";
import { initializeTheme } from "./theme.mjs";
import { offerActivityRanking } from "./activity-ranking.mjs";

const app = document.querySelector("#language-quiz");
const key = "noe-language-review-v1";
const escape = text => String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let state;
let storageFailed = false;
function announce(message) { document.querySelector("#notice").textContent = message; }
initializeTheme(announce);
document.querySelector("#language-guide").innerHTML = languageGuide.map(item =>
  `<h3>${escape(item.title)}</h3><p>${escape(item.text)}</p>`).join("");

function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); storageFailed = false; }
  catch (error) {
    console.error("No se pudo guardar el repaso de Lengua.", error);
    if (!storageFailed) announce("No se puede guardar el progreso. Puedes continuar, pero no cierres esta pestaña.");
    storageFailed = true;
  }
}
function start(ids = languageQuestions.map(item => item.id)) {
  state = { version: 1, ids: shuffle(ids), answers: {}, options: {}, page: 0, finished: false, startedAt: Date.now() };
  for (const item of languageQuestions.filter(item => ids.includes(item.id))) state.options[item.id] = shuffle([item.answer, ...item.wrong]);
  save();
  render();
}
const items = () => state.ids.map(id => languageQuestions.find(item => item.id === id));
function render(focus = true) {
  if (!state) {
    app.innerHTML = `<section class="question-card"><h2>Reconoce los ejemplos</h2>
      <p>${languageQuestions.length} ejercicios originales sobre los temas 1 y 2. Algunas parejas son sinónimos, otras antónimos y otras no son ninguna de las dos cosas.</p>
      <p class="muted">Tres opciones por ejercicio. Cada acierto suma un punto. Puedes cambiar tus respuestas antes de corregir; las preguntas sin responder cuentan como cero. Participar en el ranking general es opcional.</p>
      <button class="primary" data-action="start">Empezar repaso</button></section>`;
    return;
  }
  if (state.finished) {
    const graded = items().map(item => ({ item, answer: state.answers[item.id], ...gradeLanguageSelection(item, state.answers[item.id]) }));
    const summary = summarize(graded);
    const mistakes = graded.filter(item => item.score === 0);
    const review = rows => rows.map(row => `<article class="review"><span class="status ${row.status}">${row.score ? "Bien" : "Para repasar"}</span>
      <h3>${escape(row.item.category)} · ${escape(row.item.title)}</h3>
      <p><strong>Tu respuesta:</strong> ${escape(row.answer ?? "Sin responder")}</p>
      <div class="model-answer"><p><strong>Respuesta correcta:</strong> ${escape(row.item.answer)}</p></div>
      <p><strong>Por qué:</strong> ${escape(row.item.explanation)}</p></article>`).join("");
    app.innerHTML = `<section class="result-hero"><h2 tabindex="-1">¡Cada ejemplo te ayuda a aprender!</h2>
      <div class="grade-circle"><strong>${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(summary.grade)}</strong><span>NOTA SOBRE 10</span></div>
      <p>${summary.correct} ${summary.correct === 1 ? "acierto" : "aciertos"} de ${graded.length}. ${summary.wrong} ${summary.wrong === 1 ? "ejercicio" : "ejercicios"} para repasar.</p>
      <div class="result-actions"><button class="primary" data-action="start">Repetir todos</button>
      ${mistakes.length ? `<button class="secondary" data-action="mistakes">Practicar solo los fallos</button>` : ""}
      <button class="secondary danger" data-action="reset">Borrar este repaso</button></div></section>
      <h2>Lo que puedes mejorar</h2>${mistakes.length ? review(mistakes) : `<p>No hay fallos. ¡Muy bien!</p>`}
      <details class="source-note"><summary>Ver los aciertos y sus explicaciones (${summary.correct})</summary>${review(graded.filter(row => row.score === 1))}</details>`;
  } else {
    const question = items()[state.page];
    const answered = Object.keys(state.answers).length;
    app.innerHTML = `<div class="progress"><div class="progress-label"><span>Ejercicio ${state.page + 1} de ${state.ids.length}</span>
      <span>${answered} de ${state.ids.length} respondidos</span></div><progress value="${answered}" max="${state.ids.length}" aria-label="Ejercicios respondidos"></progress></div>
      <section class="question-card"><span class="eyebrow">${escape(question.category)}</span><h2 tabindex="-1">${escape(question.title)}</h2>
      <div class="options" role="group" aria-label="Elige una respuesta">${state.options[question.id].map((option, index) =>
        `<button class="option ${state.answers[question.id] === option ? "selected" : ""}" data-option="${index}" aria-pressed="${state.answers[question.id] === option}">
        <span class="option-letter">${"ABC"[index]}</span><span>${escape(option)}</span></button>`).join("")}</div></section>
      <div class="nav"><button class="secondary" data-action="previous" ${state.page === 0 ? "disabled" : ""}>← Anterior</button>
      <div class="nav-right"><button class="secondary" data-action="next" ${state.page === state.ids.length - 1 ? "disabled" : ""}>Siguiente →</button>
      <button class="primary" data-action="finish">Corregir repaso</button></div></div>
      <nav class="jump-list" aria-label="Ir a un ejercicio">${state.ids.map((id, index) => `<button class="jump ${state.answers[id] ? "answered" : ""} ${index === state.page ? "active" : ""}"
        data-page="${index}" aria-label="Ejercicio ${index + 1}">${index + 1}</button>`).join("")}</nav>
      <p class="muted">Tu progreso se guarda en este navegador. Las respuestas y explicaciones aparecen al corregir.</p>
      <button class="secondary danger" data-action="reset">Borrar este repaso</button>`;
  }
  if (focus) {
    const heading = app.querySelector("h2");
    heading.focus();
    heading.scrollIntoView({ block: "start" });
  }
}
app.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === "start") { start(); return; }
  if (!state) return;
  if (action === "reset") {
    if (!window.confirm("¿Borrar este repaso? No se borran el dictado, Historia ni Matemáticas.")) return;
    try { localStorage.removeItem(key); }
    catch (error) {
      console.error("No se pudo borrar el repaso.", error);
      announce("No se pudo borrar el progreso guardado. Conservamos los datos para que puedas reintentarlo.");
      return;
    }
    state = undefined;
    render();
    announce("Repaso borrado.");
    return;
  }
  if (action === "mistakes") {
    start(items().filter(item => !gradeLanguageSelection(item, state.answers[item.id]).score).map(item => item.id));
    return;
  }
  if (state.finished) return;
  if (button.dataset.option !== undefined) {
    const item = items()[state.page];
    state.answers[item.id] = state.options[item.id][Number(button.dataset.option)];
    save();
    render(false);
    app.querySelector(`[data-option="${button.dataset.option}"]`).focus();
    return;
  }
  if (action === "finish") {
    const unanswered = state.ids.length - Object.keys(state.answers).length;
    if (!window.confirm(unanswered ? `Quedan ${unanswered} ejercicios sin responder y contarán como cero. ¿Corregir el repaso?` : "¿Corregir el repaso y ver las explicaciones?")) return;
    state.finishedAt = Date.now();
    state.finished = true;
    save();
    render();
    if (state.ids.length === languageQuestions.length) {
      offerActivityRanking(app, {
        activity: "language-review", ids: state.ids.map(String),
        answers: Object.fromEntries(Object.entries(state.answers).map(([id, answer]) => [String(id), answer])),
        startedAt: state.startedAt, finishedAt: state.finishedAt,
      });
    }
    return;
  } else if (action === "previous" || action === "next" || button.dataset.page !== undefined) {
    state.page = button.dataset.page !== undefined ? Number(button.dataset.page) : state.page + (action === "next" ? 1 : -1);
  } else return;
  save();
  render();
});
try {
  const raw = localStorage.getItem(key);
  if (raw) {
    const candidate = JSON.parse(raw);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("El formato del repaso no es válido.");
    candidate.startedAt ??= Date.now();
    if (candidate.version !== 1 || !Array.isArray(candidate.ids) || !candidate.ids.length
      || new Set(candidate.ids).size !== candidate.ids.length || candidate.ids.some(id => !languageQuestions.some(item => item.id === id))
      || !Number.isInteger(candidate.page) || candidate.page < 0 || candidate.page >= candidate.ids.length
      || typeof candidate.finished !== "boolean" || !candidate.answers || typeof candidate.answers !== "object"
      || Array.isArray(candidate.answers) || !candidate.options || typeof candidate.options !== "object"
      || !Number.isFinite(candidate.startedAt) || candidate.startedAt < 0) throw new Error("El formato del repaso no es válido.");
    for (const [id, response] of Object.entries(candidate.answers)) {
      if (!candidate.ids.some(itemId => String(itemId) === id)) throw new Error("Hay respuestas ajenas al repaso.");
      gradeLanguageSelection(languageQuestions.find(item => String(item.id) === id), response);
    }
    for (const id of candidate.ids) {
      const item = languageQuestions.find(item => item.id === id);
      const options = candidate.options[id];
      if (!Array.isArray(options) || options.length !== 3 || new Set(options).size !== 3
        || options.some(option => ![item.answer, ...item.wrong].includes(option))) throw new Error("Las opciones guardadas no son válidas.");
    }
    state = candidate;
  }
} catch (error) {
  console.error("No se pudo recuperar el repaso.", error);
  announce("No se pudo recuperar el progreso guardado. Puedes empezar un repaso nuevo.");
}
render(false);
