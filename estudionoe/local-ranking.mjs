import { isRankingProfile } from "./ranking-profile.mjs";

export const rankingKey = "noe-local-ranking-v1";

export function readRanking(storage, key = rankingKey) {
  const entries = JSON.parse(storage.getItem(key) ?? "[]");
  return validateEntries(entries);
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.some(entry =>
    !entry || typeof entry.id !== "string" || !isRankingProfile(entry)
    || !["easy", "matching", "written"].includes(entry.mode)
    || !Number.isFinite(entry.grade) || entry.grade < 0 || entry.grade > 10
    || !Number.isFinite(entry.durationMs) || entry.durationMs < 0
    || !Number.isFinite(entry.finishedAt))) throw new Error("El ranking guardado no es válido.");
  return entries;
}

export function exportRanking(storage) {
  return JSON.stringify({ format: "noe-ranking", version: 1, entries: readRanking(storage) }, null, 2);
}

export function importRanking(storage, contents) {
  const backup = JSON.parse(contents);
  if (!backup || backup.format !== "noe-ranking" || backup.version !== 1)
    throw new Error("Selecciona una copia exportada desde esta web.");
  const imported = validateEntries(backup.entries);
  const entries = readRanking(storage);
  const ids = new Set(entries.map(entry => entry.id));
  let added = 0;
  for (const entry of imported) {
    if (!ids.has(entry.id)) { entries.push(entry); ids.add(entry.id); added++; }
  }
  const retained = ["easy", "matching", "written"].flatMap(mode => sortedRanking(entries, mode));
  storage.setItem(rankingKey, JSON.stringify(retained));
  return { added, retained: retained.length };
}

export function sortedRanking(entries, mode) {
  return entries.filter(entry => entry.mode === mode)
    .sort((a, b) => b.grade - a.grade || a.durationMs - b.durationMs || a.finishedAt - b.finishedAt)
    .slice(0, 50);
}

export function saveResult(storage, entry, key = rankingKey) {
  validateEntries([entry]);
  const entries = readRanking(storage, key);
  if (!entries.some(item => item.id === entry.id)) {
    entries.push(entry);
    const retained = ["easy", "matching", "written"].flatMap(mode => sortedRanking(entries, mode));
    storage.setItem(key, JSON.stringify(retained));
  }
}
