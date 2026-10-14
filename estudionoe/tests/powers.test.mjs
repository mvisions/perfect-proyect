import test from "node:test";
import assert from "node:assert/strict";
import { questions, matchingPairs } from "../powers-questions.mjs";
import { gradePowerWritten, gradePowerChoice, parseMathAnswer } from "../powers-grading.mjs";
import { getStudyTopic } from "../study-topics.mjs";
import { summarize } from "../grading.mjs";

test("30 ejercicios, seis categorías, respuestas verificadas y parejas sin ambigüedad", () => {
  const values = [3, 5, 8, 1, 4, 64, 729, 625, 343, 64, 12, 18, 30, 9, 20, 12, 18, 20, 15, 0, 32, 729, 625, 49, 4096, 16, 9, 125, 1, 1024];
  assert.equal(questions.length, 30);
  assert.deepEqual(questions.map(q => q.id), Array.from({ length: 30 }, (_, index) => index + 1));
  for (const [index, item] of questions.entries()) {
    assert.equal(parseMathAnswer(item.answer).value, values[index], `Ejercicio ${item.id}`);
    assert.equal(new Set([item.answer, ...item.wrong]).size, 3);
    assert.equal(item.wrong.length, 2);
    assert.ok(item.explanation.length > 20);
    if (item.solution.kind === "power") {
      assert.ok(item.solution.exponent >= 0 && item.solution.exponent <= 6);
      assert.ok(item.solution.base > 0);
    }
    assert.equal(gradePowerWritten(item, item.answer).score, 1);
    assert.equal(gradePowerChoice(item, item.answer).score, 1);
    for (const wrong of item.wrong) {
      assert.equal(gradePowerChoice(item, wrong).score, 0);
      assert.equal(gradePowerWritten(item, wrong).score, 0, `Distractor ${wrong} del ejercicio ${item.id}`);
    }
    assert.equal(gradePowerWritten(item, "").score, 0);
  }
  const categories = [...new Set(questions.map(item => item.category))];
  assert.equal(categories.length, 6);
  for (const category of categories) {
    assert.equal(questions.filter(item => item.category === category).length, 5);
    assert.ok(matchingPairs.some(pair => pair.category === category));
  }
  assert.equal(matchingPairs.length, 20);
  assert.equal(new Set(matchingPairs.map(pair => pair.id)).size, 20);
  assert.equal(new Set(matchingPairs.map(pair => pair.answer)).size, 20);
  assert.equal(new Set(matchingPairs.map(pair => parseMathAnswer(pair.answer).value)).size, 20);
  assert.equal(summarize(questions.map(item => gradePowerWritten(item, item.answer))).grade, 10);
});

test("La corrección conserva signos, reconoce superíndices y exige el formato solicitado", () => {
  const product = questions.find(q => q.id === 21);
  for (const answer of ["2^5", "2⁵", " 2 ^ 5 "]) assert.equal(gradePowerWritten(product, answer).score, 1);
  for (const answer of ["32", "4^2", "2^3 + 2^2", "-2^5", "2^-5", "2^5 o 2^6", "No es 2^5", "2^5=32", "2^5; 99"]) {
    assert.equal(gradePowerWritten(product, answer).score, answer === "32" ? 0.5 : 0, answer);
  }
  const simplify = questions.find(q => q.id === 6);
  assert.equal(gradePowerWritten(simplify, "8^2").score, 0.5);
  const subtraction = questions.find(q => q.id === 20);
  assert.equal(gradePowerWritten(subtraction, "0").score, 1);
  assert.equal(gradePowerWritten(subtraction, "1").score, 0);
  const zeroExponent = questions.find(q => q.id === 29);
  assert.equal(gradePowerWritten(zeroExponent, "7⁰").score, 1);
  assert.equal(gradePowerWritten(zeroExponent, "1").score, 0.5);
  assert.equal(gradePowerWritten(questions.find(q => q.id === 3), "2³").score, 1);
});

test("No confunde sumas/restas con productos/cocientes", () => {
  assert.equal(gradePowerWritten(questions.find(q => q.id === 11), "2^5").score, 0);
  assert.equal(gradePowerWritten(questions.find(q => q.id === 16), "2^2").score, 0);
  assert.equal(gradePowerWritten(questions.find(q => q.id === 12), "3^4").score, 0);
  assert.equal(gradePowerWritten(questions.find(q => q.id === 20), "6^0").score, 0);
});

test("El parser no evalúa código, operaciones, números inseguros ni formatos ajenos al nivel", () => {
  for (const text of ["", "alert(1)", "2**3", "2^100", "0^0", "0^2", "2^-2", "2^0.5", "999999999^12", "1e3", "Infinity", "NaN", "12 o 32", "2^3^2", "2^3 + 1", "2.5", "⁵", "2²³"]) {
    assert.equal(parseMathAnswer(text), null, text);
  }
  assert.deepEqual(parseMathAnswer("2¹⁰"), { base: 2, exponent: 10, value: 1024 });
  assert.deepEqual(parseMathAnswer("0"), { base: 0, exponent: undefined, value: 0 });
});

test("Los temas usan correctores distintos y rechazan nombres desconocidos", () => {
  assert.equal(getStudyTopic().subject, "historia");
  assert.equal(getStudyTopic("powers").gradeWritten, gradePowerWritten);
  for (const topic of ["invalid", ["history"], null, {}]) assert.throws(() => getStudyTopic(topic), /no válido/);
});
