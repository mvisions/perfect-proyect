import test from "node:test";
import assert from "node:assert/strict";
import { rankingKey, readRanking, saveResult, sortedRanking } from "../local-ranking.mjs";

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const entry = (id, grade, durationMs, mode = "easy") => ({ id, name: "Noé", course: "5 A", grade, durationMs, mode, finishedAt: 1000 });

test("Guarda, recupera y no duplica el mismo examen", () => {
  const store = storage();
  saveResult(store, entry("1", 8, 10000));
  saveResult(store, entry("1", 8, 10000));
  assert.equal(readRanking(store).length, 1);
  assert.equal(JSON.parse(store.getItem(rankingKey))[0].name, "Noé");
  store.removeItem(rankingKey);
  assert.deepEqual(readRanking(store), []);
});
test("Ordena por nota y tiempo, separa modos y conserva 50 por modo", () => {
  const store = storage();
  saveResult(store, entry("a", 10, 20000));
  saveResult(store, entry("b", 10, 10000));
  saveResult(store, entry("c", 9, 1000));
  saveResult(store, entry("d", 10, 500, "written"));
  assert.deepEqual(sortedRanking(readRanking(store), "easy").map(e => e.id), ["b", "a", "c"]);
  for (let i = 0; i < 60; i++) saveResult(store, entry(`x${i}`, 5, 1000 + i));
  assert.equal(sortedRanking(readRanking(store), "easy").length, 50);
  assert.equal(sortedRanking(readRanking(store), "written").length, 1);
});
test("Expone los errores de almacenamiento y datos inválidos", () => {
  assert.throws(() => saveResult({ getItem: () => null, setItem: () => { throw new Error("Sin espacio"); } }, entry("a", 5, 100)), /Sin espacio/);
  assert.throws(() => readRanking({ getItem: () => "{}" }), /no es válido/);
});

test("Matemáticas tiene su propia clave y borrarla no toca el ranking histórico", () => {
  const store = storage();
  const powersKey = "noe-powers-local-ranking-v1";
  saveResult(store, entry("history", 8, 1000));
  saveResult(store, entry("powers", 10, 500), powersKey);
  assert.deepEqual(readRanking(store).map(item => item.id), ["history"]);
  assert.deepEqual(readRanking(store, powersKey).map(item => item.id), ["powers"]);
  store.removeItem(powersKey);
  assert.equal(readRanking(store).length, 1);
  assert.equal(readRanking(store, powersKey).length, 0);
});
