const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";

export function parseMathAnswer(response) {
  const text = String(response).trim()
    .replace(/([1-9]\d*)\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/u, (_, base, exponent) =>
      `${base}^${[...exponent].map(digit => superscripts.indexOf(digit)).join("")}`);
  const match = text.match(/^(\d{1,9})(?:\s*\^\s*(\d{1,2}))?$/);
  if (!match) return null;
  const base = Number(match[1]);
  const exponent = match[2] === undefined ? undefined : Number(match[2]);
  if (exponent !== undefined && (base === 0 || exponent > 12)) return null;
  const value = exponent === undefined ? base : base ** exponent;
  if (!Number.isSafeInteger(value)) return null;
  return { base, exponent, value };
}

export function gradePowerWritten(question, response) {
  const parsed = parseMathAnswer(response);
  const expected = question.solution;
  const value = expected.kind === "power" ? expected.base ** expected.exponent : expected.value;
  let score = 0;
  let reason;
  if (!String(response).trim()) reason = "No has escrito una respuesta.";
  else if (!parsed) reason = "Escribe solo un número o una potencia como 2^3 o 2³, sin operaciones pendientes ni varias respuestas.";
  else if (parsed.value !== value) reason = "El resultado no es correcto. Revisa la regla y los pasos de la solución.";
  else if (expected.kind === "power" && (parsed.base !== expected.base || parsed.exponent !== expected.exponent)) {
    score = 0.5;
    reason = `El valor es correcto, pero se pide una sola potencia de base ${expected.base}. La forma simplificada es ${question.answer}.`;
  } else {
    score = 1;
    reason = "El resultado y la forma de la respuesta son correctos.";
  }
  return { score, status: score === 1 ? "bien" : score === 0.5 ? "regular" : "mal", reason };
}

export function gradePowerChoice(question, response) {
  const correct = response === question.answer;
  return { score: correct ? 1 : 0, status: correct ? "bien" : "mal", reason: correct
    ? "Has elegido la respuesta correcta."
    : response ? `La respuesta correcta es ${question.answer}.`
      : "Has dejado esta pregunta sin responder." };
}
