import { dictation, dictationText } from "./dictation-content.mjs?v=3";
import { gradeDictation, tokenizeDictation } from "./dictation-grading.mjs";
import { createDictationPlayer } from "./dictation-audio.mjs";
import { initializeTheme } from "./theme.mjs";
import { offerActivityRanking } from "./activity-ranking.mjs";

const answer = document.querySelector("#dictation-answer");
const results = document.querySelector("#dictation-results");
const audioStatus = document.querySelector("#audio-status");
const audioError = document.querySelector("#audio-error");
const writingError = document.querySelector("#writing-error");
const speed = document.querySelector("#voice-speed");
const play = document.querySelector("#play-dictation");
const stop = document.querySelector("#stop-dictation");
const repeat = document.querySelector("#repeat-chunk");
const next = document.querySelector("#next-chunk");
const key = "noe-language-dictation-v1";
let heard = false;
let startedAt = 0;
let storageFailed = false;
let noticeTimer;

function announce(text, persistent = false) {
  clearTimeout(noticeTimer);
  document.querySelector("#notice").textContent = text;
  if (!persistent) noticeTimer = setTimeout(() => { document.querySelector("#notice").textContent = ""; }, 6000);
}
initializeTheme(announce);

function showAudioError(message) {
  console.error("No se pudo reproducir el dictado.", message);
  audioError.textContent = message;
  audioError.hidden = false;
}

const player = createDictationPlayer({
  chunks: dictation.chunks,
  onError: showAudioError,
  onState({ status, index, total }) {
    const active = ["starting", "speaking", "waiting"].includes(status);
    play.disabled = active;
    stop.disabled = !active;
    speed.disabled = active;
    if (status === "speaking") heard = true;
    repeat.disabled = !heard;
    next.disabled = !heard || index === total - 1;
    const labels = {
      idle: heard ? "Lectura detenida. Puedes repetir el fragmento o pasar al siguiente." : "Pulsa Play para empezar.",
      starting: "Preparando el fragmento…",
      speaking: "Escucha y escribe.",
      waiting: "Pausa de cuatro segundos para escribir.",
      finished: index === total - 1 ? "Lectura terminada. Revisa lo que has escrito y pulsa «Corregir mi dictado»." : "Fragmento terminado. Pulsa «Siguiente fragmento» para continuar.",
    };
    audioStatus.textContent = `${labels[status]}${heard || active ? ` Fragmento ${index + 1} de ${total}.` : ""}`;
  },
});

audioStatus.textContent = "Audio en español preparado. Pulsa Play para escuchar.";
const rate = () => Number(speed.value);
function playback(action) {
  audioError.hidden = true;
  action(rate());
}
play.addEventListener("click", () => {
  if (!startedAt) startedAt = Date.now();
  playback(value => player.play(value));
});
repeat.addEventListener("click", () => playback(value => player.repeat(value)));
next.addEventListener("click", () => playback(value => player.next(value)));
stop.addEventListener("click", () => player.stop());
window.addEventListener("pagehide", () => player.stop());

function save(reviewed) {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, id: dictation.id, text: answer.value, reviewed }));
    storageFailed = false;
  } catch (error) {
    console.error("No se pudo guardar el dictado.", error);
    if (!storageFailed) announce("No se puede guardar tu borrador en este navegador. Puedes continuar, pero no cierres la pestaña.", true);
    storageFailed = true;
  }
}
answer.addEventListener("input", () => {
  if (!startedAt) startedAt = Date.now();
  results.hidden = true;
  results.replaceChildren();
  writingError.hidden = true;
  save(false);
});

const escape = text => String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const labels = { spelling: "Ortografía", accent: "Tilde (y mayúscula, si cambia)", capitalization: "Mayúscula o minúscula", missing: "Palabra que falta", extra: "Palabra de más", punctuation: "Puntuación" };
const hints = {
  spelling: "Fíjate en todas las letras de la palabra correcta. La ñ y la ü también son importantes.",
  accent: "Revisa dónde lleva tilde la palabra y cómo empieza.",
  capitalization: "Revisa los nombres propios y el comienzo de cada oración.",
  missing: "Escucha de nuevo esta parte: falta una palabra del texto.",
  extra: "Esta palabra no aparece aquí en el dictado. Puede haberse repetido o añadido.",
  punctuation: "Escucha las indicaciones de coma y punto. Revisa este signo.",
};

