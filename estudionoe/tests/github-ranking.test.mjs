import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubRankingStore, parseLog } from "../github-ranking-store.mjs";
import { createExamService } from "../exam-service.mjs";
import { questions, matchingPairs } from "../questions.mjs";
import { questions as powerQuestions, matchingPairs as powerPairs } from "../powers-questions.mjs";
import { randomUUID } from "node:crypto";

function mockGitHub() {
  let text = "", version = 1, conflicts = 0;
  return {
    get text() { return text; },
    set conflicts(value) { conflicts = value; },
    fetcher: async (_url, options) => {
      if (!options.method) return new Response(JSON.stringify({ encoding: "base64", content: Buffer.from(text).toString("base64"), sha: String(version) }));
      const input = JSON.parse(options.body);
      if (conflicts-- > 0 || input.sha !== String(version)) return new Response("{}", { status: 409 });
      text = Buffer.from(input.content, "base64").toString("utf8");
      version++;
      return new Response("{}");
    },
  };
}

test("Guarda en TXT, interpreta el log, evita duplicados y persiste tras reiniciar", async () => {
  const mock = mockGitHub();
  const options = { token: "test-not-a-real-token", repository: "owner/repo", fetcher: mock.fetcher };
  const payload = {
    id: randomUUID(), token: "a".repeat(64), name: "Alias", course: "5 A", mode: "easy", consent: true,
    startedAt: Date.now() - 172860000, finishedAt: Date.now() - 172800000,
    ids: questions.map(q => q.id), answers: Object.fromEntries(questions.map(q => [q.id, q.answer])),
  };
  const service = createExamService(createGitHubRankingStore(options));
  mock.conflicts = 1;
  const first = await service.submit(payload);
  assert.equal(first.grade, 10);
  assert.equal(parseLog(mock.text).size, 1);
  assert.ok(!mock.text.includes(payload.token));
  assert.ok(!mock.text.includes(questions[0].answer));
  const restarted = createExamService(createGitHubRankingStore(options));
  assert.deepEqual(await restarted.submit(payload), first);
  assert.equal(mock.text.trim().split("\n").length, 1);
  assert.equal((await restarted.ranking("easy"))[0].name, "Alias");
  await assert.rejects(restarted.remove(payload.id, "b".repeat(64)), { status: 404 });
  await restarted.remove(payload.id, payload.token);
  assert.equal((await restarted.ranking("easy")).length, 0);
  assert.equal(mock.text.trim().split("\n").length, 2);
});

test("Rechaza repasos, notas inventadas y contenido inválido", async () => {
  const mock = mockGitHub();
  const service = createExamService(createGitHubRankingStore({ token: "test", repository: "a/b", fetcher: mock.fetcher }));
  await assert.rejects(service.submit({ grade: 10 }), { status: 400 });
  assert.throws(() => parseLog('{"type":"result","id":"x"}'), /inválido/);
  const failing = createGitHubRankingStore({ token: "test", repository: "a/b", fetcher: async () => new Response("{}", { status: 403 }) });
  await assert.rejects(failing.ranking("easy"), /403/);
});

test("Entregas completas automáticas de los tres modos y conflictos concurrentes", async () => {
  const mock = mockGitHub();
  const service = createExamService(createGitHubRankingStore({ token: "test", repository: "a/b", fetcher: mock.fetcher }));
  const payloads = ["easy", "written", "matching"].map(mode => {
    const bank = mode === "matching" ? matchingPairs : questions;
    return {
      id: randomUUID(), token: "d".repeat(64), name: mode, course: "Prueba", mode, consent: true,
      startedAt: Date.now() - 1000, finishedAt: Date.now(), grade: 0,
      ids: bank.map(q => q.id), answers: Object.fromEntries(bank.map(q => [q.id, mode === "matching" ? q.id : q.answer])),
    };
  });

  for (const payload of payloads) {
    await assert.rejects(service.submit({ ...payload, consent: false }), { status: 400 });
    await assert.rejects(service.submit({ ...payload, ids: payload.ids.slice(1) }), { status: 400 });
    await assert.rejects(service.submit({ ...payload, finishedAt: payload.startedAt - 1 }), { status: 400 });
  }
  const results = await Promise.all(payloads.map(payload => service.submit(payload)));
  assert.deepEqual(results.map(result => result.grade), [10, 10, 10]);
  assert.equal(parseLog(mock.text).size, 3);
});

test("El log conserva rankings por tema, resultados históricos y potencias tras reiniciar", async () => {
  const mock = mockGitHub();
  const options = { token: "test", repository: "a/b", fetcher: mock.fetcher };
  let service = createExamService(createGitHubRankingStore(options));
  const history = await service.start({ name: "Historia", course: "Prueba", mode: "easy", consent: true });
  await service.finish(history.id, history.token, Object.fromEntries(questions.map(q => [q.id, q.answer])));
  for (const mode of ["easy", "written", "matching"]) {
    const bank = mode === "matching" ? powerPairs : powerQuestions;
    const result = await service.submit({
      id: randomUUID(), token: "e".repeat(64), name: "Potencias", course: "Inicial", mode, topic: "powers", consent: true,
      startedAt: Date.now() - 1000, finishedAt: Date.now(), ids: bank.map(q => q.id),
      answers: Object.fromEntries(bank.map(q => [q.id, mode === "matching" ? q.id : q.answer])),
    });
    assert.equal(result.grade, 10);
  }
  service = createExamService(createGitHubRankingStore(options));
  assert.equal((await service.ranking("easy"))[0].name, "Historia");
  for (const mode of ["easy", "written", "matching"]) {
    const ranked = await service.ranking(mode, "powers");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].topic, "powers");
  }
  await service.remove(history.id, history.token);
  assert.equal((await service.ranking("easy")).length, 0);
  assert.equal((await service.ranking("easy", "powers")).length, 1);
  const legacy = { id: "legacy", mode: "easy", tokenHash: "hash", ids: [1], summary: { grade: 10 }, finishedAt: 1, durationMs: 100 };
  assert.equal(parseLog(JSON.stringify({ type: "result", id: "legacy", exam: legacy })).get("legacy").topic, undefined);
});
