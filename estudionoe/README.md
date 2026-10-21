# Noé · Test de historia

Web: https://mvisions.github.io/perfect-proyect/estudionoe/

## Portal de asignaturas

La nueva portada está en `aula/index.html`; una vez publicada, estará disponible
en https://mvisions.github.io/perfect-proyect/estudionoe/aula/.
Historia abre `aula/historia.html`, donde «La Edad Media · Estudio Noé» enlaza a
la web original. Matemáticas abre `aula/matematicas.html` con el tema Potencias.
Lengua abre `aula/lengua.html`, con dictado de voz y repaso de los temas 1 y 2
para 5.º de Primaria. Inglés abre `aula/ingles.html`, con guía y lista de
ordinales, reglas para escribir y decir fechas, meses, vocabulario escolar y
expresiones útiles del aula. Ofrece rondas aleatorias de ordinales, fechas y
vocabulario/expresiones, con nota sobre 10, soluciones y repaso de fallos.
No se distinguen mayúsculas ni espacios adicionales; la ortografía y el guion
en ordinales compuestos sí cuentan. Las respuestas vacías cuentan como fallo;
los ejercicios no se guardan al recargar o cerrar la página y no participan
en el ranking.

La web original conserva su dirección, exámenes, preferencias y ranking.
La portada es estática y reutiliza los estilos existentes. Matemáticas reutiliza
la aplicación de exámenes con un banco y un corrector propios. GitHub Actions
publica el portal y todos los módulos necesarios.
Las cuatro tarjetas de asignaturas aparecen en una fila en pantallas de
1000 px o más, en dos columnas en tablet y en una columna en móvil.
La portada muestra un anuncio compacto del próximo control de Lengua.

La portada incluye «Notas de la profesora» con los avisos del martes 20.
El módulo `teacher-notes.mjs` genera una franja horizontal continua a partir
de las notas escritas en `aula/index.html`: para cambiarlas, edita esa lista.
Se puede pausar con el botón, al pasar el puntero o al enfocar sus controles.
«Leer todas las notas sin movimiento» permite consultar el texto completo.
Si se prefiere movimiento reducido, no se anima la franja y se muestran las
notas completas. Sin JavaScript, siguen disponibles en el desplegable.

Para añadir otro tema de Historia, incorpora una tarjeta en `aula/historia.html`
con su título, descripción y enlace, y actualiza el número de temas disponibles.
Para una nueva asignatura, crea su página en `aula/` y añade su tarjeta a la
portada.
Prueba la navegación localmente en http://localhost:8080/aula/ con el servidor
de desarrollo indicado más abajo.

## Matemáticas · Potencias

Nivel inicial: bases positivas y exponentes enteros de 0 a 6, sin fracciones,
bases negativas ni exponentes negativos. 30 ejercicios: cinco de cada categoría
(entender, simplificar, sumar, restar, multiplicar y dividir), más 20 parejas
con respuestas distintas tanto en su forma como en su valor.

Los tres modos son test de tres opciones, unir con flechas y respuesta escrita.
Incluyen guía de reglas, cronómetro, nota sobre 10, soluciones paso a paso y
repaso de fallos. En las sumas/restas se calculan primero las potencias; no se
aplican las reglas de exponentes propias de productos/cocientes.

La respuesta escrita acepta un único número o potencia (`2^5` o `2⁵`), sin
evaluar código ni operaciones pendientes. Una potencia simplificada debe tener
la base y el exponente solicitados para obtener 1 punto. Un valor correcto en
otra forma obtiene 0,5; un resultado incorrecto, ambiguo o vacío obtiene 0.
En preguntas que piden un valor numérico se acepta también una potencia de
valor equivalente. Los ejercicios y correctores están en `powers-questions.mjs`
y `powers-grading.mjs`; `study-topics.mjs` conecta los temas al motor común.

Progreso, cola de sincronización, autorizaciones de retirada y ranking local
usan claves propias para Potencias. Borrar Matemáticas no borra Historia.
La preferencia de tema claro/oscuro se comparte.
Matemáticas utiliza una paleta azul en ambos modos, incluidos ejercicios,
flechas, resultados y diálogos; Historia conserva su paleta verde. La tarjeta
de Matemáticas de la portada también usa azul. El diseño y los colores de aviso
(errores y respuestas parciales) se mantienen.

La API recibe `topic: "powers"` y sirve `/api/ranking?mode=easy&topic=powers`;
el modo puede ser también `matching` o `written`. Si se omite el tema, se
mantiene Historia. Los registros antiguos sin `topic` siguen perteneciendo
a Historia. El log de GitHub conserva ambos temas y filtra antes de aplicar
el límite de 50 resultados por modo y tema. El adaptador alternativo de
Firestore también filtra antes del límite para conservar los registros antiguos;
esto requiere leer todos los resultados del modo consultado.

