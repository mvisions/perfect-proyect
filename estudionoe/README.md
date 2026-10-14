# Noé · Test de historia

Web: https://mvisions.github.io/estudionoe/

## Portal de asignaturas

La nueva portada está en `aula/index.html`; una vez publicada, estará disponible
en https://mvisions.github.io/estudionoe/aula/.
Historia abre `aula/historia.html`, donde «La Edad Media · Estudio Noé» enlaza a
la web original. Matemáticas abre `aula/matematicas.html` con el tema Potencias.
Lenguaje aparece como «Próximamente», sin enlaces a actividades que todavía no existen.

La web original conserva su dirección, exámenes, preferencias y ranking.
La portada es estática y reutiliza los estilos existentes. Matemáticas reutiliza
la aplicación de exámenes con un banco y un corrector propios. GitHub Actions
publica el portal y todos los módulos necesarios.

Para añadir otro tema de Historia, incorpora una tarjeta en `aula/historia.html`
con su título, descripción y enlace, y actualiza el número de temas disponibles.
Cuando una nueva asignatura tenga contenido, crea su página en `aula/` y
sustituye el aviso «Próximamente» de la portada por un enlace a esa página.
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

## Estudio de la Edad Media

30 preguntas, tres modos (test, flechas y respuesta escrita), formulario de
alias y curso, cronómetro, nota sobre 10 y revisión de fallos.
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
El log conserva alias, curso, modo, nota, duración y metadatos del examen.
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
Para probar el ranking desde la web local, añade su origen a `ALLOWED_ORIGINS`
si utilizas un puerto distinto de 8080. Por ejemplo:
`RANKING_STORAGE=memory ALLOWED_ORIGINS=http://127.0.0.1:8087 npm start`.
GitHub Actions prueba y publica solo archivos estáticos.
