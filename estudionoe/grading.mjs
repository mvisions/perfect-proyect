export function normalize(text) {
  return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function oneTypo(a, b) {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function containsTerm(answer, term) {
  const needle = normalize(term).split(" ");
  const words = answer.split(" ");
  return words.some((_, start) => needle.every((word, offset) => {
    const actual = words[start + offset];
    if (!actual) return false;
    // Raíces largas permiten "cultivar"/"cultivadas", sin confundir fechas ni siglos.
    return actual === word || (word.length >= 5 && actual.startsWith(word)) || oneTypo(actual, word);
  }));
}

export function gradeWritten(question, response) {
  const answer = normalize(response);
  if (!answer) return { score: 0, status: "mal", matched: [], missing: question.concepts.map(c => c.label), reason: "No has escrito una respuesta." };
  const matched = [], missing = [];
  for (const item of question.concepts) {
    const present = item.terms.some(term => Array.isArray(term)
      ? term.every(part => containsTerm(answer, part))
      : containsTerm(answer, term));
    (present ? matched : missing).push(item.label);
  }
  // Negaciones y alternativas ambiguas no se califican como totalmente correctas.
  const uncertain = /\b(no|nunca|jamas|tampoco)\b/.test(answer) && question.id !== 18;
  const alternatives = /\b(o|quizas|quiza|tal vez)\b/.test(answer);
  const ratio = matched.length / question.concepts.length;
  const score = ratio === 1 && !uncertain && !alternatives ? 1 : ratio >= 0.5 ? 0.5 : 0;
  const reason = uncertain || alternatives
    ? "Hay negaciones o alternativas que impiden confirmar una respuesta completa. Compárala con el modelo."
    : missing.length ? "Faltan o no se han reconocido algunas ideas clave de los apuntes."
      : "Has incluido todas las ideas clave.";
  return { score, status: score === 1 ? "bien" : score === 0.5 ? "regular" : "mal", matched, missing, reason };
}

export function gradeChoice(question, answer) {
  const correct = answer === question.answer;
  return { score: correct ? 1 : 0, status: correct ? "bien" : "mal", reason: correct
    ? "La respuesta coincide con los apuntes."
    : answer ? `La opción elegida no responde correctamente a «${question.title}». La respuesta de los apuntes es: ${question.answer}`
      : "Has dejado esta pregunta sin responder." };
}

export function summarize(results) {
  const points = results.reduce((total, result) => total + result.score, 0);
  return {
    points,
    grade: results.length ? Math.round(points / results.length * 100) / 10 : 0,
    correct: results.filter(result => result.score === 1).length,
    partial: results.filter(result => result.score === 0.5).length,
    wrong: results.filter(result => result.score === 0).length,
  };
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
