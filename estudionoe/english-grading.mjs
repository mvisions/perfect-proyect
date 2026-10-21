const normalize = text => text.normalize("NFKC")
  .replace(/[‘’]/gu, "'")
  .trim().replace(/[.!?]+$/u, "")
  .trim().toLowerCase().replace(/\s+/gu, " ");

export function gradeEnglishAnswer(expected, answer) {
  if (typeof expected !== "string" || !expected.trim() || typeof answer !== "string") {
    throw new TypeError("La palabra y la respuesta deben ser textos válidos.");
  }
  return normalize(expected) === normalize(answer);
}