Hay que desplegar la nueva API en Render junto con la web. Si el servidor
todavía no reconoce el tema, Matemáticas avisa y muestra el ranking local:
no presenta el ranking de Historia como si fuera el de Potencias.

## Lengua · Dictado de voz

La portada `aula/lengua.html` y sus actividades usan una paleta roja en claro
y oscuro. `aula/dictado.html` incluye el dictado
original «Una aventura en la biblioteca», para 5.º de Primaria (10 años),
dividido en 12 fragmentos. El audio WAV se incluye en `audio/biblioteca/`:
no necesita voces instaladas, micrófono, claves ni servicios externos.
Es voz neuronal española generada localmente con Piper y el modelo
`es_ES-sharvard-medium`, voz F (speaker 1). Sustituye al sintetizador eSpeak
para mejorar la naturalidad, sin enviar textos ni respuestas a servicios externos.
El modelo se descarga solo para generar los WAV; no se incluye en la web.
«Normal» es la opción predeterminada y reproduce el audio sin
ralentizarlo (velocidad 1); «Despacio» usa 0,9 y «Más rápido» usa 1,15.
Se dicen los puntos y las comas, con cuatro segundos entre fragmentos.
Play comienza desde el principio; Detener corta la reproducción; Repetir y
Siguiente permiten avanzar manualmente. Los errores de audio se muestran
explícitamente y también hay una opción de lectura por un adulto.

El texto no se muestra hasta corregir o pulsar expresamente la opción de
lectura por un adulto. No se trata de un examen seguro: el modelo y el audio
son recursos públicos. La corrección compara con ese modelo, alineando
palabras y signos para detectar letras, tildes, mayúsculas, omisiones,
palabras de más y puntuación, sin penalizar espacios ni saltos de línea.
La ñ no se trata como una n. No usa IA ni corrige redacciones libres.
La revisión muestra las diferencias, su contexto y el modelo completo.
La ayuda ortográfica del navegador está desactivada en el campo de escritura.

El borrador y la revisión usan `noe-language-dictation-v1`, sin ranking ni
envíos al servidor. Borrar Lengua no toca Historia ni Matemáticas. El tema
claro/oscuro se comparte mediante `theme.mjs`.

Para regenerar el audio en Linux con `libespeak-ng` disponible:
Descarga [Piper 2023.11.14-2](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2)
y el [modelo y su configuración `.onnx.json`](https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/sharvard/medium)
fuera del repositorio. Para regenerar los fragmentos:

```sh
node --input-type=module -e "import {dictation} from './dictation-content.mjs'; console.log(JSON.stringify(dictation.chunks))" | python3 scripts/generate-dictation-audio.py --piper /ruta/piper/piper --model /ruta/es_ES-sharvard-medium.onnx
```

El generador valida los WAV antes de reemplazarlos. Los audios y su atribución
CC BY 3.0 están en [audio/VOICE-LICENSE.txt](audio/VOICE-LICENSE.txt), accesible
desde la actividad. El motor Piper de esta versión tiene licencia MIT.
El generador falla explícitamente si la voz o un fragmento no se pueden crear.
GitHub Pages publica los WAV existentes; no necesita ejecutar el generador.

## Lengua · Ejemplos de los temas 1 y 2

`aula/repaso-lengua.html` ofrece 32 ejercicios originales con tres opciones:
sinónimos, antónimos, mayúsculas, literatura y sus géneros, tipos de palabras
según la sílaba tónica, reglas de acentuación, tipos de determinantes y artículos
determinados e indeterminados. Las parejas de palabras incluyen casos positivos
y negativos: no todas las palabras distintas son antónimos, ni todos los
objetos del mismo grupo son sinónimos. Los ejemplos desarrollan las categorías
indicadas por el usuario, sin reproducir ejercicios de un libro.

Incluye un esquema de estudio, nota sobre 10, revisión con explicaciones de
todos los ejercicios y opción de practicar solo los fallos. Las opciones se
barajan, se pueden cambiar antes de corregir y las preguntas sin responder
cuentan como cero. El estado usa `noe-language-review-v1`, separado del dictado
y de las otras asignaturas, y no se envía al ranking ni a la API.
El banco y las explicaciones están en `language-questions.mjs`.

## Estudio de la Edad Media

30 preguntas, tres modos (test, flechas y respuesta escrita), formulario de
nombre de mascota y tipo de animal, cronómetro, nota sobre 10 y revisión de fallos.
Bien suma 1, regular 0,5 y mal 0. La corrección escrita es orientativa por
ideas clave, no IA. Los apuntes mantienen las respuestas aportadas.
El botón «Modo oscuro / Modo claro» de la cabecera cambia el tema en todas
las pantallas y conserva la preferencia en este navegador.

## Ranking automático en GitHub

No hay exportación ni subida manual. Al finalizar un examen completo:

