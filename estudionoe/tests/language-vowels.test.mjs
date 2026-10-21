import test from "node:test";
import assert from "node:assert/strict";
import { shuffleVowelQuestions, vowelQuestions } from "../language-vowels.mjs";
import { readFileSync } from "node:fs";

test("Test ofrece veinte palabras y solo clasifica diptongo, triptongo o ninguno", () => {
  assert.equal(vowelQuestions.length, 20);
  assert.deepEqual(
    [...new Set(vowelQuestions.map(question => question.answer))].sort(),
    ["Diptongo", "Ninguno", "Triptongo"],
  );
  assert.equal(new Set(vowelQuestions.map(question => question.word)).size, vowelQuestions.length);
  assert.ok(vowelQuestions.every(question => question.explanation.length > 15));
});

test("El orden cambia respecto a la entrada anterior y conserva todas las preguntas", () => {
  const previousOrder = vowelQuestions.map(question => question.word);
  const shuffled = shuffleVowelQuestions(vowelQuestions, () => 0.999999, previousOrder);
  const shuffledWords = shuffled.map(question => question.word);

  assert.notDeepEqual(shuffledWords, previousOrder);
  assert.deepEqual([...shuffledWords].sort(), [...previousOrder].sort());
});

test("La página principal enlaza a un test separado", () => {
  const html = readFileSync(new URL("../aula/lengua-actual.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /id="vowel-quiz"/);
  assert.match(html, /<span class="pill">Herramienta de trabajo<\/span>[\s\S]*?<a class="primary" href="\.\/test-diptongos\.html">Hacer el test/);
  assert.equal((html.match(/class="language-study-card"/g) ?? []).length, 4);
});

test("El formulario autocorregible se encuentra en su propia página", () => {
  const html = readFileSync(new URL("../aula/test-diptongos.html", import.meta.url), "utf8");
  assert.match(html, /id="vowel-quiz"/);
  assert.match(html, /id="vowel-questions"/);
  assert.match(html, /src="\.\.\/language-vowels\.mjs"/);
});
