import { offerActivityRanking } from "./activity-ranking.mjs";

export const vowelQuestions = [
  { word: "cielo", answer: "Diptongo", explanation: "ie se pronuncia en una misma sílaba: cie-lo." },
  { word: "ciudad", answer: "Diptongo", explanation: "iu son dos vocales cerradas distintas en una misma sílaba: ciu-dad." },
  { word: "causa", answer: "Diptongo", explanation: "au se pronuncia en una misma sílaba: cau-sa." },
  { word: "aire", answer: "Diptongo", explanation: "ai se pronuncia en una misma sílaba: ai-re." },
  { word: "peine", answer: "Diptongo", explanation: "ei se pronuncia en una misma sílaba: pei-ne." },
  { word: "puerta", answer: "Diptongo", explanation: "ue se pronuncia en una misma sílaba: puer-ta." },
  { word: "piano", answer: "Diptongo", explanation: "ia se pronuncia en una misma sílaba: pia-no." },
  { word: "buey", answer: "Triptongo", explanation: "uey reúne cerrada + abierta + cerrada en una sílaba." },
  { word: "limpiáis", answer: "Triptongo", explanation: "iái reúne cerrada átona + abierta + cerrada átona en una sílaba." },
  { word: "miau", answer: "Triptongo", explanation: "iau se pronuncia en una misma sílaba." },
  { word: "Uruguay", answer: "Triptongo", explanation: "uay reúne cerrada + abierta + cerrada en una sílaba: guay." },
  { word: "guau", answer: "Triptongo", explanation: "uau reúne cerrada + abierta + cerrada en una sílaba." },
  { word: "averiguáis", answer: "Triptongo", explanation: "uái reúne cerrada átona + abierta + cerrada átona en una sílaba: guáis." },
  { word: "actuéis", answer: "Triptongo", explanation: "uéi reúne cerrada átona + abierta + cerrada átona en una sílaba: tuéis." },
  { word: "mesa", answer: "Ninguno", explanation: "No hay dos o tres vocales juntas que formen un diptongo o un triptongo." },
  { word: "libro", answer: "Ninguno", explanation: "Sus vocales no forman una unión de dos o tres vocales en la misma sílaba." },
  { word: "poeta", answer: "Ninguno", explanation: "oe forma un hiato y se pronuncia en sílabas distintas: po-e-ta." },
  { word: "país", answer: "Ninguno", explanation: "La tilde en í rompe la unión de vocales: pa-ís." },
  { word: "teatro", answer: "Ninguno", explanation: "ea forma un hiato y se pronuncia en sílabas distintas: te-a-tro." },
  { word: "baúl", answer: "Ninguno", explanation: "La tilde en ú rompe la unión de vocales: ba-úl." },
];

const categories = ["Diptongo", "Triptongo", "Ninguno"];
const form = globalThis.document?.querySelector("#vowel-quiz");
const questionsContainer = globalThis.document?.querySelector("#vowel-questions");
const result = globalThis.document?.querySelector("#vowel-quiz-result");
let startedAt = Date.now();

export function shuffleVowelQuestions(questions, random = Math.random, previousOrder = []) {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (shuffled.length > 1 && shuffled.every((question, index) => question.word === previousOrder[index])) {
    shuffled.push(shuffled.shift());
  }

  return shuffled;
}

if (form && questionsContainer && result) {
  const previousOrder = globalThis.localStorage.getItem("language-vowels-question-order")?.split("|") ?? [];
  const questions = shuffleVowelQuestions(vowelQuestions, Math.random, previousOrder);
  globalThis.localStorage.setItem("language-vowels-question-order", questions.map(question => question.word).join("|"));

  questionsContainer.innerHTML = questions.map((question, index) => `
    <fieldset class="vowel-question" data-question="${index}">
      <legend><span class="vowel-question-number">${index + 1}</span> ¿Qué hay en <strong>${question.word}</strong>?</legend>
      <div class="vowel-options">
        ${categories.map(category => `
          <label>
            <input type="radio" name="word-${index}" value="${category}">
            <span>${category}</span>
          </label>
        `).join("")}
      </div>
      <p class="vowel-feedback" hidden></p>
    </fieldset>
  `).join("");

  form.addEventListener("submit", event => {
    event.preventDefault();
    let score = 0;
    let unanswered = 0;

    questions.forEach((question, index) => {
      const fieldset = questionsContainer.querySelector(`[data-question="${index}"]`);
      const selected = form.querySelector(`input[name="word-${index}"]:checked`);
      const feedback = fieldset.querySelector(".vowel-feedback");
      if (!selected) unanswered += 1;
      const correct = selected?.value === question.answer;
      if (correct) score += 1;
      fieldset.dataset.correct = String(correct);
      feedback.hidden = false;
      feedback.textContent = `${correct ? "¡Correcto!" : `Respuesta: ${question.answer}.`} ${question.explanation}`;
    });

    result.textContent = unanswered
      ? `Has acertado ${score} de ${questions.length}. Te faltan ${unanswered} por responder; puedes completarlas y corregir de nuevo.`
      : `Resultado: ${score} de ${questions.length}. ${score === questions.length ? "¡Excelente, ya dominas la clasificación!" : "Revisa las explicaciones y vuelve a intentarlo."}`;
    const section = form.closest(".language-practice");
    section.querySelector(".activity-ranking-invite")?.remove();
    if (!unanswered) {
      offerActivityRanking(section, {
        activity: "language-vowels",
        ids: questions.map(question => `vowel-${question.word}`),
        answers: Object.fromEntries(questions.map((question, index) => [
          `vowel-${question.word}`, form.querySelector(`input[name="word-${index}"]:checked`).value,
        ])),
        startedAt, finishedAt: Date.now(),
      });
    }
  });

  form.addEventListener("reset", () => {
    startedAt = Date.now();
    form.closest(".language-practice").querySelector(".activity-ranking-invite")?.remove();
    for (const fieldset of questionsContainer.querySelectorAll(".vowel-question")) {
      delete fieldset.dataset.correct;
      const feedback = fieldset.querySelector(".vowel-feedback");
      feedback.hidden = true;
      feedback.textContent = "";
    }
    result.textContent = "";
  });
}
