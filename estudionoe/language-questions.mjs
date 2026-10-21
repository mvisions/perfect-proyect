const question = (category, title, answer, wrong, explanation) => ({ category, title, answer, wrong, explanation });
const yesSynonym = "Sí, son sinónimos.";
const notSynonym = "No, tienen significados diferentes.";
const yesAntonym = "Sí, son antónimos.";
const notAntonym = "No, son sinónimos.";
const unrelated = "No, son distintos, pero no opuestos.";

export const languageQuestions = [
  question("Sinónimos", "En «Lucía está alegre» y «Lucía está contenta», ¿alegre y contenta son sinónimos?", yesSynonym,
    ["No, son antónimos.", notSynonym], "Alegre y contenta expresan un estado parecido. Los sinónimos tienen significados iguales o semejantes en ese contexto."),
  question("Sinónimos", "En «El conejo salta» y «El conejo brinca», ¿salta y brinca son sinónimos?", yesSynonym,
    ["No, son antónimos.", notSynonym], "Saltar y brincar tienen un significado semejante: dar saltos."),
  question("Sinónimos", "En «Hay una mesa y una silla», ¿mesa y silla son sinónimos?", notSynonym,
    [yesSynonym, "No, son antónimos."], "Las dos son muebles, pero nombran objetos distintos. Pertenecer al mismo grupo no convierte dos palabras en sinónimos."),
  question("Sinónimos", "En «Primero caminamos y después dormimos», ¿caminar y dormir son sinónimos?", notSynonym,
    [yesSynonym, "No, son antónimos."], "Caminar es desplazarse a pie y dormir es descansar dormido. Son acciones distintas, no significados semejantes ni opuestos."),
  question("Antónimos", "En «Una caja es grande y la otra es pequeña», ¿grande y pequeña son antónimos?", yesAntonym,
    [notAntonym, unrelated], "Grande y pequeña expresan tamaños opuestos. Los antónimos tienen significados contrarios."),
  question("Antónimos", "En «Ana sube las escaleras y Luis las baja», ¿subir y bajar son antónimos?", yesAntonym,
    [notAntonym, unrelated], "Subir y bajar indican movimientos en sentidos opuestos."),
  question("Antónimos", "En «Voy a empezar» y «Voy a comenzar», ¿empezar y comenzar son antónimos?", notAntonym,
    [yesAntonym, unrelated], "Empezar y comenzar tienen significados semejantes: son sinónimos, no antónimos."),
  question("Antónimos", "En «El lápiz está junto al cuaderno», ¿lápiz y cuaderno son antónimos?", unrelated,
    [yesAntonym, notAntonym], "Son objetos diferentes, pero no significan lo contrario. No todas las palabras distintas son antónimos."),
  question("Mayúsculas", "¿Qué oración usa bien las mayúsculas?", "Mi amiga Paula vive en Sevilla.",
    ["mi amiga Paula vive en Sevilla.", "Mi amiga paula vive en sevilla."], "La primera palabra de la oración y los nombres propios Paula y Sevilla empiezan con mayúscula."),
  question("Mayúsculas", "¿Qué oración está escrita correctamente?", "El lunes iremos al parque.",
    ["El Lunes iremos al parque.", "el lunes iremos al parque."], "El comienza la oración con mayúscula. Los días de la semana, como lunes, se escriben con minúscula."),
  question("Mayúsculas", "¿Cómo se escribe este texto después de un punto?", "Terminó la clase. Después fuimos al patio.",
    ["Terminó la clase. después fuimos al patio.", "Terminó la Clase. Después fuimos al Patio."], "Después de un punto se empieza con mayúscula. Clase y patio son nombres comunes y aquí no llevan mayúscula."),
  question("Mayúsculas", "¿Qué oración utiliza correctamente las mayúsculas?", "Mi cumpleaños es en octubre.",
    ["Mi cumpleaños es en Octubre.", "mi cumpleaños es en octubre."], "Los meses se escriben con minúscula, salvo si comienzan una oración. Mi sí lleva mayúscula porque es la primera palabra."),
  question("Literatura", "Lee: «Una niña encontró una llave y decidió buscar la puerta que abría». ¿Qué género cuenta esta historia?", "Narrativa.",
    ["Lírica.", "Teatro."], "La narrativa cuenta sucesos que les ocurren a personajes. Los cuentos y las novelas pertenecen a este género."),
  question("Literatura", "Lee estos versos: «Brilla la luna en el mar, / mi corazón quiere cantar». ¿A qué género pertenecen?", "Lírica.",
    ["Narrativa.", "Teatro."], "La lírica suele expresar sentimientos y emociones mediante poemas. Estos versos forman un ejemplo original de poema."),
  question("Literatura", "Lee: «ELENA: ¿Vienes conmigo? TOMÁS: ¡Claro! (Los dos salen del escenario)». ¿Qué género es?", "Teatro.",
    ["Lírica.", "Narrativa."], "El teatro se escribe para representarse. Aparecen las intervenciones de los personajes y las indicaciones de lo que hacen."),
  question("Literatura", "¿Cuál de estos ejemplos es una obra literaria?", "Un cuento imaginado sobre un bosque que habla.",
    ["Una lista de precios del supermercado.", "Las instrucciones de una lavadora."], "La literatura usa el lenguaje con una intención artística: puede crear historias, expresar emociones o imaginar mundos."),
  question("Tipos de palabras", "Pronuncia can-CIÓN. Según su sílaba tónica, ¿qué tipo de palabra es «canción»?", "Aguda.",
    ["Llana.", "Esdrújula."], "La sílaba tónica es la que suena con más fuerza. En canción es la última, por eso es aguda."),
  question("Tipos de palabras", "Pronuncia ÁR-bol. Según su sílaba tónica, ¿qué tipo de palabra es «árbol»?", "Llana.",
    ["Aguda.", "Esdrújula."], "En árbol la sílaba tónica es la penúltima. Las palabras con esa posición de la sílaba tónica son llanas."),
  question("Tipos de palabras", "Pronuncia MÚ-si-ca. Según su sílaba tónica, ¿qué tipo de palabra es «música»?", "Esdrújula.",
    ["Llana.", "Aguda."], "La sílaba tónica de música es la antepenúltima. Por eso es una palabra esdrújula."),
  question("Tipos de palabras", "Pronuncia re-LOJ. Aunque no lleva tilde, ¿qué tipo de palabra es «reloj»?", "Aguda.",
    ["Llana.", "Esdrújula."], "Reloj es aguda porque se acentúa en la última sílaba. No lleva tilde porque termina en j, no en vocal, n o s."),
  question("Reglas de acentuación", "¿Cómo se escribe correctamente el nombre de este vehículo?", "camión",
    ["camion", "cámion"], "Camión es aguda y termina en n. Las agudas llevan tilde si terminan en vocal, n o s."),
  question("Reglas de acentuación", "¿Cómo se escribe correctamente este objeto para escribir?", "lápiz",
    ["lapiz", "lapíz"], "Lápiz es llana y termina en z. Las llanas llevan tilde si NO terminan en vocal, n o s."),
  question("Reglas de acentuación", "¿Cómo se escribe correctamente el nombre de este animal?", "pájaro",
    ["pajaro", "pajáro"], "Pájaro es esdrújula. Todas las palabras esdrújulas llevan tilde."),
  question("Reglas de acentuación", "¿Qué explicación sobre la palabra «mesa» es correcta?", "Es llana y no lleva tilde porque termina en vocal.",
    ["Es aguda y siempre lleva tilde.", "Es esdrújula y no lleva tilde."], "ME-sa tiene la sílaba tónica en la penúltima. Las llanas acabadas en vocal, n o s no llevan tilde."),
  question("Determinantes", "En «Esta mochila es ligera», ¿qué tipo de determinante es «esta»?", "Demostrativo.",
    ["Posesivo.", "Numeral."], "Esta acompaña al sustantivo mochila e indica cercanía. Esta, esa y aquella son determinantes demostrativos."),
  question("Determinantes", "En «Mi hermano lee», ¿qué tipo de determinante es «mi»?", "Posesivo.",
    ["Demostrativo.", "Indefinido."], "Mi acompaña al sustantivo hermano e indica una relación de pertenencia. Mi, tu y su son posesivos."),
  question("Determinantes", "En «Tengo tres lápices», ¿qué tipo de determinante es «tres»?", "Numeral.",
    ["Indefinido.", "Posesivo."], "Tres acompaña a lápices e indica una cantidad exacta. Es un numeral cardinal."),
  question("Determinantes", "En «Algunos niños juegan», ¿qué tipo de determinante es «algunos»?", "Indefinido.",
    ["Numeral.", "Demostrativo."], "Algunos acompaña a niños e indica una cantidad imprecisa, no un número exacto. Es un indefinido."),
  question("Determinantes", "En «La niña canta», ¿qué tipo de determinante es «la»?", "Artículo determinado.",
    ["Posesivo.", "Demostrativo."], "La es un artículo determinado que acompaña al sustantivo niña. Los artículos también son determinantes."),
  question("Artículos", "¿Qué grupo contiene solo artículos determinados?", "el, la, los, las",
    ["un, una, unos, unas", "este, esa, aquellos"], "El, la, los y las son artículos determinados: presentan algo identificado. Un, una, unos y unas son indeterminados."),
  question("Artículos", "En «Una mariposa entró en el jardín», ¿qué tipo de artículo es «una»?", "Indeterminado.",
    ["Determinado.", "Demostrativo."], "Una presenta una mariposa sin identificarla previamente. Es un artículo indeterminado."),
  question("Artículos", "Elige los artículos correctos: «___ amigas trajeron ___ libro nuevo».", "Las / un",
    ["Los / una", "La / unos"], "Las concuerda en femenino plural con amigas. Un concuerda en masculino singular con libro."),
].map((item, index) => ({ ...item, id: index + 1 }));

