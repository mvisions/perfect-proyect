import { classroomPractice } from "./english-classroom.mjs";
import { gradeEnglishAnswer } from "./english-grading.mjs";
import { dictationText } from "./dictation-content.mjs";
import { gradeDictation } from "./dictation-grading.mjs";
import { monthNames, ordinalNumbers, spokenDate } from "./ordinal-numbers.mjs";
import { languageQuestions, gradeLanguageSelection } from "./language-questions.mjs";
import { vowelQuestions } from "./language-vowels.mjs";

const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function scoreChoices(ids, answers, bank) {
  const points = ids.reduce((score, id) => score + Number(
    typeof answers[id] === "string" && gradeEnglishAnswer(bank.get(id), answers[id]),
  ), 0);
  return { points, total: ids.length };
}

function scoreActivity(activity, ids, answers) {
  if (activity === "english-ordinal") {
    const bank = new Map(ordinalNumbers.map(({ number, words }) => [`ordinal-${number}`, words]));
    return scoreChoices(ids, answers, bank);
  }
  if (activity === "english-date") {
    const bank = new Map();
    monthNames.forEach((month, monthIndex) => {
      for (let day = 1; day <= daysInMonth[monthIndex]; day++)
        bank.set(`date-${monthIndex + 1}-${day}`, spokenDate(day, month));
    });
    return scoreChoices(ids, answers, bank);
  }
  if (activity === "english-classroom") {
    const bank = new Map(classroomPractice.map(question => [question.id, question.answer]));
    return scoreChoices(ids, answers, bank);
  }
  if (activity === "language-review") {
    const bank = new Map(languageQuestions.map(question => [String(question.id), question]));
    const points = ids.reduce((score, id) => score + gradeLanguageSelection(bank.get(id), answers[id]).score, 0);
    return { points, total: ids.length };
  }
  if (activity === "language-vowels") {
    const bank = new Map(vowelQuestions.map(question => [`vowel-${question.word}`, question.answer]));
    return scoreChoices(ids, answers, bank);
  }
  if (activity === "language-dictation") {
    const review = gradeDictation(dictationText, answers["dictation-biblioteca"] ?? "");
    return { points: review.correctWords, total: review.totalWords };
  }
  throw new Error("Actividad no válida.");
}

const questionIds = {
  "english-ordinal": new Set(ordinalNumbers.map(({ number }) => `ordinal-${number}`)),
  "english-date": new Set(monthNames.flatMap((_, monthIndex) =>
    Array.from({ length: daysInMonth[monthIndex] }, (_, day) => `date-${monthIndex + 1}-${day + 1}`))),
  "english-classroom": new Set(classroomPractice.map(question => question.id)),
  "language-review": new Set(languageQuestions.map(question => String(question.id))),
  "language-vowels": new Set(vowelQuestions.map(question => `vowel-${question.word}`)),
  "language-dictation": new Set(["dictation-biblioteca"]),
};

export const activityDefinitions = Object.freeze({
  "english-ordinal": { label: "Inglés · Ordinales", minQuestions: 10, maxQuestions: 10 },
  "english-date": { label: "Inglés · Fechas", minQuestions: 10, maxQuestions: 10 },
  "english-classroom": { label: "Inglés · Aula", minQuestions: 10, maxQuestions: 10 },
  "language-review": { label: "Lengua · Repaso", minQuestions: languageQuestions.length, maxQuestions: languageQuestions.length },
  "language-vowels": { label: "Lengua · Diptongos y triptongos", minQuestions: vowelQuestions.length, maxQuestions: vowelQuestions.length },
  "language-dictation": { label: "Lengua · Dictado", minQuestions: 1, maxQuestions: 1 },
});

export function gradeActivity(activity, ids, answers) {
  const definition = activityDefinitions[activity];
  const allowedIds = questionIds[activity];
  if (!definition || !Array.isArray(ids) || ids.length < definition.minQuestions || ids.length > definition.maxQuestions
    || new Set(ids).size !== ids.length || ids.some(id => typeof id !== "string" || !allowedIds.has(id))
    || !answers || typeof answers !== "object" || Array.isArray(answers)
    || Object.keys(answers).some(id => !ids.includes(id))
    || Object.values(answers).some(answer => typeof answer !== "string" || answer.length > 4000))
    throw new Error("Las respuestas de la actividad no tienen un formato válido.");
  return scoreActivity(activity, ids, answers);
}
