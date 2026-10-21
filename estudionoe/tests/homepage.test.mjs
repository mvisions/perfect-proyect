import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("La portada solo anuncia Lengua y conserva el enlace al control", () => {
  const html = readFileSync(new URL("../aula/index.html", import.meta.url), "utf8");
  assert.match(html, /class="exam-alert exam-alert-compact exam-alert-language" aria-labelledby="language-exam-alert-title"/);
  assert.match(html, /class="exam-announcements"/);
  assert.equal((html.match(/class="exam-alert-kicker">¡PRÓXIMO EXAMEN!/g) ?? []).length, 1);
  assert.doesNotMatch(html, /english-exam-alert-title|INGLÉS ACTUALIZADO/);
  assert.match(html, /href="\.\/lengua-actual\.html">Preparar control de Lengua/);
});