export const languageGuide = [
  { title: "Tema 1 · Sinónimos y antónimos", text: "Los sinónimos tienen significados iguales o parecidos en un contexto: alegre y contento. Los antónimos tienen significados opuestos: entrar y salir. Mesa y silla no son ni sinónimos ni antónimos." },
  { title: "Tema 1 · Mayúsculas", text: "Se escriben al empezar una oración, después de un punto y en nombres propios: Paula, Sevilla. Los días y los meses se escriben normalmente con minúscula: lunes, octubre." },
  { title: "Tema 1 · Literatura", text: "La literatura emplea el lenguaje con intención artística. La narrativa cuenta historias (cuentos y novelas); la lírica expresa sentimientos (poemas); el teatro se escribe para representarse con personajes y diálogos." },
  { title: "Tema 2 · Acentuación", text: "Agudas: sílaba tónica al final; llevan tilde si terminan en vocal, n o s (camión). Llanas: sílaba tónica en la penúltima; llevan tilde si no terminan en vocal, n o s (lápiz). Esdrújulas: sílaba tónica en la antepenúltima; siempre llevan tilde (pájaro)." },
  { title: "Tema 2 · Determinantes", text: "Acompañan al sustantivo. Artículos: la casa; demostrativos: esta casa; posesivos: mi casa; numerales: tres casas o la primera casa; indefinidos: algunas casas. Indican información como identificación, distancia, pertenencia o cantidad." },
  { title: "Tema 2 · Artículos", text: "Determinados: el, la, los, las. Indeterminados: un, una, unos, unas. Concuerdan en género y número con el sustantivo: las amigas, un libro." },
];

export function gradeLanguageSelection(item, answer) {
  if (!item || !Array.isArray(item.wrong)) throw new Error("El ejercicio no es válido.");
  if (answer !== undefined && ![item.answer, ...item.wrong].includes(answer)) throw new Error("La respuesta elegida no pertenece a este ejercicio.");
  return { score: answer === item.answer ? 1 : 0, status: answer === item.answer ? "bien" : "mal" };
}
