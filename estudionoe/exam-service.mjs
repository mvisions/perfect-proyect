import { createHash, randomBytes, randomUUID } from "node:crypto";
import { shuffle, summarize } from "./grading.mjs";
import { getStudyTopic, studyTopics } from "./study-topics.mjs";

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const hash = value => createHash("sha256").update(value).digest("hex");
const validModes = ["easy", "matching", "written"];
const validTopic = topic => topic === undefined || (typeof topic === "string" && Object.hasOwn(studyTopics, topic));
export const getBank = (mode, topic = "history") => {
  const study = getStudyTopic(topic);
  return mode === "matching" ? study.matchingPairs : study.questions;
};
const text = (value, max) => typeof value === "string" && value.trim().length > 0
  && value.trim().length <= max && !/[\u0000-\u001f\u007f<>]/.test(value);
const publicFields = exam => ({
  id: exam.id, name: exam.name, course: exam.course, mode: exam.mode, topic: exam.topic ?? "history",
  grade: exam.summary.grade, points: exam.summary.points,
  total: exam.ids.length, durationMs: exam.durationMs, finishedAt: exam.finishedAt,
});

export function createExamService(store, now = Date.now) {
  return {
    async submit(input) {
      if (!input || !validTopic(input.topic) || !validModes.includes(input.mode) || !text(input.name, 40) || !text(input.course, 30) || input.consent !== true
        || typeof input.id !== "string" || !/^[a-f0-9-]{36}$/.test(input.id)
        || typeof input.token !== "string" || !/^[a-f0-9]{64}$/.test(input.token)
        || !Number.isFinite(input.startedAt) || !Number.isFinite(input.finishedAt) || input.startedAt < 0
        || input.startedAt > input.finishedAt || input.finishedAt > now() + 60000
        || input.finishedAt - input.startedAt > 86400000)
        throw new HttpError(400, "El resultado no tiene un formato válido.");
      const topic = input.topic ?? "history";
      const expected = getBank(input.mode, topic).map(item => item.id);
      if (!Array.isArray(input.ids) || input.ids.length !== expected.length || new Set(input.ids).size !== expected.length
        || input.ids.some(id => !expected.includes(id))) throw new HttpError(400, "Solo los exámenes completos participan en el ranking.");
      await store.create({
        id: input.id, name: input.name.trim(), course: input.course.trim(), mode: input.mode, topic,
        tokenHash: hash(input.token), startedAt: input.startedAt, ids: input.ids,
      });
      // El tiempo de esta clasificación de práctica se mide en el navegador.
      return createExamService(store, () => input.finishedAt).finish(input.id, input.token, input.answers);
    },
    async start(input) {
      if (!input || !validTopic(input.topic) || !validModes.includes(input.mode) || !text(input.name, 40) || !text(input.course, 30) || input.consent !== true)
        throw new HttpError(400, "Indica nombre o alias, curso y acepta publicar el resultado.");
      const token = randomBytes(32).toString("hex");
      const topic = input.topic ?? "history";
      const exam = {
        id: randomUUID(), mode: input.mode, topic, name: input.name.trim(), course: input.course.trim(),
        tokenHash: hash(token), startedAt: now(), ids: shuffle(getBank(input.mode, topic)).map(item => item.id),
      };
      await store.create(exam);
      return { id: exam.id, topic, token, startedAt: exam.startedAt, ids: exam.ids };
    },
    async finish(id, token, answers) {
      if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id) || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        throw new HttpError(400, "Identificador de examen no válido.");
      return store.update(id, exam => {
        if (!exam || exam.tokenHash !== hash(token)) throw new HttpError(404, "No se encuentra este examen.");
        if (exam.finishedAt !== undefined) return { exam, response: publicFields(exam) };
        if (now() - exam.startedAt > 24 * 60 * 60 * 1000) throw new HttpError(410, "El examen ha caducado. Comienza otro para entrar en el ranking.");
        if (!answers || typeof answers !== "object" || Array.isArray(answers)
          || Object.keys(answers).some(id => !exam.ids.some(itemId => String(itemId) === id))
          || Object.values(answers).some(answer => typeof answer !== "string" || answer.length > 4000))
          throw new HttpError(400, "Las respuestas no tienen un formato válido.");
        const study = getStudyTopic(exam.topic ?? "history");
        const grades = exam.ids.map(id => {
          const item = getBank(exam.mode, exam.topic ?? "history").find(item => item.id === id);
          const answer = answers[id] ?? "";
          if (exam.mode === "written") return study.gradeWritten(item, answer);
          if (exam.mode === "easy") {
            if (answer && ![item.answer, ...item.wrong].includes(answer)) throw new HttpError(400, "Hay una opción no válida.");
            return study.gradeChoice(item, answer);
          }
          if (answer) {
            const left = exam.ids.indexOf(id), right = exam.ids.indexOf(answer);
            if (right < 0 || Math.floor(left / 5) !== Math.floor(right / 5)) throw new HttpError(400, "Hay una unión fuera de su bloque.");
          }
          const target = study.matchingPairs.find(pair => pair.id === answer);
          return study.gradeChoice(item, target?.answer ?? "");
        });
        if (exam.mode === "matching" && new Set(Object.values(answers).filter(Boolean)).size !== Object.values(answers).filter(Boolean).length)
          throw new HttpError(400, "Una respuesta no puede unirse dos veces.");
        const finishedAt = now();
        const completed = { ...exam, finishedAt, durationMs: Math.max(0, finishedAt - exam.startedAt), summary: summarize(grades) };
        return { exam: completed, response: publicFields(completed) };
      });
    },
    async ranking(mode, topic = "history") {
      if (!validModes.includes(mode) || !validTopic(topic)) throw new HttpError(400, "Modo o tema de examen no válido.");
      return (await store.ranking(mode, topic)).map(publicFields);
    },
    async remove(id, token) {
      if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id) || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        throw new HttpError(400, "Identificador no válido.");
      await store.remove(id, hash(token));
    },
  };
}

