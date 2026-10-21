export function formatEnglishResultSummary(correct, total) {
  const mistakes = total - correct;
  const correctLabel = correct === 1 ? "acierto" : "aciertos";
  const mistakeLabel = mistakes === 1 ? "respuesta" : "respuestas";
  return `${correct} ${correctLabel} de ${total}; ${mistakes} ${mistakeLabel} para repasar.`;
}