function renderReview(offerRanking = true) {
  const review = gradeDictation(dictationText, answer.value);
  const tokens = tokenizeDictation(answer.value);
  const errors = new Set(review.issues.filter(issue => issue.actual).map(issue => issue.actualIndex));
  const normalized = answer.value.normalize("NFC");
  let position = 0;
  const marked = tokens.map((token, index) => {
    const gap = escape(normalized.slice(position, token.start));
    position = token.end;
    return `${gap}${errors.has(index) ? `<mark class="dictation-error">${escape(token.text)}</mark>` : escape(token.text)}`;
  }).join("") + escape(normalized.slice(position));
  const referenceTokens = tokenizeDictation(dictationText);
  results.innerHTML = `<h2 id="results-title" tabindex="-1">${review.issues.length ? "¡Vamos a mejorar tu dictado!" : "¡Un dictado sin faltas!"}</h2>
    <p>Has escrito correctamente <strong>${review.correctWords} de ${review.totalWords} palabras</strong>. Hay ${review.issues.length} diferencias con el modelo, ${review.punctuationErrors} de puntuación.</p>
    <p class="muted">Es una comparación con este dictado, no un corrector de cualquier texto. Si has escrito algo distinto de lo que dice, aparecerá como una diferencia. Los espacios y saltos de línea no cuentan como faltas.</p>
    <article class="review"><h3>Tu texto revisado</h3><p class="muted">Las partes subrayadas tienen diferencias. Las palabras que faltan se indican en la lista de abajo.</p><p class="dictation-text">${marked}</p></article>
    ${review.issues.length ? `<article class="review"><h3>Revisa estas diferencias</h3><ol class="dictation-corrections">${review.issues.map(issue => {
      const context = referenceTokens.slice(Math.max(0, issue.expectedIndex - 3), issue.expectedIndex + 4).map(token => token.text).join(" ");
      return `<li><strong>${labels[issue.kind]}:</strong> ${issue.actual ? `escribiste «${escape(issue.actual)}»` : "no escribiste esta parte"}.
        ${issue.expected ? `Debe ser <strong>«${escape(issue.expected)}»</strong>.` : "No hay que añadirlo en este lugar."}
        <span class="muted">${hints[issue.kind]}</span><span class="dictation-context">En el modelo: «${escape(context)}».</span></li>`;
    }).join("")}</ol></article>` : `<div class="info-strip">Has cuidado las letras, las tildes, las mayúsculas y los signos. ¡Muy bien!</div>`}
    <article class="review"><h3>El dictado correcto</h3><div class="model-answer"><p class="dictation-text">${escape(dictationText)}</p></div></article>
    <article class="review"><h3>Trucos para la próxima vez</h3><ul>${dictation.tips.map(tip => `<li>${escape(tip)}</li>`).join("")}</ul><p>Puedes editar tu texto de arriba y volver a corregir, o empezar de nuevo para escucharlo otra vez.</p></article>`;
  if (offerRanking) {
    offerActivityRanking(results, {
      activity: "language-dictation", ids: ["dictation-biblioteca"],
      answers: { "dictation-biblioteca": answer.value },
      startedAt: startedAt || Date.now(), finishedAt: Date.now(),
    });
  }
  results.hidden = false;
}
document.querySelector("#dictation-form").addEventListener("submit", event => {
  event.preventDefault();
  writingError.hidden = true;
  try { renderReview(); }
  catch (error) {
    console.error("No se pudo corregir el dictado.", error);
    writingError.textContent = error.message;
    writingError.hidden = false;
    answer.focus();
    return;
  }
  player.stop();
  save(true);
  document.querySelector("#results-title").focus();
});
document.querySelector("#reset-dictation").addEventListener("click", () => {
  if (answer.value && !window.confirm("¿Borrar este dictado y empezar de nuevo? No se borran los datos de Historia ni de Matemáticas.")) return;
  try { localStorage.removeItem(key); }
  catch (error) {
    console.error("No se pudo borrar el dictado.", error);
    announce("No se pudo borrar el borrador guardado. Conservamos tu texto para que puedas reintentarlo.", true);
    return;
  }
  player.stop();
  heard = false;
  startedAt = 0;
  repeat.disabled = true;
  next.disabled = true;
  audioStatus.textContent = "Pulsa Play para empezar.";
  answer.value = "";
  results.hidden = true;
  results.replaceChildren();
  writingError.hidden = true;
  audioError.hidden = true;
  document.querySelector("#adult-text").hidden = true;
  document.querySelector("#adult-text").textContent = "";
  document.querySelector(".adult-reader").open = false;
  answer.focus();
  announce("Dictado borrado. ¡Un nuevo intento!");
});
document.querySelector("#reveal-dictation").addEventListener("click", () => {
  const text = document.querySelector("#adult-text");
  text.textContent = dictationText;
  text.hidden = false;
});
try {
  const stored = localStorage.getItem(key);
  if (stored) {
    const draft = JSON.parse(stored);
    if (!draft || draft.version !== 1 || draft.id !== dictation.id || typeof draft.text !== "string"
      || draft.text.length > 4000 || typeof draft.reviewed !== "boolean") throw new Error("El borrador tiene un formato no válido.");
    answer.value = draft.text;
    if (draft.reviewed) renderReview(false);
  }
} catch (error) {
  console.error("No se pudo recuperar el dictado.", error);
  announce("No se pudo recuperar el borrador guardado. Puedes comenzar uno nuevo.", true);
}