export function createMemoryStore() {
  const exams = new Map();
  return {
    async create(exam) { if (!exams.has(exam.id)) exams.set(exam.id, exam); },
    async update(id, change) {
      const result = change(exams.get(id));
      exams.set(id, result.exam);
      return result.response;
    },
    async ranking(mode, topic = "history") {
      return [...exams.values()].filter(exam => exam.mode === mode && (exam.topic ?? "history") === topic && exam.finishedAt !== undefined)
        .sort((a, b) => b.summary.grade - a.summary.grade || a.durationMs - b.durationMs || a.finishedAt - b.finishedAt).slice(0, 50);
    },
    async remove(id, tokenHash) {
      const exam = exams.get(id);
      if (exam && exam.tokenHash !== tokenHash) throw new HttpError(404, "No se encuentra este examen.");
      exams.delete(id);
    },
  };
}

export function createFirestoreStore(database) {
  const collection = database.collection("estudionoeExams");
  return {
    async create(exam) { await collection.doc(exam.id).create(exam); },
    async update(id, change) {
      return database.runTransaction(async transaction => {
        const ref = collection.doc(id);
        const snapshot = await transaction.get(ref);
        const result = change(snapshot.exists ? snapshot.data() : undefined);
        transaction.set(ref, result.exam);
        return result.response;
      });
    },
    async ranking(mode, topic = "history") {
      const snapshot = await collection.where("mode", "==", mode).orderBy("summary.grade", "desc")
        .orderBy("durationMs", "asc").orderBy("finishedAt", "asc").get();
      return snapshot.docs.map(doc => doc.data()).filter(exam => (exam.topic ?? "history") === topic).slice(0, 50);
    },
    async remove(id, tokenHash) {
      await database.runTransaction(async transaction => {
        const ref = collection.doc(id);
        const snapshot = await transaction.get(ref);
        if (snapshot.exists && snapshot.data().tokenHash !== tokenHash) throw new HttpError(404, "No se encuentra este examen.");
        transaction.delete(ref);
      });
    },
  };
}
