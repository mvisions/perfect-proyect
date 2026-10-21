export const classroomVocabulary = [
  { english: "scissors", spanish: "tijeras" },
  { english: "desk", spanish: "pupitre" },
  { english: "calculator", spanish: "calculadora" },
  { english: "folder", spanish: "carpeta" },
  { english: "notebook", spanish: "cuaderno" },
  { english: "board", spanish: "pizarra" },
  { english: "diary", spanish: "agenda" },
  { english: "bin", spanish: "papelera" },
  { english: "dictionary", spanish: "diccionario" },
  { english: "sharpener", spanish: "sacapuntas" },
];

export const classroomPhrases = [
  { english: "Can you speak more slowly?", spanish: "¿Puedes hablar más despacio?" },
  { english: "How do you spell calculator?", spanish: "¿Cómo se escribe «calculator»?" },
  { english: "Can I borrow a sharpener?", spanish: "¿Puedo pedir prestado un sacapuntas?" },
  { english: "Can I go to the toilet?", spanish: "¿Puedo ir al baño?" },
  { english: "Sorry, I'm late.", spanish: "Perdona, llego tarde." },
  { english: "Don't forget to say please!", spanish: "¡No olvides decir «please»!" },
];

export const classroomPractice = [
  ...classroomVocabulary.map(({ english, spanish }) => ({
    id: `classroom-word-${english}`,
    display: `Traduce al inglés: ${spanish}`,
    answer: english,
  })),
  ...classroomPhrases.map(({ english, spanish }) => ({
    id: `classroom-phrase-${english}`,
    display: `Di en inglés: ${spanish}`,
    answer: english,
  })),
];