1. Se guarda una copia local.
2. Si se aceptó participar en el ranking público, se envían las respuestas a Render.
3. La API calcula la puntuación y añade una línea JSON al archivo `ranking.txt`
   de la rama `ranking-data` de `mvisions/estudionoe`.
4. El script del servidor interpreta el TXT y devuelve los 50 mejores resultados
   por modo: mayor nota, menor tiempo, fecha más antigua en caso de empate.

El tiempo se mide en el navegador e incluye pausas: no es un examen vigilado
ni una clasificación resistente a trampas. Las respuestas no se guardan en GitHub.
Los nuevos resultados conservan nombre de mascota (`petName`), tipo de animal
(`animalType`), modo, nota, duración y metadatos del examen, sin campos de nombre
del niño ni curso. Por ejemplo: Luna · gato. Se puede inventar una mascota.
El formulario no reutiliza nombres ni cursos de perfiles antiguos.
Los resultados antiguos siguen visibles, marcados como «Resultado antiguo»,
con su alias y curso originales. La API mantiene compatibilidad con clientes
antiguos y envíos pendientes que usan `name` y `course`; no los convierte en mascotas.
Actualizar este formato requiere publicar tanto la web como la API de Render.
La prueba de autorización para retirar una entrada se almacena solo como hash
SHA-256 de un valor aleatorio de 256 bits; nunca se registra el token del usuario
ni el token de escritura de GitHub.

Los resultados pendientes se conservan localmente aunque se comience otro examen
y se reintentan al abrir la web, recuperar conexión y cada dos minutos.
Si falla la API se avisa explícitamente y se muestra el ranking local como respaldo.
Los repasos no compiten. Borrar todo retira las entradas asociadas a este navegador
con eventos de borrado y limpia los datos locales. GitHub conserva el historial
de commits, por lo que esa retirada no elimina los datos del historial.
No usar datos personales ni apellidos; menores con permiso de su responsable.

## Configurar Render (paso imprescindible)

Servicio `estudionoe-api`, repositorio `mvisions/estudionoe`, rama `main`,
sin carpeta raíz, plan gratuito, `npm ci`, `npm start`, salud `/api/health`.
Variables:

- `NODE_VERSION=22.22.1`
- `NODE_ENV=production`
- `RANKING_STORAGE=github`
- `GITHUB_REPOSITORY=mvisions/estudionoe`
- `GITHUB_DATA_BRANCH=ranking-data`
- `ALLOWED_ORIGINS=https://mvisions.github.io`
- `GITHUB_TOKEN`: token de acceso **fine-grained** configurado directamente
  por el propietario en Render. Seleccionar solo `estudionoe`, permiso
  **Contents: Read and write** y fecha de caducidad. Nunca incluirlo en el chat,
  Git, frontend ni este documento.

No requiere Google Cloud ni archivos secretos de Firestore. Eliminar del
servicio las variables y el archivo secreto anteriores. El servidor no arranca
sin el token: no se simula un guardado exitoso.

La rama `ranking-data` debe existir con un `ranking.txt` vacío. Los commits
del log no publican Pages ni redespliegan Render: ambos usan solo `main`.
Ante entregas simultáneas se usa el SHA del archivo y se reintentan conflictos.
El log está limitado a 900 KB; el administrador debe archivarlo al llenarse.
El límite de solicitudes de GitHub y el arranque lento de Render gratuito
pueden demorar la sincronización.

## Desarrollo

Web: `python3 -m http.server 8080`.
API sin credenciales para pruebas: `RANKING_STORAGE=memory npm start`.
Pruebas: `npm test`.
El contador privado de visitantes funciona sin credenciales adicionales: usa el
mismo `GITHUB_TOKEN` y la rama `ranking-data` que el ranking, guardando solo el
hash SHA-256 del identificador del navegador por día en `visitors.txt`. El log
conserva los últimos 35 días y está limitado a 200 KB; el administrador debe
archivarlo al llenarse. El botón «Panel de control» pide `VISITOR_ADMIN_PIN`
(PIN de cuatro cifras; se valida solo en el servidor) y limita los intentos.
Opcionalmente, si se configuran en Render `VISITOR_FIRESTORE_PROJECT_ID` y
`VISITOR_FIRESTORE_CREDENTIALS_JSON` (JSON de una cuenta de servicio con acceso
a Firestore), el contador usa Firestore en su lugar; el almacén GitHub se ignora
en ese caso. El panel muestra visitantes únicos del día en la zona horaria
de Madrid y no guarda la IP. El ID solo se crea y envía si el visitante acepta
el aviso. Borrar los datos del navegador o cambiar de navegador puede hacer que
se cuente otra vez.
Para probar el ranking desde la web local, añade su origen a `ALLOWED_ORIGINS`
si utilizas un puerto distinto de 8080. Por ejemplo:
`RANKING_STORAGE=memory ALLOWED_ORIGINS=http://127.0.0.1:8087 npm start`.
GitHub Actions prueba y publica solo archivos estáticos.
