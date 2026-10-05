import assert from "node:assert/strict";
import test from "node:test";
import { decryptDriveBackup, encryptDriveBackup } from "./drive-encryption.mjs";

test("double encryption round-trips a Drive backup without exposing its contents", async () => {
  const backup = { version: 3, routes: { "limasam-2026-9": { 12: { destination: "Centro de trabajo" } } } };
  const encrypted = await encryptDriveBackup(backup);
  const serialized = JSON.stringify(encrypted);

  assert.equal(encrypted.format, "memoria-laboral-drive-v1");
  assert.equal(encrypted.ivs.length, 2);
  assert.equal(serialized.includes("Centro de trabajo"), false);
  assert.deepEqual(await decryptDriveBackup(serialized, true), backup);
});

test("rejects a modified encrypted backup", async () => {
  const encrypted = await encryptDriveBackup({ routes: { 1: { destination: "Ruta" } } });
  const changedData = `${encrypted.data[0] === "A" ? "B" : "A"}${encrypted.data.slice(1)}`;

  await assert.rejects(decryptDriveBackup(JSON.stringify({ ...encrypted, data: changedData }), true));
});

test("allows legacy JSON only during the migration path", async () => {
  const legacyBackup = { version: 3, routes: {} };

  assert.deepEqual(await decryptDriveBackup(JSON.stringify(legacyBackup)), legacyBackup);
  await assert.rejects(decryptDriveBackup(JSON.stringify(legacyBackup), true));
});