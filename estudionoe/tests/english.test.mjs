import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gradeEnglishAnswer } from "../english-grading.mjs";
import { formatEnglishResultSummary } from "../english-result-summary.mjs";
import { classroomPractice, classroomPhrases, classroomVocabulary } from "../english-classroom.mjs";
import {
  monthNames, ordinalNumbers, ordinalSuffix, ordinalWords, spokenDate, writtenDate,
} from "../ordinal-numbers.mjs";

test("Se generan los 100 ordinales en inglés sin duplicados", () => {
  assert.equal(ordinalNumbers.length, 100);
  assert.equal(new Set(ordinalNumbers.map(({ words }) => words)).size, 100);
  assert.deepEqual(ordinalNumbers[0], { number: 1, numeral: "1st", words: "first" });
  assert.deepEqual(ordinalNumbers[1], { number: 2, numeral: "2nd", words: "second" });
  assert.deepEqual(ordinalNumbers[2], { number: 3, numeral: "3rd", words: "third" });
  assert.deepEqual(ordinalNumbers[99], { number: 100, numeral: "100th", words: "one hundredth" });
});

test("Se escriben correctamente las excepciones, decenas y números compuestos", () => {
  for (const [number, words] of [
    [5, "fifth"], [8, "eighth"], [9, "ninth"], [12, "twelfth"],
    [20, "twentieth"], [21, "twenty-first"], [23, "twenty-third"],
    [30, "thirtieth"], [40, "fortieth"], [50, "fiftieth"],
    [80, "eightieth"], [99, "ninety-ninth"],
  ]) {
    assert.equal(ordinalWords(number), words);
  }
  for (const [number, suffix] of [
    [1, "st"], [2, "nd"], [3, "rd"], [4, "th"], [11, "th"],
    [12, "th"], [13, "th"], [21, "st"], [22, "nd"], [23, "rd"], [100, "th"],
  ]) {
    assert.equal(ordinalSuffix(number), suffix);
  }
  assert.throws(() => ordinalWords(0), RangeError);
  assert.throws(() => ordinalWords(101), RangeError);
  assert.throws(() => ordinalSuffix(1.5), RangeError);
});

test("Las fechas se escriben y se dicen con ordinales y el orden británico", () => {
  assert.deepEqual(monthNames, [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]);
  assert.equal(writtenDate(1, "October"), "1st October");
  assert.equal(spokenDate(1, "October"), "the first of October");
  assert.equal(writtenDate(21, "October"), "21st October");
  assert.equal(spokenDate(21, "October"), "the twenty-first of October");
  assert.equal(spokenDate(31, "December"), "the thirty-first of December");
  assert.equal(spokenDate(29, "February"), "the twenty-ninth of February");
  assert.throws(() => writtenDate(30, "February"), RangeError);
  assert.throws(() => spokenDate(31, "April"), RangeError);
});

test("El vocabulario del aula tiene consulta y práctica de traducción", () => {
  assert.equal(classroomVocabulary.length, 10);
  assert.equal(classroomPhrases.length, 6);
  assert.equal(classroomPractice.length, 16);
  assert.ok(classroomPractice.some(question => question.answer === "calculator"));
  assert.ok(classroomPractice.some(question => question.answer === "Can you speak more slowly?"));
  for (const question of classroomPractice) {
    assert.ok(question.display);
    assert.equal(gradeEnglishAnswer(question.answer, question.answer), true);
  }
});

test("La página de Inglés reúne ordinales, fechas y expresiones del aula", () => {
  const html = readFileSync(new URL("../aula/ingles.html", import.meta.url), "utf8");
  const homepage = readFileSync(new URL("../aula/index.html", import.meta.url), "utf8");
  const exercises = readFileSync(new URL("../english-exercises.mjs", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  const classroom = readFileSync(new URL("../english-classroom.mjs", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /Ordinal numbers/);
  assert.match(html, /Del 1.º al 100.º/);
  assert.match(html, /números compuestos/);
  assert.match(html, /Fechas en inglés/);
  assert.match(html, /Classroom English/);
  assert.match(html, /Los meses/);
  assert.match(html, /id="classroom-phrases"/);
  assert.match(homepage, /números ordinales del primero al centésimo/);
  assert.doesNotMatch(homepage, /english-exam-alert-title|INGLÉS ACTUALIZADO|Empezar a estudiar Inglés/);
  assert.match(homepage, /CONTROL DE LENGUA/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(html, /src="\.\.\/english-exercises\.mjs"/);
  assert.match(workflow, /estudionoe\/english-\*\.mjs/);
  assert.match(workflow, /dist\/estudionoe\//);
  assert.match(exercises, /Practicar solo los fallos/);
  assert.match(exercises, /gradeEnglishAnswer/);
  assert.match(exercises, /data-mode="date"/);
  assert.match(exercises, /data-mode="classroom"/);
  assert.match(classroom, /classroomPractice/);
  for (const topic of [3, 4]) {
    const redirect = readFileSync(new URL(`../aula/ingles-tema-${topic}.html`, import.meta.url), "utf8");
    assert.match(redirect, /http-equiv="refresh" content="0; url=\.\/ingles\.html"/);
    assert.doesNotMatch(redirect, /Carnival|Wild animals/);
  }
});

test("El corrector ignora mayúsculas y espacios, pero exige la ortografía correcta", () => {
  assert.equal(gradeEnglishAnswer("twenty-first", "  TWENTY-FIRST  "), true);
  assert.equal(gradeEnglishAnswer("twenty-first", "twenty first"), false);
  assert.equal(gradeEnglishAnswer("twelfth", "twelveth"), false);
  assert.equal(gradeEnglishAnswer("Can you speak more slowly?", "CAN YOU SPEAK MORE SLOWLY?"), true);
  assert.equal(gradeEnglishAnswer("Sorry, I'm late.", "Sorry, I’m late"), true);
  assert.equal(gradeEnglishAnswer("Sorry, I'm late.", "Sorry, I'm late.  "), true);
  assert.equal(gradeEnglishAnswer("first", ""), false);
  assert.throws(() => gradeEnglishAnswer("first", null), TypeError);
  assert.throws(() => gradeEnglishAnswer("", "first"), TypeError);
});

test("El resumen de resultados usa puntuación y singular/plural correctos", () => {
  assert.equal(
    formatEnglishResultSummary(0, 1),
    "0 aciertos de 1; 1 respuesta para repasar.",
  );
  assert.equal(
    formatEnglishResultSummary(1, 1),
    "1 acierto de 1; 0 respuestas para repasar.",
  );
  assert.equal(
    formatEnglishResultSummary(8, 10),
    "8 aciertos de 10; 2 respuestas para repasar.",
  );
});
