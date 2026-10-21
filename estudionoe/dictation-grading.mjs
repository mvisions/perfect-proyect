export function tokenizeDictation(text) {
  return Array.from(text.normalize("NFC").matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu),
    match => ({ text: match[0], word: /^[\p{L}\p{N}]/u.test(match[0]), start: match.index, end: match.index + match[0].length }));
}

const withoutAcute = text => text.normalize("NFD").replace(/\u0301/g, "").normalize("NFC");

function replacementKind(expected, actual) {
  if (!expected.word && !actual.word) return "punctuation";
  if (expected.text.toLocaleLowerCase("es") === actual.text.toLocaleLowerCase("es")) return "capitalization";
  if (withoutAcute(expected.text).toLocaleLowerCase("es") === withoutAcute(actual.text).toLocaleLowerCase("es")) return "accent";
  return "spelling";
}

export function gradeDictation(reference, response) {
  if (typeof reference !== "string" || typeof response !== "string") throw new Error("El dictado y la respuesta deben ser textos.");
  const expected = tokenizeDictation(reference);
  const actual = tokenizeDictation(response);
  if (!expected.length || !actual.length) throw new Error("Escribe tu dictado antes de corregir.");
  if (expected.length > 300 || actual.length > 300 || response.length > 4000) throw new Error("El texto es demasiado largo para este dictado. Usa como máximo 300 palabras y signos, y 4000 caracteres.");
  const costs = Array.from({ length: expected.length + 1 }, () => new Float64Array(actual.length + 1));
  const changes = Array.from({ length: expected.length + 1 }, () => new Uint8Array(actual.length + 1));
  for (let i = 1; i <= expected.length; i++) { costs[i][0] = i; changes[i][0] = 2; }
  for (let j = 1; j <= actual.length; j++) { costs[0][j] = j; changes[0][j] = 3; }
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= actual.length; j++) {
      const same = expected[i - 1].text === actual[j - 1].text;
      const replace = expected[i - 1].word === actual[j - 1].word ? 1 : 2.5;
      const candidates = [costs[i - 1][j - 1] + (same ? 0 : replace), costs[i - 1][j] + 1, costs[i][j - 1] + 1];
      const best = Math.min(...candidates);
      costs[i][j] = best;
      changes[i][j] = candidates.indexOf(best) + 1;
    }
  }
  const issues = [];
  let correctWords = 0;
  let i = expected.length, j = actual.length;
  while (i || j) {
    const change = changes[i][j];
    if (change === 1) {
      const left = expected[--i], right = actual[--j];
      if (left.text === right.text) { if (left.word) correctWords++; }
      else issues.push({ kind: replacementKind(left, right), expected: left.text, actual: right.text, expectedIndex: i, actualIndex: j });
    } else if (change === 2) {
      const left = expected[--i];
      issues.push({ kind: left.word ? "missing" : "punctuation", expected: left.text, actual: "", expectedIndex: i, actualIndex: j });
    } else {
      const right = actual[--j];
      issues.push({ kind: right.word ? "extra" : "punctuation", expected: "", actual: right.text, expectedIndex: i, actualIndex: j });
    }
  }
  const totalWords = expected.filter(token => token.word).length;
  return { issues: issues.reverse(), correctWords, totalWords, punctuationErrors: issues.filter(issue => issue.kind === "punctuation").length };
}
