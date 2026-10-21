export const dictation = {
  id: "biblioteca-v1",
  title: "Una aventura en la biblioteca",
  level: "5.º de Primaria · 10 años",
  chunks: [
    { text: "El sábado por la mañana,", spoken: "El sábado por la mañana, coma." },
    { text: "Hugo y su hermana visitaron la biblioteca del barrio.", spoken: "Hugo y su hermana visitaron la biblioteca del barrio. Punto y seguido." },
    { text: "La bibliotecaria les mostró un libro de aventuras", spoken: "La bibliotecaria les mostró un libro de aventuras" },
    { text: "sobre un pequeño dragón que vivía junto al río.", spoken: "sobre un pequeño dragón que vivía junto al río. Punto y seguido." },
    { text: "Aunque parecía peligroso,", spoken: "Aunque parecía peligroso, coma." },
    { text: "el dragón era amable y ayudaba a sus vecinos.", spoken: "el dragón era amable y ayudaba a sus vecinos. Punto y seguido." },
    { text: "Después de leer,", spoken: "Después de leer, coma." },
    { text: "los niños dibujaron su escena favorita", spoken: "los niños dibujaron su escena favorita" },
    { text: "y escribieron una breve descripción.", spoken: "y escribieron una breve descripción. Punto y seguido." },
    { text: "Al volver a casa,", spoken: "Al volver a casa, coma." },
    { text: "Hugo guardó el dibujo en una carpeta", spoken: "Hugo guardó el dibujo en una carpeta" },
    { text: "para enseñárselo a su profesora el lunes.", spoken: "para enseñárselo a su profesora el lunes. Punto final." },
  ],
  tips: [
    "Las palabras agudas llevan tilde cuando terminan en vocal, n o s: dragón, descripción y guardó.",
    "Las esdrújulas siempre llevan tilde: sábado.",
    "Río lleva tilde para separar sus dos vocales en sílabas: rí-o.",
    "Los verbos en pasado terminados en -aba se escriben con b: ayudaba.",
    "Los nombres propios y el comienzo de una oración llevan mayúscula: Hugo y El.",
    "Practica la h de Hugo y hermana, la v de aventuras y vecinos, y la b de biblioteca y breve.",
  ],
};

export const dictationText = dictation.chunks.map(chunk => chunk.text).join(" ");
dictation.chunks.forEach((chunk, index) => {
  chunk.audio = new URL(`./audio/biblioteca/${String(index + 1).padStart(2, "0")}.wav?v=3`, import.meta.url).href;
});
