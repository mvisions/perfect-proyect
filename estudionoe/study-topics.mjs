import { questions, matchingPairs } from "./questions.mjs";
import { gradeChoice, gradeWritten } from "./grading.mjs";
import { questions as powerQuestions, matchingPairs as powerPairs } from "./powers-questions.mjs";
import { gradePowerChoice, gradePowerWritten } from "./powers-grading.mjs";

export const studyTopics = {
  history: {
    questions, matchingPairs, gradeChoice, gradeWritten,
    subject: "historia", subjectLabel: "HISTORIA", bookTitle: "La Edad<br>Media",
    heroTitle: "La historia se aprende", description: "Del Imperio Romano a los reinos cristianos. Elige cómo quieres estudiar y descubre todo lo que ya sabes.",
    writtenHint: "Incluye las fechas, nombres e ideas que pide la pregunta. Corrección orientativa por ideas clave: 1 / 0,5 / 0 puntos.",
  },
  powers: {
    questions: powerQuestions, matchingPairs: powerPairs, gradeChoice: gradePowerChoice, gradeWritten: gradePowerWritten,
    subject: "matemáticas", subjectLabel: "MATEMÁTICAS", bookTitle: "Las<br>potencias",
    heroTitle: "Las potencias se aprenden", description: "Entiende, simplifica, suma, resta, multiplica y divide potencias. Bases positivas y exponentes de 0 a 6, paso a paso.",
    writtenHint: "Escribe solo el resultado: un número como 12 o una potencia como 2^5 o 2⁵. Si se pide una potencia simplificada de una base concreta, el valor correcto en otra forma obtiene 0,5 puntos. No escribas operaciones pendientes.",
  },
};

export function getStudyTopic(topic = "history") {
  if (typeof topic !== "string" || !Object.hasOwn(studyTopics, topic)) throw new Error("Tema de estudio no válido.");
  return studyTopics[topic];
}
