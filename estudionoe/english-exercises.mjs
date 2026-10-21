import { gradeEnglishAnswer } from "./english-grading.mjs";
import { formatEnglishResultSummary } from "./english-result-summary.mjs";
import { shuffle } from "./grading.mjs";
import { monthNames, ordinalNumbers, spokenDate, writtenDate } from "./ordinal-numbers.mjs";
import { classroomPractice, classroomPhrases, classroomVocabulary } from "./english-classroom.mjs";
import { offerActivityRanking } from "./activity-ranking.mjs";

const app = document.querySelector("#english-exercises");
const reference = document.querySelector("#ordinal-words");
const classroomReference = document.querySelector("#classroom-words");
const phraseReference = document.querySelector("#classroom-phrases");
const events = [
  "la feria de ciencias", "el concierto del colegio", "la excursión al museo",
  "el día del deporte", "la función escolar", "la fiesta de otoño",
  "el concurso de arte", "la comida de Navidad",
];
const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const escape = text => String(text).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
let questions = [];
let mistakes = [];
let currentMode = "ordinal";
let startedAt = 0;
let rankingEligible = false;

const dateQuestions = monthNames.flatMap((month, monthIndex) =>
  Array.from({ length: daysInMonth[monthIndex] }, (_, index) => {
    const day = index + 1;
    const event = events[(day + monthIndex) % events.length];
    return {
      id: `date-${monthIndex + 1}-${day}`,
      display: `¿Cuándo es ${event}? · ${writtenDate(day, month)}`,
      answer: spokenDate(day, month),
    };
  }),
);

reference.innerHTML = ordinalNumbers.map(({ numeral, words }) => `
  <div class="ordinal-word"><strong>${numeral}</strong><span lang="en">${words}</span></div>
`).join("");
classroomReference.innerHTML = classroomVocabulary.map(({ english, spanish }) => `
  <div class="classroom-word"><strong lang="en">${english}</strong><span>${spanish}</span></div>
`).join("");
phraseReference.innerHTML = classroomPhrases.map(({ english, spanish }) => `
  <article><strong lang="en">${english}</strong><span>${spanish}</span></article>
`).join("");

function showPracticeOptions() {
  app.innerHTML = `<section class="question-card">
    <h2>Elige qué quieres practicar</h2>
    <p>Elige una ronda de ordinales, fechas o vocabulario y expresiones del aula.</p>
    <div class="result-actions">
      <button class="primary" type="button" data-action="start" data-mode="ordinal">Practicar 10 ordinales</button>
      <button class="primary" type="button" data-action="start" data-mode="date">Practicar 10 fechas</button>
      <button class="primary" type="button" data-action="start" data-mode="classroom">Practicar vocabulario y frases</button>
    </div>
  </section>`;
  document.querySelector(".ordinal-reference").hidden = false;
}

function start(mode, pool) {
  currentMode = mode;
  startedAt = Date.now();
  rankingEligible = !pool;
  const source = pool ?? ({
    ordinal: ordinalNumbers.map(question => ({
      id: `ordinal-${question.number}`,
      display: `${question.numeral} se escribe en inglés…`,
      answer: question.words,
    })),
    date: dateQuestions,
    classroom: classroomPractice,
  })[mode];
  const title = {
    ordinal: "Escribe el ordinal en inglés",
    date: "Di la fecha en inglés",
    classroom: "Practica el inglés del aula",
  }[mode];
  const directions = {
    ordinal: "Escribe con palabras cada número ordinal.",
    date: "Convierte cada fecha escrita en la fecha hablada. Escribe the, el ordinal y el mes.",
    classroom: "Traduce cada palabra o expresión al inglés.",
  }[mode];
  const placeholder = mode === "date"
    ? "the twenty-first of October"
    : mode === "classroom" ? "Escribe la traducción en inglés" : "Escribe el ordinal con palabras";
  questions = shuffle(source).slice(0, Math.min(10, source.length));
  document.querySelector(".ordinal-reference").hidden = true;
  app.innerHTML = `<form id="english-form" autocomplete="off">
    <h2 tabindex="-1">${title}</h2>
    <p>${directions} Cada acierto vale un punto; las respuestas vacías cuentan como fallo.</p>
    <p class="muted">Los ejercicios no se guardan al cerrar o recargar la página.</p>
    ${questions.map(({ id, display }) => `<div class="english-exercise">
      <label class="input-label" for="${id}">${escape(display)}</label>
      <input id="${id}" name="${id}" type="text" lang="en"
        placeholder="${placeholder}"
        autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off">
    </div>`).join("")}
    <div class="result-actions"><button class="primary" type="submit">Corregir ejercicios</button>
    <button class="secondary" type="button" data-action="study">Cambiar de práctica</button></div>
  </form>`;
  app.querySelector("h2").focus();
}

app.addEventListener("submit", event => {
  event.preventDefault();
  const answers = new FormData(event.target);
  const results = questions.map(question => {
    const answer = String(answers.get(question.id) ?? "");
    return {
      ...question,
      expected: question.answer,
      answer,
      correct: gradeEnglishAnswer(question.answer, answer),
    };
  });
  mistakes = results.filter(question => !question.correct);
  const correct = results.length - mistakes.length;
  const grade = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 })
    .format(correct / results.length * 10);
  app.innerHTML = `<section class="result-hero"><h2 tabindex="-1">¡Buen trabajo!</h2>
    <div class="grade-circle"><strong>${grade}</strong><span>NOTA SOBRE 10</span></div>
    <p>${formatEnglishResultSummary(correct, results.length)}</p>
    <div class="result-actions"><button class="primary" data-action="retry">Repetir esta práctica</button>
    ${mistakes.length ? '<button class="secondary" data-action="mistakes">Practicar solo los fallos</button>' : ""}
    <button class="secondary" data-action="study">Elegir otra práctica</button></div></section>
    <h2>Revisa tus respuestas</h2>
    ${results.map(question => `<article class="review">
      <span class="status ${question.correct ? "bien" : "mal"}">${question.correct ? "Bien" : "Para repasar"}</span>
      <h3>${escape(question.display)}</h3>
      <p>Tu respuesta: <span lang="en">${escape(question.answer.trim() || "Sin responder")}</span></p>
      <div class="model-answer">Respuesta: <strong lang="en">${escape(question.expected)}</strong></div>
    </article>`).join("")}`;
  if (rankingEligible && questions.length === 10) {
    const activity = { ordinal: "english-ordinal", date: "english-date", classroom: "english-classroom" }[currentMode];
    offerActivityRanking(app, {
      activity, ids: questions.map(question => question.id),
      answers: Object.fromEntries(results.map(question => [question.id, question.answer])),
      startedAt, finishedAt: Date.now(),
    });
  }
  app.querySelector("h2").focus();
  app.scrollIntoView({ block: "start" });
});

app.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "start") start(button.dataset.mode);
  if (button.dataset.action === "retry") start(currentMode);
  if (button.dataset.action === "mistakes") start(currentMode, mistakes);
  if (button.dataset.action === "study") {
    showPracticeOptions();
    app.querySelector("h2").focus();
  }
});

showPracticeOptions();
