import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createExamService, createMemoryStore, createFirestoreStore } from "../exam-service.mjs";
import { createApi } from "../server.mjs";
import { questions, matchingPairs } from "../powers-questions.mjs";
import { questions as historyQuestions } from "../questions.mjs";

const profile = { name: "Potencias", course: "Inicial", mode: "easy", topic: "powers", consent: true };
const answersFor = mode => Object.fromEntries((mode === "matching" ? matchingPairs : questions)
  .map(item => [item.id, mode === "matching" ? item.id : item.answer]));

test("Los tres modos de potencias reciben 10 y se separan de Historia", async () => {
  const service = createExamService(createMemoryStore());
  const history = await service.start({ ...profile, topic: "history" });
  await service.finish(history.id, history.token, Object.fromEntries(historyQuestions.map(q => [q.id, q.answer])));
  for (const mode of ["easy", "written", "matching"]) {
    const exam = await service.start({ ...profile, mode });
    assert.equal(exam.topic, "powers");
    assert.equal(exam.ids.length, mode === "matching" ? 20 : 30);
    const result = await service.finish(exam.id, exam.token, answersFor(mode));
    assert.equal(result.grade, 10);
    assert.equal(result.topic, "powers");
    assert.equal((await service.ranking(mode, "powers")).length, 1);
    assert.equal((await service.ranking(mode, "powers"))[0].id, exam.id);
  }
  assert.equal((await service.ranking("easy")).length, 1);
  assert.equal((await service.ranking("easy"))[0].id, history.id);
});

test("La API recalcula la nota escrita, admite parciales y rechaza repasos y temas inválidos", async () => {
  const service = createExamService(createMemoryStore());
  const input = {
    ...profile, mode: "written", id: randomUUID(), token: "b".repeat(64),
    startedAt: Date.now() - 5000, finishedAt: Date.now(), grade: 10,
    ids: questions.map(q => q.id), answers: { 21: "32", 11: "2^5" },
  };
  const result = await service.submit(input);
  assert.equal(result.points, 0.5);
  assert.equal(result.grade, 0.2);
  assert.equal(result.topic, "powers");
  await assert.rejects(service.submit({ ...input, ids: [21] }), { status: 400 });
  for (const topic of ["unknown", null, ["history"], {}]) {
    await assert.rejects(service.start({ ...profile, topic }), { status: 400 });
    await assert.rejects(service.submit({ ...input, topic }), { status: 400 });
    await assert.rejects(service.ranking("easy", topic), { status: 400 });
  }
});

test("HTTP: entrega automática, ranking por tema y retirada de Matemáticas sin afectar a Historia", async t => {
  const server = createApi(createExamService(createMemoryStore()), { origins: [], development: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const input = {
    ...profile, id: randomUUID(), token: "c".repeat(64), startedAt: Date.now() - 1000, finishedAt: Date.now(),
    ids: questions.map(q => q.id), answers: answersFor("easy"),
  };
  const response = await fetch(`${base}/api/results`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).grade, 10);
  const ranked = await (await fetch(`${base}/api/ranking?mode=easy&topic=powers`)).json();
  assert.equal(ranked.topic, "powers");
  assert.equal(ranked.entries[0].id, input.id);
  assert.equal((await (await fetch(`${base}/api/ranking?mode=easy`)).json()).entries.length, 0);
  assert.equal((await fetch(`${base}/api/ranking?mode=easy&topic=unknown`)).status, 400);
  const removed = await fetch(`${base}/api/exams/${input.id}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: input.token }),
  });
  assert.equal(removed.status, 200);
  assert.equal((await (await fetch(`${base}/api/ranking?mode=easy&topic=powers`)).json()).entries.length, 0);
});

test("Los resultados antiguos sin tema siguen siendo de Historia y el límite es por tema", async () => {
  const store = createMemoryStore();
  for (let i = 0; i < 60; i++) {
    await store.create({ id: `history-${i}`, mode: "easy", summary: { grade: 10 }, durationMs: i, finishedAt: i, ids: [] });
    await store.create({ id: `powers-${i}`, topic: "powers", mode: "easy", summary: { grade: 9 }, durationMs: i, finishedAt: i, ids: [] });
  }
  assert.equal((await store.ranking("easy")).length, 50);
  assert.equal((await store.ranking("easy", "powers")).length, 50);
  assert.ok((await store.ranking("easy")).every(item => item.id.startsWith("history")));
  const exams = [...await store.ranking("easy"), ...await store.ranking("easy", "powers")];
  const query = {
    where() { return this; }, orderBy() { return this; },
    async get() { return { docs: exams.map(exam => ({ data: () => exam })) }; },
  };
  const firestore = createFirestoreStore({ collection: () => query });
  assert.equal((await firestore.ranking("easy", "powers")).length, 50);
  assert.ok((await firestore.ranking("easy")).every(item => item.id.startsWith("history")));
});
