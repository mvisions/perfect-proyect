const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const englishWeekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const localizedMonths = {
  es: months,
  en: englishMonths,
  fr: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
  it: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
};
const localizedWeekdays = { es: ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"], en: englishWeekdays, fr: ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"], it: ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"], de: ["MO", "DI", "MI", "DO", "FR", "SA", "SO"] };

const routeTypes = {
  ruta: { label: "Ruta", color: "#207c62" },
  limpieza: { label: "Limpieza", color: "#3c82c4" },
  mantenimiento: { label: "Mantenimiento", color: "#d18b27" },
  reunion: { label: "Reunión", color: "#9b5bb4" },
  otro: { label: "Otro", color: "#e16f5b" }
};
const dayStatuses = {
  trabajado: "Trabajado",
  "festivo-trabajado": "Festivo trabajado",
  baja: "Baja",
  "asuntos-propios": "Asuntos propios",
  vacaciones: "Vacaciones",
  ampliaciones: "Ampliaciones",
  descanso: "Descanso"
};
const nationalHolidays = new Set(["1-1", "1-6", "5-1", "8-15", "10-12", "11-1", "12-6", "12-8", "12-25"]);
const customHolidayKey = "limasam-custom-holidays";
const localDriveBackupKey = "limasam-drive-local-backup";
const googleClientId = "673366304553-dgg8pgu9u8hb4ocfs8p1as5imkt6ht1v.apps.googleusercontent.com";
const driveFileName = "Agenda de trabajos y actividades.json";
const lastSyncKey = "limasam-last-sync";
const deletedRoutesKey = "limasam-deleted-routes";

const currentDate = new Date();
const state = {
  month: currentDate.getMonth(),
  year: currentDate.getFullYear(),
  selected: null,
  routes: {}
};

const $ = (selector) => document.querySelector(selector);
const monthSelect = $("#monthSelect");
const yearInput = $("#yearInput");
const groupInput = $("#groupNumber");
const calendarGrid = $("#calendarGrid");
const alarmInput = $("#alarmInput");
const reminderInput = $("#reminderInput");
const shiftInput = $("#shiftInput");
const exitInput = $("#exitInput");
const entryHourInput = $("#entryHourInput");
const entryMinuteInput = $("#entryMinuteInput");
const exitHourInput = $("#exitHourInput");
const exitMinuteInput = $("#exitMinuteInput");
const workDurationValue = $("#workDurationValue");
const entryNowButton = $("#entryNowButton");
const exitNowButton = $("#exitNowButton");
const extraHoursValue = $("#extraHoursValue");
const extraHoursMinus = $("#extraHoursMinus");
const extraHoursPlus = $("#extraHoursPlus");
const statusInput = $("#statusInput");
const holidayDateInput = $("#holidayDateInput");
const holidayNameInput = $("#holidayNameInput");
const holidayList = $("#holidayList");
const backgroundToggle = $("#backgroundToggle");
const backgroundFiles = $("#backgroundFiles");
const backgroundOptions = $("#backgroundOptions");
const solidBackground = $("#solidBackground");
const backgroundColorInput = $("#backgroundColorInput");
const backgroundReset = $("#backgroundReset");
const themeSelect = $("#themeSelect");
const soundToggle = $("#soundToggle");
const spanishButton = $("#spanishButton");
const englishButton = $("#englishButton");
const languageToggle = $(".language-toggle");
const weekdayColorInput = $("#weekdayColorInput");
const weekendColorInput = $("#weekendColorInput");
const driveButton = $("#driveButton");
const driveButtonLabel = $("#driveButtonLabel");
const driveLogoutButton = $("#driveLogoutButton");
const syncStatus = $("#syncStatus");
const syncNowButton = $("#syncNowButton");
const pdfButton = $("#pdfButton");
const csvButton = $("#csvButton");
const shareRecordButton = $("#shareRecordButton");
const shareBackgroundToggle = $("#shareBackgroundToggle");
const sharePunchesToggle = $("#sharePunchesToggle");
const installButton = $("#installButton");
const offlineStatus = $("#offlineStatus");
const previewDaySelect = $("#previewDaySelect");
const agendaCanvas = $("#agendaCanvas");
const agendaPreview = $(".agenda-preview");
const exportActions = $(".export-actions");
const routeManager = $("#routeManager");
const recordButton = $("#recordButton");
const recordCard = $("#recordCard");
const customBackgroundKey = "limasam-custom-backgrounds";
let driveAccessToken = null;
let driveFileId = localStorage.getItem("limasam-drive-file-id");
let driveSyncTimer = null;
let driveChangesPending = false;
let deferredInstallPrompt = null;
let currentLanguage = localStorage.getItem("limasam-language") || "es";

[{ id: "frenchButton", label: "🇫🇷 FR", aria: "Français", language: "fr" }, { id: "italianButton", label: "🇮🇹 IT", aria: "Italiano", language: "it" }, { id: "germanButton", label: "🇩🇪 DE", aria: "Deutsch", language: "de" }].forEach(({ id, label, aria, language }) => {
  if (document.getElementById(id)) return;
  const button = document.createElement("button");
  button.id = id;
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", aria);
  button.addEventListener("click", () => setLanguage(language));
  languageToggle.appendChild(button);
});

const languagePairs = {
  "Memoria laboral": "Work Memory",
  "Planificador mensual": "Monthly planner",
  "Organiza destinos y horas de entrada para cada día. Después descarga una imagen limpia, lista para compartir.": "Organize destinations and entry times for each day. Then download a clean image ready to share.",
  "Número de grupo": "Group number",
  "Mes": "Month",
  "Año": "Year",
  "Tema": "Theme",
  "Sonidos": "Sounds",
  "Colores del calendario": "Calendar colors",
  "Diarios": "Weekdays",
  "Fines de semana": "Weekends",
  "Mostrar fondo de barrenderos": "Show street-cleaning background",
  "Subir imágenes": "Upload images",
  "Usar fondos predeterminados": "Use default backgrounds",
  "Descargar PNG": "Download PNG",
  "Compartir estructura del mes": "Share month structure",
  "Incluir horas fichadas": "Include clocked hours",
  "Incluir fondo del mes": "Include month background",
  "Gestionar festivos personalizados": "Manage custom holidays",
  "Detalle del día": "Day details",
  "Destino": "Destination",
  "Tipo de trabajo": "Work type",
  "Hora de entrada (24 h)": "Entry time (24 h)",
  "Tipo de jornada": "Workday type",
  "Hora de salida (24 h)": "Exit time (24 h)",
  "Horas extra": "Overtime hours",
  "Avisar": "Reminder",
  "Estado del día": "Day status",
  "Activar alarma en Android": "Enable Android alarm",
  "Vaciar día": "Clear day",
  "Borrar recuerdo": "Clear remembered route",
  "Guardar ruta": "Save route",
  "Vista previa en tiempo real": "Live preview",
  "Agenda lista para compartir": "Agenda ready to share",
  "Editar día": "Edit day",
  "Control anual": "Annual record",
  "Resumen de días y actividades": "Days and activities summary",
  "Trabajados": "Worked",
  "Festivos trabajados": "Worked holidays",
  "Bajas": "Sick leave",
  "Asuntos propios": "Personal days",
  "Vacaciones": "Vacation",
  "Ampliaciones": "Extensions",
  "Tiempo trabajado": "Worked time",
  "Barras": "Bars",
  "Abanico": "Fan",
  "Exportar expediente": "Export record"
};

Object.assign(languagePairs, {
  Enero: "January", Febrero: "February", Marzo: "March", Abril: "April", Mayo: "May", Junio: "June", Julio: "July", Agosto: "August", Septiembre: "September", Octubre: "October", Noviembre: "November", Diciembre: "December",
  "Jornada completa · 8 h": "Full day · 8 h", "Jornada continua · 7 h": "Continuous day · 7 h", "Media jornada · 4 h": "Half day · 4 h",
  "A la hora de entrada": "At entry time", "15 minutos antes": "15 minutes before", "30 minutos antes": "30 minutes before", "1 hora antes": "1 hour before", "2 horas antes": "2 hours before",
  Trabajado: "Worked", "Festivo trabajado": "Worked holiday", Baja: "Sick leave", "Sin calcular": "Not calculated", "Sin entrada": "No entry", "Sin salida": "No exit", "Se suma de una en una": "Added one at a time",
  "Huella de entrada": "Entry punch", "Huella de salida": "Exit punch", "Tiempo trabajado": "Worked time", "Registrar entrada": "Record entry", "Registrar salida": "Record exit"
});

const languageTranslations = {
  en: languagePairs,
  fr: {
    "Memoria laboral": "Mémoire de travail", "Planificador mensual": "Planificateur mensuel", "Número de grupo": "Numéro de groupe", Mes: "Mois", Año: "Année", Tema: "Thème", Sonidos: "Sons", "Colores del calendario": "Couleurs du calendrier", Diarios: "Jours ouvrés", "Fines de semana": "Week-ends", "Subir imágenes": "Télécharger des images", "Usar fondos predeterminados": "Utiliser les fonds par défaut", "Descargar PNG": "Télécharger PNG", "Compartir estructura del mes": "Partager la structure du mois", "Gestionar festivos personalizados": "Gérer les jours fériés", "Detalle del día": "Détails du jour", Destino: "Destination", "Tipo de trabajo": "Type de travail", "Avisar": "Rappel", "Estado del día": "Statut du jour", Trabajado: "Travaillé", "Festivo trabajado": "Jour férié travaillé", Baja: "Arrêt maladie", Vacaciones: "Congés", Ampliaciones: "Extensions", "Tiempo trabajado": "Temps travaillé", Barras: "Barres", Abanico: "Éventail", "Editar día": "Modifier le jour", "Guardar ruta": "Enregistrer la journée"
  },
  it: {
    "Memoria laboral": "Memoria lavorativa", "Planificador mensual": "Pianificatore mensile", "Número de grupo": "Numero gruppo", Mes: "Mese", Año: "Anno", Tema: "Tema", Sonidos: "Suoni", "Colores del calendario": "Colori del calendario", Diarios: "Giorni lavorativi", "Fines de semana": "Fine settimana", "Subir imágenes": "Carica immagini", "Usar fondos predeterminados": "Usa sfondi predefiniti", "Descargar PNG": "Scarica PNG", "Compartir estructura del mes": "Condividi struttura del mese", "Gestionar festivos personalizados": "Gestisci festività personalizzate", "Detalle del día": "Dettagli del giorno", Destino: "Destinazione", "Tipo de trabajo": "Tipo di lavoro", "Avisar": "Promemoria", "Estado del día": "Stato del giorno", Trabajado: "Lavorato", "Festivo trabajado": "Festivo lavorato", Baja: "Malattia", Vacaciones: "Ferie", Ampliaciones: "Estensioni", "Tiempo trabajado": "Tempo lavorato", Barras: "Barre", Abanico: "Ventaglio", "Editar día": "Modifica giorno", "Guardar ruta": "Salva giornata"
  },
  de: {
    "Memoria laboral": "Arbeitsgedächtnis", "Planificador mensual": "Monatsplaner", "Número de grupo": "Gruppennummer", Mes: "Monat", Año: "Jahr", Tema: "Thema", Sonidos: "Töne", "Colores del calendario": "Kalenderfarben", Diarios: "Werktage", "Fines de semana": "Wochenenden", "Subir imágenes": "Bilder hochladen", "Usar fondos predeterminados": "Standardhintergründe verwenden", "Descargar PNG": "PNG herunterladen", "Compartir estructura del mes": "Monatsstruktur teilen", "Gestionar festivos personalizados": "Eigene Feiertage verwalten", "Detalle del día": "Tagesdetails", Destino: "Ziel", "Tipo de trabajo": "Arbeitsart", "Avisar": "Erinnerung", "Estado del día": "Tagesstatus", Trabajado: "Gearbeitet", "Festivo trabajado": "Gearbeiteter Feiertag", Baja: "Krankheit", Vacaciones: "Urlaub", Ampliaciones: "Erweiterungen", "Tiempo trabajado": "Arbeitszeit", Barras: "Balken", Abanico: "Fächer", "Editar día": "Tag bearbeiten", "Guardar ruta": "Tag speichern"
  }
};
Object.assign(languageTranslations.fr, Object.fromEntries(months.map((month, index) => [month, localizedMonths.fr[index]])));
Object.assign(languageTranslations.it, Object.fromEntries(months.map((month, index) => [month, localizedMonths.it[index]])));
Object.assign(languageTranslations.de, Object.fromEntries(months.map((month, index) => [month, localizedMonths.de[index]])));

function translatePage() {
  document.documentElement.lang = currentLanguage;
  document.title = { es: "Memoria laboral", en: "Work Memory", fr: "Mémoire de travail", it: "Memoria lavorativa", de: "Arbeitsgedächtnis" }[currentLanguage] || "Memoria laboral";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const original = node.nodeValue.trim();
    if (!original) continue;
    const dynamicDay = original.match(/^(Día|Day|Jour|Giorno|Tag) (\d+)$/);
    const dynamicMonthYear = original.match(/^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) (\d{4})$/);
    const activeTranslations = languageTranslations[currentLanguage] || languagePairs;
    const sourceKey = Object.entries(languageTranslations).flatMap(([, map]) => Object.entries(map)).find(([key, value]) => key === original || value === original)?.[0] || original;
    const dayLabels = { es: "Día", en: "Day", fr: "Jour", it: "Giorno", de: "Tag" };
    const translated = dynamicDay
      ? `${dayLabels[currentLanguage] || "Día"} ${dynamicDay[2]}`
      : dynamicMonthYear && currentLanguage === "en"
        ? `${languagePairs[dynamicMonthYear[1]]} ${dynamicMonthYear[2]}`
        : currentLanguage === "es" ? sourceKey : activeTranslations[sourceKey] || languagePairs[sourceKey] || original;
    if (translated) node.nodeValue = node.nodeValue.replace(original, translated);
  }
  document.querySelectorAll("input[placeholder]").forEach((input) => {
    const translated = currentLanguage === "es" ? Object.entries(languageTranslations).flatMap(([, map]) => Object.entries(map)).find(([, value]) => value === input.placeholder)?.[0] : (languageTranslations[currentLanguage]?.[input.placeholder] || languagePairs[input.placeholder]);
    if (translated) input.placeholder = translated;
  });
  document.querySelectorAll(".language-toggle button").forEach((button) => button.classList.toggle("is-active", button.id === `${currentLanguage}Button` || (currentLanguage === "es" && button.id === "spanishButton") || (currentLanguage === "en" && button.id === "englishButton")));
}

function setLanguage(language) {
  currentLanguage = language;
  localStorage.setItem("limasam-language", language);
  translatePage();
}

spanishButton.addEventListener("click", () => setLanguage("es"));
englishButton.addEventListener("click", () => setLanguage("en"));

agendaPreview.append(exportActions);
backgroundToggle.checked = localStorage.getItem("limasam-show-background") !== "false";
backgroundColorInput.value = localStorage.getItem("limasam-background-color") || "#f5f7f3";
weekdayColorInput.value = localStorage.getItem("limasam-weekday-color") || "#ffffff";
weekendColorInput.value = localStorage.getItem("limasam-weekend-color") || "#e4f2ff";
const savedTheme = localStorage.getItem("limasam-theme") || (localStorage.getItem("limasam-dark-mode") === "true" ? "dark" : "light");
themeSelect.value = savedTheme;
soundToggle.checked = localStorage.getItem("limasam-sounds") !== "false";
document.body.classList.toggle("dark-mode", savedTheme === "dark");
document.body.classList.toggle("night-mode", savedTheme === "night");
document.documentElement.style.setProperty("--weekday-color", weekdayColorInput.value);
document.documentElement.style.setProperty("--weekend-color", weekendColorInput.value);

let audioContext;
let welcomeSoundPlayed = false;

async function playMelody(notes) {
  if (!soundToggle.checked) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  await audioContext.resume();
  const start = audioContext.currentTime + 0.05;
  notes.forEach(([frequency, delay, duration]) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.07, start + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start + delay);
    oscillator.stop(start + delay + duration + 0.03);
  });
}

async function playBeep() {
  if (!soundToggle.checked) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  await audioContext.resume();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime + 0.01;
  oscillator.type = "sine";
  oscillator.frequency.value = 740;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.11);
}

async function playWelcomeMelody() {
  if (welcomeSoundPlayed) return;
  welcomeSoundPlayed = true;
  await playMelody([[523.25, 0, .16], [659.25, .14, .16], [783.99, .28, .25]]);
}

async function playSavedMelody() {
  await playMelody([[659.25, 0, .12], [783.99, .12, .18]]);
}

function unlockWelcomeSound() {
  playWelcomeMelody();
  window.removeEventListener("pointerdown", unlockWelcomeSound);
  window.removeEventListener("keydown", unlockWelcomeSound);
}

window.addEventListener("pointerdown", unlockWelcomeSound, { once: true });
window.addEventListener("keydown", unlockWelcomeSound, { once: true });
document.addEventListener("click", (event) => {
  if (event.target.closest("button, summary")) playBeep().catch(() => {});
}, true);

function loadCustomBackgrounds() {
  try {
    const saved = JSON.parse(localStorage.getItem(customBackgroundKey) || "[]");
    return months.map((_, index) => saved[index] || null);
  } catch {
    return months.map(() => null);
  }
}

const customBackgroundData = loadCustomBackgrounds();
const customAgendaBackgrounds = customBackgroundData.map((source) => {
  if (!source) return null;
  const image = new Image();
  image.src = source;
  image.addEventListener("load", () => drawAgendaCanvas());
  return image;
});
const agendaBackgrounds = months.map((_, index) => {
  const image = new Image();
  image.src = index === 0
    ? "assets/barrenderos.webp"
    : `assets/barrenderos-${String(index + 1).padStart(2, "0")}.jpg`;
  image.addEventListener("load", () => drawAgendaCanvas());
  return image;
});

function currentAgendaBackground() {
  return customAgendaBackgrounds[state.month] || agendaBackgrounds[state.month];
}

function updateShareBackgroundOption() {
  const available = Boolean(customBackgroundData[state.month]);
  shareBackgroundToggle.disabled = !available;
  if (!available) shareBackgroundToggle.checked = false;
}

function updateBackgroundOptions() {
  backgroundOptions.hidden = !backgroundToggle.checked;
  solidBackground.hidden = backgroundToggle.checked;
}

function renderPreviewDayOptions() {
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  previewDaySelect.innerHTML = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return `<option value="${day}">Día ${day}</option>`;
  }).join("");
  previewDaySelect.value = String(state.selected || 1);
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

updateBackgroundOptions();

months.forEach((name, index) => {
  const option = document.createElement("option");
  option.value = index;
  option.textContent = name;
  monthSelect.appendChild(option);
});
monthSelect.value = state.month;
yearInput.value = state.year;
holidayDateInput.value = `${state.year}-${String(state.month + 1).padStart(2, "0")}-01`;
renderPreviewDayOptions();

function storageKey() {
  return `limasam-${state.year}-${state.month}`;
}

function routeStorageId(year, month, day) {
  return `limasam-${year}-${month}-${day}`;
}

function loadDeletedRoutes() {
  try {
    const deleted = JSON.parse(localStorage.getItem(deletedRoutesKey) || "[]");
    return new Set(Array.isArray(deleted) ? deleted : []);
  } catch {
    return new Set();
  }
}

function saveDeletedRoutes(deleted) {
  localStorage.setItem(deletedRoutesKey, JSON.stringify([...deleted]));
}

function markRouteDeleted(day) {
  const deleted = loadDeletedRoutes();
  deleted.add(routeStorageId(state.year, state.month, day));
  saveDeletedRoutes(deleted);
}

function unmarkRouteDeleted(day) {
  const deleted = loadDeletedRoutes();
  deleted.delete(routeStorageId(state.year, state.month, day));
  saveDeletedRoutes(deleted);
}

const rememberedRouteKey = "limasam-last-route";

function loadRememberedRoute() {
  try {
    return JSON.parse(localStorage.getItem(rememberedRouteKey) || "null");
  } catch {
    return null;
  }
}

function saveRememberedRoute(route) {
  localStorage.setItem(rememberedRouteKey, JSON.stringify({
    destination: route.destination,
    time: route.time,
    type: route.type || "",
    reminder: Number(route.reminder ?? 30),
    status: route.status || "trabajado",
    exit: route.exit || "",
    shift: route.shift || "completa",
    exitManual: route.exitManual === true
  }));
}

function loadRoutes() {
  try {
    state.routes = JSON.parse(localStorage.getItem(storageKey()) || "{}");
  } catch {
    state.routes = {};
  }
}

function saveRoutes() {
  localStorage.setItem(storageKey(), JSON.stringify(state.routes));
  driveChangesPending = true;
  updateSyncUi();
  queueDriveSync();
}

function updateSyncUi() {
  const savedAt = localStorage.getItem(lastSyncKey);
  syncNowButton.hidden = !driveAccessToken;
  if (driveChangesPending) {
    syncStatus.textContent = "Cambios pendientes";
    syncStatus.classList.add("is-pending");
  } else if (savedAt) {
    syncStatus.textContent = `Sincronizado ${new Date(savedAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}`;
    syncStatus.classList.remove("is-pending");
  } else {
    syncStatus.textContent = driveAccessToken ? "Sincronizado ahora" : "Sin sincronizar";
    syncStatus.classList.remove("is-pending");
  }
}

function updateOfflineStatus() {
  offlineStatus.hidden = navigator.onLine;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch((error) => console.error("No se pudo activar el modo offline", error)));
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});
window.addEventListener("online", updateOfflineStatus);
window.addEventListener("offline", updateOfflineStatus);
updateOfflineStatus();

function markDriveSynced() {
  driveChangesPending = false;
  localStorage.setItem(lastSyncKey, new Date().toISOString());
  updateSyncUi();
}

function loadExternalScript(source) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${source}"]`);
    if (existing) {
      if (window.google?.accounts?.oauth2) resolve();
      else existing.addEventListener("load", resolve, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = source;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function cloudPayload() {
  const routes = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.match(/^limasam-\d{4}-\d+$/)) {
      const monthRoutes = JSON.parse(localStorage.getItem(key));
      routes[key] = Object.fromEntries(Object.entries(monthRoutes).map(([day, route]) => [day, {
        ...route,
        workedMinutes: workedMinutes(route.time, route.exit)
      }]));
    }
  }
  return { version: 2, updatedAt: new Date().toISOString(), routes, customHolidays, deletedRoutes: [...loadDeletedRoutes()] };
}

async function driveRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${driveAccessToken}`, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Google Drive respondió ${response.status}`);
  return response;
}

async function uploadDriveFile() {
  const content = JSON.stringify(cloudPayload(), null, 2);
  const body = new Blob([content], { type: "application/json" });
  if (!driveFileId) {
    const metadata = new Blob([JSON.stringify({ name: driveFileName, mimeType: "application/json" })], { type: "application/json" });
    const form = new FormData();
    form.append("metadata", metadata);
    form.append("file", body);
    const response = await driveRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: form });
    driveFileId = (await response.json()).id;
    localStorage.setItem("limasam-drive-file-id", driveFileId);
    markDriveSynced();
    return;
  }
  await driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
  markDriveSynced();
}

async function syncFromDrive() {
  const query = encodeURIComponent(`name = '${driveFileName}' and trashed = false and mimeType = 'application/json'`);
  const listResponse = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=1`);
  const files = (await listResponse.json()).files || [];
  if (!files.length) {
    await uploadDriveFile();
    return;
  }
  driveFileId = files[0].id;
  localStorage.setItem("limasam-drive-file-id", driveFileId);
  const contentResponse = await driveRequest(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`);
  const payload = await contentResponse.json();
  localStorage.setItem(localDriveBackupKey, JSON.stringify({ savedAt: new Date().toISOString(), payload: cloudPayload() }));
  const deletedRoutes = new Set([...(payload.deletedRoutes || []), ...loadDeletedRoutes()]);
  Object.keys(payload.routes || {}).forEach((key) => {
    const routes = payload.routes[key];
    deletedRoutes.forEach((deletedKey) => {
      const prefix = `${key}-`;
      if (deletedKey.startsWith(prefix)) delete routes[deletedKey.slice(prefix.length)];
    });
  });
  saveDeletedRoutes(deletedRoutes);
  Object.keys(localStorage).filter((key) => key.match(/^limasam-\d{4}-\d+$/)).forEach((key) => localStorage.removeItem(key));
  Object.entries(payload.routes || {}).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  if (Array.isArray(payload.customHolidays)) {
    customHolidays.splice(0, customHolidays.length, ...payload.customHolidays);
    localStorage.setItem(customHolidayKey, JSON.stringify(customHolidays));
  }
  renderHolidayList();
  renderCalendar();
  if (deletedRoutes.size) await uploadDriveFile();
  else markDriveSynced();
}

function queueDriveSync() {
  if (!driveAccessToken) return;
  clearTimeout(driveSyncTimer);
  driveSyncTimer = setTimeout(async () => {
    try {
      await uploadDriveFile();
      driveButtonLabel.textContent = "Drive sincronizado";
    } catch (error) {
      console.error("No se pudo sincronizar Google Drive", error);
      driveButtonLabel.textContent = "Error al sincronizar";
    }
  }, 500);
}

async function connectGoogleDrive() {
  driveButton.disabled = true;
  driveButtonLabel.textContent = "Conectando...";
  syncStatus.textContent = "Conectando con Drive...";
  try {
    await loadExternalScript("https://accounts.google.com/gsi/client");
    const token = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: resolve,
        error_callback: reject
      });
      client.requestAccessToken({ prompt: driveFileId ? "" : "consent" });
    });
    if (!token.access_token) throw new Error("No se recibió el permiso de Google");
    driveAccessToken = token.access_token;
    await syncFromDrive();
    driveButtonLabel.textContent = "Drive conectado";
    driveLogoutButton.hidden = false;
    recordButton.hidden = false;
    updateSyncUi();
    showToast("Agenda sincronizada con Google Drive");
  } catch (error) {
    console.error("No se pudo conectar Google Drive", error);
    driveButtonLabel.textContent = "Conectar Google Drive";
    updateSyncUi();
    showToast("No se pudo conectar Google Drive");
  } finally {
    driveButton.disabled = false;
  }
}

async function syncNow() {
  if (!driveAccessToken) return connectGoogleDrive();
  syncNowButton.disabled = true;
  syncStatus.textContent = "Sincronizando...";
  try {
    await uploadDriveFile();
    driveButtonLabel.textContent = "Drive sincronizado";
    showToast("Cambios sincronizados");
  } catch (error) {
    console.error("No se pudo sincronizar", error);
    syncStatus.textContent = "Error de sincronización";
    showToast("No se pudo sincronizar");
  } finally {
    syncNowButton.disabled = false;
    updateSyncUi();
  }
}

async function disconnectGoogleDrive() {
  const token = driveAccessToken;
  driveAccessToken = null;
  clearTimeout(driveSyncTimer);
  if (token && window.google?.accounts?.oauth2?.revoke) {
    await new Promise((resolve) => window.google.accounts.oauth2.revoke(token, resolve));
  }
  driveButtonLabel.textContent = "Conectar Google Drive";
  driveLogoutButton.hidden = true;
  recordButton.hidden = true;
  recordCard.hidden = true;
  document.body.classList.remove("record-view");
  recordButton.textContent = "Ver expediente";
  updateSyncUi();
  showToast("Sesión de Google cerrada");
}

function loadCustomHolidays() {
  try {
    const saved = JSON.parse(localStorage.getItem(customHolidayKey) || "[]");
    return Array.isArray(saved) ? saved.filter((holiday) => holiday?.date && holiday?.name) : [];
  } catch {
    return [];
  }
}

const customHolidays = loadCustomHolidays();

function holidayDate(day) {
  return `${state.year}-${String(state.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function customHoliday(day) {
  return customHolidays.find((holiday) => holiday.date === holidayDate(day));
}

function dateLabel(day) {
  const month = localizedMonth(state.month);
  return currentLanguage === "es" ? `${day} de ${month.toLowerCase()} de ${state.year}` : `${day} ${month} ${state.year}`;
}

function localizedMonth(index) {
  return (localizedMonths[currentLanguage] || months)[index];
}

function isHoliday(day) {
  return nationalHolidays.has(`${state.month + 1}-${day}`) || Boolean(customHoliday(day));
}

function holidayLabel(day) {
  return customHoliday(day)?.name || "Festivo";
}

function renderHolidayList() {
  const currentYear = String(state.year);
  const holidays = customHolidays.filter((holiday) => holiday.date.startsWith(`${currentYear}-`)).sort((left, right) => left.date.localeCompare(right.date));
  holidayList.innerHTML = holidays.length
    ? holidays.map((holiday) => `<li><span>${escapeHtml(holiday.date.slice(5).split("-").reverse().join("/"))} · ${escapeHtml(holiday.name)}</span><button type="button" class="holiday-remove" data-date="${holiday.date}" aria-label="Eliminar ${escapeHtml(holiday.name)}">×</button></li>`).join("")
    : "<li class=\"holiday-empty\">No hay festivos personalizados este año</li>";
}

function routeColor(route) {
  return routeTypes[route?.type]?.color || routeTypes.ruta.color;
}

function statusLabel(route) {
  const status = dayStatuses[route?.status] || dayStatuses.trabajado;
  return currentLanguage === "es" ? status : languageTranslations[currentLanguage]?.[status] || languagePairs[status] || status;
}

function routeDisplayName(route) {
  return route.destination || statusLabel(route);
}

function validTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function populateClockParts(hourSelect, minuteSelect) {
  hourSelect.innerHTML = '<option value="">--</option>';
  minuteSelect.innerHTML = '<option value="">--</option>';
  for (let hour = 0; hour < 24; hour += 1) hourSelect.insertAdjacentHTML("beforeend", `<option value="${String(hour).padStart(2, "0")}">${String(hour).padStart(2, "0")}</option>`);
  for (let minute = 0; minute < 60; minute += 1) minuteSelect.insertAdjacentHTML("beforeend", `<option value="${String(minute).padStart(2, "0")}">${String(minute).padStart(2, "0")}</option>`);
}

function syncClockParts(timeInput, hourSelect, minuteSelect) {
  const [hour, minute] = validTime(timeInput.value) ? timeInput.value.split(":") : ["", ""];
  hourSelect.value = hour;
  minuteSelect.value = minute;
}

function syncTimeInput(timeInput, hourSelect, minuteSelect) {
  timeInput.value = hourSelect.value && minuteSelect.value ? `${hourSelect.value}:${minuteSelect.value}` : "";
}

populateClockParts(entryHourInput, entryMinuteInput);
populateClockParts(exitHourInput, exitMinuteInput);

function addHoursToTime(value, hours) {
  if (!validTime(value)) return "";
  const [hour, minute] = value.split(":").map(Number);
  const totalMinutes = (hour * 60 + minute + hours * 60) % (24 * 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function workedMinutes(entry, exit) {
  if (!validTime(entry) || !validTime(exit)) return 0;
  const [entryHour, entryMinute] = entry.split(":").map(Number);
  const [exitHour, exitMinute] = exit.split(":").map(Number);
  let minutes = (exitHour * 60 + exitMinute) - (entryHour * 60 + entryMinute);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

function formatWorkedTime(minutes) {
  if (!minutes) return "Sin calcular";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} h${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
}

function formatTotalHours(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} h${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
}

function recordEntryTime(record) {
  return record.actualEntry || record.plannedTime || record.time || "";
}

function recordExitTime(record) {
  return record.actualExit || record.plannedExit || record.exit || "";
}

function updateWorkDuration() {
  workDurationValue.textContent = formatWorkedTime(workedMinutes($("#timeInput").value, exitInput.value));
}

function autoFillExit() {
  const hours = shiftInput.value === "media" ? 4 : shiftInput.value === "continua" ? 7 : 8;
  const entry = $("#timeInput").value;
  if (validTime(entry) && exitInput.dataset.manual !== "true") {
    exitInput.value = addHoursToTime(entry, hours);
    syncClockParts(exitInput, exitHourInput, exitMinuteInput);
    exitInput.dataset.manual = "false";
  }
}

function registerCurrentTime(target) {
  const today = new Date();
  const selectedDate = new Date(state.year, state.month, state.selected);
  const isToday = state.selected && selectedDate.getFullYear() === today.getFullYear()
    && selectedDate.getMonth() === today.getMonth()
    && selectedDate.getDate() === today.getDate();
  if (!isToday) {
    showToast("Aún no estás en el día de trabajo seleccionado");
    return;
  }
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (target === "entry") {
    $("#timeInput").value = time;
    $("#timeInput").dataset.punch = "true";
    syncClockParts($("#timeInput"), entryHourInput, entryMinuteInput);
    exitInput.dataset.manual = "false";
    autoFillExit();
  } else {
    exitInput.value = time;
    exitInput.dataset.punch = "true";
    syncClockParts(exitInput, exitHourInput, exitMinuteInput);
    exitInput.dataset.manual = "true";
  }
  showToast(`Hora de ${target === "entry" ? "entrada" : "salida"} registrada: ${time}`);
}

function calendarColor(variable, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function updateMonthSummary() {
  const routes = Object.values(state.routes);
  $("#routeCount").textContent = routes.length;
  $("#scheduledHours").textContent = routes.filter((route) => route.time).length;
  $("#holidayCount").textContent = Array.from({ length: new Date(state.year, state.month + 1, 0).getDate() }, (_, index) => index + 1)
    .filter(isHoliday).length;
}

function routeExtraHours(route) {
  return Math.max(0, Number(route?.extraHours || 0));
}

function updateExtraHoursUi(route = state.routes[state.selected]) {
  extraHoursValue.textContent = routeExtraHours(route);
}

function changeExtraHours(amount) {
  if (!state.selected) return;
  const route = state.routes[state.selected] || { destination: "", time: "", type: "", status: "trabajado", alarm: false };
  route.extraHours = Math.max(0, routeExtraHours(route) + amount);
  state.routes[state.selected] = route;
  saveRoutes();
  updateExtraHoursUi(route);
  renderCalendar();
  selectDay(state.selected);
}

function yearRoutes(year) {
  const records = [];
  for (let month = 0; month < 12; month += 1) {
    let routes = {};
    try {
      routes = JSON.parse(localStorage.getItem(`limasam-${year}-${month}`) || "{}");
    } catch {
      routes = {};
    }
    Object.entries(routes).forEach(([day, route]) => records.push({ month, day: Number(day), ...route }));
  }
  return records.sort((left, right) => new Date(year, left.month, left.day) - new Date(year, right.month, right.day));
}

function renderAnnualSummary() {
  const records = yearRoutes(state.year).filter((record) => record.status !== "descanso");
  const isWeekdayWorked = (record) => {
    if ((record.status || "trabajado") !== "trabajado") return false;
    const dayOfWeek = new Date(state.year, record.month, record.day).getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  };
  const weekdayWorked = records.filter(isWeekdayWorked).length;
  const totalExtraHours = records.reduce((sum, record) => sum + routeExtraHours(record), 0);
  const totalNormalMinutes = records.reduce((sum, record) => sum + workedMinutes(recordEntryTime(record), recordExitTime(record)), 0);
  const currentMonthRecords = records.filter((record) => record.month === state.month);
  const currentMonthMinutes = currentMonthRecords.reduce((sum, record) => sum + workedMinutes(recordEntryTime(record), recordExitTime(record)), 0);
  const currentMonthExtraHours = currentMonthRecords.reduce((sum, record) => sum + routeExtraHours(record), 0);
  const counts = records.reduce((result, record) => {
    const status = record.status || "trabajado";
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  $("#recordYear").textContent = state.year;
  $("#annualTotalCount").textContent = records.length;
  $("#workedCount").textContent = weekdayWorked;
  $("#holidayWorkedCount").textContent = counts["festivo-trabajado"] || 0;
  $("#leaveCount").textContent = counts.baja || 0;
  $("#personalCount").textContent = counts["asuntos-propios"] || 0;
  $("#vacationCount").textContent = counts.vacaciones || 0;
  $("#extensionCount").textContent = counts.ampliaciones || 0;
  $("#extraHoursCount").textContent = totalExtraHours;
  $("#normalHoursCount").textContent = formatTotalHours(totalNormalMinutes);
  $("#comparisonMonthLabel").textContent = months[state.month];
  $("#comparisonMonthDays").textContent = `${currentMonthRecords.length} días`;
  $("#comparisonMonthHours").textContent = `${formatTotalHours(currentMonthMinutes)} normales · ${currentMonthExtraHours} h extra`;
  $("#comparisonYearDays").textContent = `${records.length} días`;
  $("#comparisonYearHours").textContent = `${formatTotalHours(totalNormalMinutes)} normales · ${totalExtraHours} h extra`;
  $("#monthlyStats").innerHTML = months.map((month, monthIndex) => {
    const monthRecords = records.filter((record) => record.month === monthIndex);
    const values = {
      worked: monthRecords.filter(isWeekdayWorked).length,
      holiday: monthRecords.filter((record) => record.status === "festivo-trabajado").length,
      vacation: monthRecords.filter((record) => record.status === "vacaciones").length,
      leave: monthRecords.filter((record) => record.status === "baja").length,
      personal: monthRecords.filter((record) => record.status === "asuntos-propios").length
      ,extension: monthRecords.filter((record) => record.status === "ampliaciones").length
      ,extra: monthRecords.reduce((sum, record) => sum + routeExtraHours(record), 0)
    };
    const total = values.worked + values.holiday + values.vacation + values.leave + values.personal + values.extension;
    return `<div class="month-row"><span class="month-name">${month.slice(0, 3)}</span><div class="month-track" aria-label="${month}: ${total} días y ${values.extra} horas extra"><span class="month-bar bar-worked" style="--bar-size:${values.worked}"></span><span class="month-bar bar-holiday" style="--bar-size:${values.holiday}"></span><span class="month-bar bar-vacation" style="--bar-size:${values.vacation}"></span><span class="month-bar bar-leave" style="--bar-size:${values.leave}"></span><span class="month-bar bar-personal" style="--bar-size:${values.personal}"></span><span class="month-bar bar-extension" style="--bar-size:${values.extension}"></span><span class="month-bar bar-extra" style="--bar-size:${values.extra}"></span></div><strong class="month-total">${total} + ${values.extra} h</strong></div>`;
  }).join("");
  const monthlyTotals = months.map((month, monthIndex) => records.filter((record) => record.month === monthIndex).length);
  const totalDays = monthlyTotals.reduce((sum, value) => sum + value, 0);
  let startAngle = 0;
  const fanColors = ["#2f6fed", "#e09a2d", "#0f9d8a", "#d9534f", "#8b5cf6", "#5367b8", "#e06b3c", "#2f9e44", "#d6336c", "#7950f2", "#1098ad", "#f08c00"];
  const fanSegments = monthlyTotals.map((value, index) => {
    const endAngle = totalDays ? startAngle + (value / totalDays) * 360 : startAngle;
    const segment = `${fanColors[index]} ${startAngle}deg ${endAngle}deg`;
    startAngle = endAngle;
    return segment;
  });
  $("#fanChart").style.background = totalDays ? `conic-gradient(${fanSegments.join(",")})` : "var(--line)";
  $("#fanTotal").textContent = totalDays;
  $("#fanLabels").innerHTML = months.map((month, index) => `<span style="--fan-color:${fanColors[index]}">${month.slice(0, 3)} ${monthlyTotals[index]}</span>`).join("");
  $("#recordRows").innerHTML = records.length
    ? records.map((record) => `<tr><td>${String(record.day).padStart(2, "0")}/${String(record.month + 1).padStart(2, "0")}/${state.year}</td><td><span class="status-pill status-${record.status || "trabajado"}">${escapeHtml(statusLabel(record))}</span></td><td>${escapeHtml(routeDisplayName(record))}</td><td>${escapeHtml(recordEntryTime(record) || "Sin entrada")}</td><td>${escapeHtml(recordExitTime(record) || "Sin salida")}</td><td>${formatWorkedTime(workedMinutes(recordEntryTime(record), recordExitTime(record)))}</td><td>${routeExtraHours(record)} h</td></tr>`).join("")
    : "<tr><td class=\"record-empty\" colspan=\"7\">Todavía no hay registros para este año</td></tr>";
}

function downloadFile(content, fileName, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadRecordCsv() {
  const records = yearRoutes(state.year);
  const rows = [["Fecha", "Estado", "Destino", "Entrada", "Salida", "Tiempo trabajado", "Horas extra"], ...records.map((record) => [
    `${String(record.day).padStart(2, "0")}/${String(record.month + 1).padStart(2, "0")}/${state.year}`,
    statusLabel(record),
    routeDisplayName(record),
    recordEntryTime(record) || "Sin entrada",
    recordExitTime(record) || "Sin salida",
    formatWorkedTime(workedMinutes(recordEntryTime(record), recordExitTime(record))),
    routeExtraHours(record)
  ])];
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n")}`;
  downloadFile(csv, `expediente-${state.year}.csv`, "text/csv;charset=utf-8");
  showToast("CSV descargado");
}

function downloadRecordPdf() {
  const records = yearRoutes(state.year);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Permite las ventanas emergentes para crear el PDF");
    return;
  }
  const rows = records.map((record) => `<tr><td>${String(record.day).padStart(2, "0")}/${String(record.month + 1).padStart(2, "0")}/${state.year}</td><td>${escapeHtml(statusLabel(record))}</td><td>${escapeHtml(routeDisplayName(record))}</td><td>${escapeHtml(recordEntryTime(record) || "Sin entrada")}</td><td>${escapeHtml(recordExitTime(record) || "Sin salida")}</td><td>${formatWorkedTime(workedMinutes(recordEntryTime(record), recordExitTime(record)))}</td><td>${routeExtraHours(record)} h</td></tr>`).join("");
  printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Expediente ${state.year}</title><style>body{font-family:Arial,sans-serif;color:#17211f;padding:32px}h1{font-size:24px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #d9e2dc;text-align:left}th{font-size:11px;text-transform:uppercase;color:#60736a}@media print{body{padding:0}}</style></head><body><h1>Expediente de ${state.year}</h1><p>Memoria laboral</p><table><thead><tr><th>Fecha</th><th>Estado</th><th>Destino</th><th>Horario</th><th>Tiempo trabajado</th><th>Horas extra</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Sin registros</td></tr>'}</tbody></table></body></html>`);
  printWindow.document.close();
  printWindow.addEventListener("load", () => printWindow.print());
  showToast("Elige “Guardar como PDF” en la ventana de impresión");
}

function shareRecordSummary() {
  const records = yearRoutes(state.year);
  const counts = records.reduce((result, record) => {
    const status = record.status || "trabajado";
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  const totalExtraHours = records.reduce((sum, record) => sum + routeExtraHours(record), 0);
  const summary = `Expediente ${state.year}\nTrabajados: ${counts.trabajado || 0}\nFestivos trabajados: ${counts["festivo-trabajado"] || 0}\nBajas: ${counts.baja || 0}\nAsuntos propios: ${counts["asuntos-propios"] || 0}\nVacaciones: ${counts.vacaciones || 0}\nHoras extra: ${totalExtraHours}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank", "noopener");
}

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[character]));
}

function renderCalendar() {
  loadRoutes();
  calendarGrid.classList.remove("month-enter");
  void calendarGrid.offsetWidth;
  calendarGrid.classList.add("month-enter");
  calendarGrid.innerHTML = "";
  $("#calendarTitle").textContent = `${localizedMonth(state.month)} ${state.year}`;
  $("#stampMonth").textContent = localizedMonth(state.month).toUpperCase();
  $("#stampYear").textContent = state.year;

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const today = new Date();

  for (let index = 0; index < offset; index += 1) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day-cell is-empty";
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const route = state.routes[day];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-cell";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${dateLabel(day)}${route ? `, ${routeDisplayName(route)}${route.time ? ` a las ${route.time}` : ""}` : ""}`);
    const dayOfWeek = new Date(state.year, state.month, day).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      button.classList.add("is-weekend");
    }
    if (route) {
      button.classList.add("has-route");
      button.classList.add(`route-${routeTypes[route.type] ? route.type : "ruta"}`);
      button.classList.add(`status-${route.status || "trabajado"}`);
    }
    if (isHoliday(day)) button.classList.add("is-holiday");

    if (today.getDate() === day && today.getMonth() === state.month && today.getFullYear() === state.year) {
      button.classList.add("is-today");
    }
    if (state.selected === day) {
      button.classList.add("is-selected");
    }

    button.innerHTML = `<span class="day-number">${day}</span>`;
    if (isHoliday(day)) button.innerHTML += `<span class="holiday-label">${escapeHtml(holidayLabel(day))}</span>`;
    if (route) {
      button.innerHTML += `<span class="route-dot" aria-hidden="true"></span><span class="route-preview">${escapeHtml(routeDisplayName(route))}</span><span class="route-time">${route.time || statusLabel(route)}</span>`;
    }
    button.addEventListener("click", () => selectDay(day));
    calendarGrid.appendChild(button);
  }

  const cellCount = offset + daysInMonth;
  const trailingCells = (7 - (cellCount % 7)) % 7;
  for (let index = 0; index < trailingCells; index += 1) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day-cell is-empty";
    calendarGrid.appendChild(emptyCell);
  }

  $("#footerGroup").textContent = groupInput.value.trim()
    ? `Grupo ${groupInput.value.trim()}`
    : "Grupo sin asignar";
  updateMonthSummary();
  renderAnnualSummary();
  drawAgendaCanvas();
}

function selectDay(day) {
  state.selected = day;
  previewDaySelect.value = String(day);
  routeManager.open = true;
  calendarGrid.querySelectorAll("button").forEach((button) => button.classList.remove("is-selected"));
  const selectedButton = [...calendarGrid.querySelectorAll("button")]
    .find((button) => button.querySelector(".day-number")?.textContent === String(day));
  selectedButton?.classList.add("is-selected");

  const rememberedRoute = loadRememberedRoute();
  const route = state.routes[day] || (rememberedRoute ? { ...rememberedRoute, reminder: 30 } : { destination: "", time: "", type: "", reminder: 30, status: "trabajado", shift: "completa", exit: "", alarm: true });
  $("#selectedDayBadge").textContent = day;
  $("#editorTitle").textContent = `Día ${day}`;
  $("#routeDate").textContent = dateLabel(day);
  $("#destinationInput").value = route.destination;
  $("#typeInput").value = route.type || "";
  $("#timeInput").value = route.actualEntry || route.plannedTime || route.time || "";
  $("#timeInput").dataset.punch = route.actualEntry ? "true" : "false";
  syncClockParts($("#timeInput"), entryHourInput, entryMinuteInput);
  shiftInput.value = route.shift || "completa";
  exitInput.value = route.actualExit || route.plannedExit || route.exit || "";
  exitInput.dataset.punch = route.actualExit ? "true" : "false";
  syncClockParts(exitInput, exitHourInput, exitMinuteInput);
  exitInput.dataset.manual = route.exitManual === true ? "true" : "false";
  autoFillExit();
  updateWorkDuration();
  updateExtraHoursUi(route);
  reminderInput.value = String(route.reminder ?? 30);
  const selectedDate = new Date(state.year, state.month, day);
  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
  statusInput.value = isHoliday(day) || isWeekend ? "festivo-trabajado" : (route.status || "trabajado");
  alarmInput.checked = route.alarm !== false;
  $("#routeForm").hidden = false;
  $("#emptyState").hidden = true;
  $("#editorHint").hidden = true;
  $("#destinationInput").focus();
  drawAgendaCanvas();
  translatePage();
}

function selectCanvasDay(event) {
  const rect = agendaCanvas.getBoundingClientRect();
  const scaleX = agendaCanvas.width / rect.width;
  const scaleY = agendaCanvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const margin = 72;
  const gridTop = 470;
  const gridGap = 14;
  const cellWidth = (1600 - margin * 2 - gridGap * 6) / 7;
  const cellHeight = 112;
  if (x < margin || y < gridTop) return;
  const column = Math.floor((x - margin) / (cellWidth + gridGap));
  const row = Math.floor((y - gridTop) / (cellHeight + gridGap));
  if (column > 6 || row < 0 || row > 5) return;
  const cellX = margin + column * (cellWidth + gridGap);
  const cellY = gridTop + row * (cellHeight + gridGap);
  if (x > cellX + cellWidth || y > cellY + cellHeight) return;
  const firstDay = new Date(state.year, state.month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const day = row * 7 + column - offset + 1;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  if (day >= 1 && day <= daysInMonth) selectDay(day);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function nativeAndroid() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

async function scheduleAlarm(day, route) {
  if (!nativeAndroid() || !route.alarm || !route.time || ["baja", "asuntos-propios", "descanso"].includes(route.status)) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") {
      showToast("Permiso de alarmas no concedido");
      return;
    }
    const [hour, minute] = route.time.split(":").map(Number);
    const at = new Date(state.year, state.month, day, hour, minute);
    at.setMinutes(at.getMinutes() - Number(route.reminder || 0));
    if (at <= new Date()) {
      showToast("La hora elegida ya ha pasado");
      return;
    }
    const id = state.year * 10000 + (state.month + 1) * 100 + day;
    await LocalNotifications.cancel({ notifications: [{ id }] });
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: "Memoria laboral · Recordatorio de jornada",
        body: `${route.destination} · entrada a las ${route.time}${Number(route.reminder || 0) ? ` · aviso ${route.reminder} min antes` : ""}`,
        schedule: { at },
        sound: "default"
      }]
    });
    showToast("Alarma programada en Android");
  } catch (error) {
    console.error("No se pudo programar la alarma", error);
    showToast("No se pudo programar la alarma");
  }
}

async function cancelAlarm(day) {
  if (!nativeAndroid()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const id = state.year * 10000 + (state.month + 1) * 100 + day;
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (error) {
    console.error("No se pudo cancelar la alarma", error);
  }
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((currentLine, index) => context.fillText(currentLine, x, y + index * lineHeight));
}

function drawAgendaCanvas() {
  const canvas = $("#agendaCanvas");
  const context = canvas.getContext("2d");
  const agendaBackground = currentAgendaBackground();
  const width = 1600;
  const height = 1320;
  const margin = 72;
  const gridTop = 470;
  const gridGap = 14;
  const cellWidth = (width - margin * 2 - gridGap * 6) / 7;
  const cellHeight = 112;
  canvas.width = width;
  canvas.height = height;

  if (backgroundToggle.checked && agendaBackground.complete && agendaBackground.naturalWidth) {
    const scale = Math.max(width / agendaBackground.naturalWidth, height / agendaBackground.naturalHeight);
    const imageWidth = agendaBackground.naturalWidth * scale;
    const imageHeight = agendaBackground.naturalHeight * scale;
    context.drawImage(
      agendaBackground,
      (width - imageWidth) / 2,
      (height - imageHeight) / 2,
      imageWidth,
      imageHeight
    );
    context.fillStyle = "rgba(245,247,243,.26)";
    context.fillRect(0, 0, width, height);
  } else if (!backgroundToggle.checked) {
    context.fillStyle = backgroundColorInput.value;
    context.fillRect(0, 0, width, height);
  }

  const headerX = margin - 18;
  const drawPanel = (x, y, panelWidth, panelHeight, fill, stroke) => {
    context.fillStyle = fill;
    context.beginPath();
    context.roundRect(x, y, panelWidth, panelHeight, 16);
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
  };
  drawPanel(headerX, 46, 900, 100, "rgba(23,33,31,.94)", "rgba(255,255,255,.35)");
  drawPanel(headerX, 166, 560, 64, "rgba(242,125,101,.94)", "rgba(255,255,255,.72)");
  const groupName = groupInput.value.trim();
  const hasGroup = Boolean(groupName);
  if (hasGroup) {
    drawPanel(headerX, 236, 300, 32, "rgba(32,124,98,.92)", "rgba(255,255,255,.7)");
  }
  context.fillStyle = "#17211f";
  context.fillRect(0, 0, width, 17);
  context.fillStyle = "#ffffff";
  context.font = "700 44px Arial";
  context.fillText("Memoria laboral", margin + 28, 101);
  context.fillStyle = "#ccefe1";
  context.font = "700 18px Arial";
  context.fillText(currentLanguage === "en" ? "WORK CALENDAR" : "CALENDARIO DE RUTAS", margin + 28, 132);
  context.fillStyle = "#17211f";
  context.font = "700 58px Arial";
  context.fillText(`${months[state.month]} ${state.year}`, margin, 218);
  if (hasGroup) {
    context.fillStyle = "#ffffff";
    context.font = "500 20px Arial";
    context.fillText(`Grupo ${groupName}`, margin, 260);
  }

  const weekdays = localizedWeekdays[currentLanguage] || localizedWeekdays.es;
  const weekdayY = hasGroup ? 432 : 398;
  const weekdayHeight = 30;
  context.textAlign = "center";
  context.font = "700 15px Arial";
  weekdays.forEach((day, index) => {
    const x = margin + index * (cellWidth + gridGap);
    context.fillStyle = "rgba(32,124,98,.52)";
    context.beginPath();
    context.roundRect(x, weekdayY, cellWidth, weekdayHeight, 8);
    context.shadowColor = "rgba(23,33,31,.16)";
    context.shadowBlur = 6;
    context.shadowOffsetY = 3;
    context.fill();
    context.strokeStyle = "rgba(32,124,98,.72)";
    context.lineWidth = 1.5;
    context.stroke();
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.fillStyle = "#ffffff";
    context.fillText(day, x + cellWidth / 2, weekdayY + 20);
  });
  context.textAlign = "left";

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const position = offset + day - 1;
    const column = position % 7;
    const row = Math.floor(position / 7);
    const x = margin + column * (cellWidth + gridGap);
    const y = gridTop + row * (cellHeight + gridGap);
    const route = state.routes[day];
    const isWeekend = column >= 5;
    const holiday = isHoliday(day);

    const cellColor = holiday ? "#fff0c9" : (isWeekend ? calendarColor("--weekend-color", "#e4f2ff") : calendarColor("--weekday-color", "#ffffff"));
    context.fillStyle = cellColor;
    context.beginPath();
    context.roundRect(x, y, cellWidth, cellHeight, 10);
    context.shadowColor = "rgba(23,33,31,.22)";
    context.shadowBlur = 10;
    context.shadowOffsetY = 5;
    context.fill();
    context.strokeStyle = isWeekend ? "rgba(36,108,174,.82)" : "#e2e9e3";
    context.lineWidth = 2;
    context.stroke();
    if (state.selected === day) {
      context.strokeStyle = "#f27d65";
      context.lineWidth = 5;
      context.stroke();
    }
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.fillStyle = holiday || isWeekend ? "#ffffff" : "#17211f";
    context.font = "700 22px Arial";
    context.fillText(String(day), x + 17, y + 29);

    if (route) {
      context.fillStyle = routeColor(route);
      context.font = "700 19px Arial";
      drawWrappedText(context, routeDisplayName(route), x + 17, y + 62, cellWidth - 34, 24);
      context.fillStyle = holiday || isWeekend ? "#ffffff" : "#40534b";
      context.font = "700 17px Arial";
      context.fillText(route.time ? `${route.time}${route.exit ? ` - ${route.exit}` : ""}` : statusLabel(route), x + 17, y + 103);
      context.fillStyle = "#f27d65";
      context.beginPath();
      context.arc(x + cellWidth - 21, y + 20, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  const rows = Math.ceil((offset + daysInMonth) / 7);
  context.fillStyle = "#71807a";
  context.font = "500 15px Arial";
  context.fillText(currentLanguage === "en" ? "Calendar generated with Work Memory" : "Calendario generado con Memoria laboral", margin, gridTop + rows * (cellHeight + gridGap) + 28);

  return canvas;
}

function encodeSharedAgenda(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeSharedAgenda(encoded) {
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((encoded.length + 3) % 4);
  const binary = atob(normalized);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))));
}

function encodeBytes(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBytes(encoded) {
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((encoded.length + 3) % 4);
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

async function deriveSharedKey(salt) {
  const password = Uint8Array.from(atob("bWVtb3JpYWxhYm9yYWw="), (character) => character.charCodeAt(0));
  const material = await crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptSharedAgenda(payload) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSharedKey(salt);
  const base64Payload = encodeSharedAgenda(payload);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(base64Payload));
  return `ml2.${encodeBytes(salt)}.${encodeBytes(iv)}.${encodeBytes(encrypted)}`;
}

async function decodeSharedAgendaSecure(encoded) {
  if (!encoded.startsWith("ml2.")) return decodeSharedAgenda(encoded);
  const [, saltEncoded, ivEncoded, encryptedEncoded] = encoded.split(".");
  const key = await deriveSharedKey(decodeBytes(saltEncoded));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBytes(ivEncoded) }, key, decodeBytes(encryptedEncoded));
  return decodeSharedAgenda(new TextDecoder().decode(decrypted));
}

function sharedMonthPayload() {
  const routes = Object.fromEntries(Object.entries(state.routes).map(([day, route]) => [day, {
    destination: route.destination || "",
    type: route.type || "",
    time: route.plannedTime || route.time || "",
    exit: route.plannedExit || route.exit || addHoursToTime(route.plannedTime || route.time || "", route.shift === "media" ? 4 : route.shift === "continua" ? 7 : 8),
    shift: route.shift || "completa",
    status: route.status || "trabajado",
    extraHours: routeExtraHours(route),
    reminder: Number(route.reminder || 0),
    ...(sharePunchesToggle.checked ? { actualEntry: route.actualEntry || "", actualExit: route.actualExit || "" } : {})
  }]));
  return { app: "memoria-laboral", version: 3, month: state.month, year: state.year, group: groupInput.value.trim(), theme: themeSelect.value, weekdayColor: weekdayColorInput.value, weekendColor: weekendColorInput.value, background: shareBackgroundToggle.checked ? customBackgroundData[state.month] : null, routes, customHolidays: customHolidays.filter((holiday) => holiday.date.startsWith(`${state.year}-${String(state.month + 1).padStart(2, "0")}-`)) };
}

async function shareMonthAgenda() {
  const encoded = await encryptSharedAgenda(sharedMonthPayload());
  const link = nativeAndroid()
    ? `memoria-laboral://import?data=${encodeURIComponent(encoded)}`
    : `${window.location.origin}${window.location.pathname}#agenda=${encoded}`;
  const message = `Memoria laboral · ${months[state.month]} ${state.year}\nAbre este enlace para importar la agenda del mes:\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  showToast("Enlace del mes preparado para WhatsApp");
}

async function importSharedAgenda(encodedFromApp = null) {
  const match = window.location.hash.match(/^#agenda=(.+)$/);
  const encoded = encodedFromApp || match?.[1];
  if (!encoded) return;
  try {
    const payload = await decodeSharedAgendaSecure(encoded);
    if (payload.app !== "memoria-laboral" || !Number.isInteger(payload.month) || !Number.isInteger(payload.year)) throw new Error("Enlace no válido");
    const monthName = months[payload.month] || "mes";
    if (window.confirm(`¿Importar la agenda de ${monthName} ${payload.year}? Tus huellas y registros de entrada/salida no se compartirán.`)) {
      localStorage.setItem(`limasam-${payload.year}-${payload.month}`, JSON.stringify(payload.routes || {}));
      if (Array.isArray(payload.customHolidays)) {
        customHolidays.splice(0, customHolidays.length, ...customHolidays.filter((holiday) => !holiday.date.startsWith(`${payload.year}-${String(payload.month + 1).padStart(2, "0")}-`)), ...payload.customHolidays);
        localStorage.setItem(customHolidayKey, JSON.stringify(customHolidays));
      }
      if (payload.background) {
        customBackgroundData[payload.month] = payload.background;
        const sharedImage = new Image();
        sharedImage.src = payload.background;
        customAgendaBackgrounds[payload.month] = sharedImage;
        localStorage.setItem(customBackgroundKey, JSON.stringify(customBackgroundData));
        sharedImage.addEventListener("load", () => drawAgendaCanvas());
      }
      state.month = payload.month;
      state.year = payload.year;
      groupInput.value = payload.group || "";
      if (payload.weekdayColor) {
        weekdayColorInput.value = payload.weekdayColor;
        document.documentElement.style.setProperty("--weekday-color", payload.weekdayColor);
        localStorage.setItem("limasam-weekday-color", payload.weekdayColor);
      }
      if (payload.weekendColor) {
        weekendColorInput.value = payload.weekendColor;
        document.documentElement.style.setProperty("--weekend-color", payload.weekendColor);
        localStorage.setItem("limasam-weekend-color", payload.weekendColor);
      }
      if (["light", "dark", "night"].includes(payload.theme)) {
        themeSelect.value = payload.theme;
        document.body.classList.toggle("dark-mode", payload.theme === "dark");
        document.body.classList.toggle("night-mode", payload.theme === "night");
        localStorage.setItem("limasam-theme", payload.theme);
      }
      monthSelect.value = state.month;
      yearInput.value = state.year;
      renderPreviewDayOptions();
      updateShareBackgroundOption();
      renderHolidayList();
      renderCalendar();
      selectDay(1);
      showToast("Agenda mensual importada");
    }
  } catch {
    showToast("El enlace de agenda no es válido");
  } finally {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function listenNativeAgendaLinks() {
  if (!nativeAndroid()) return;
  const { App } = await import("@capacitor/app");
  App.addListener("appUrlOpen", ({ url }) => {
    try {
      const parsed = new URL(url);
      const encoded = parsed.searchParams.get("data");
      if (parsed.protocol === "memoria-laboral:" && parsed.hostname === "import" && encoded) importSharedAgenda(encoded);
    } catch {
      showToast("El enlace de agenda no es válido");
    }
  });
}

function downloadPng() {
  const canvas = drawAgendaCanvas();
  const link = document.createElement("a");
  link.download = `limasam-${months[state.month].toLowerCase()}-${state.year}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("PNG descargado correctamente");
}

monthSelect.addEventListener("change", () => {
  state.month = Number(monthSelect.value);
  state.selected = null;
  renderPreviewDayOptions();
  updateShareBackgroundOption();
  renderCalendar();
});
yearInput.addEventListener("change", () => {
  const year = Number(yearInput.value);
  if (year >= 2000 && year <= 2100) {
    state.year = year;
    state.selected = null;
    renderPreviewDayOptions();
    renderCalendar();
    renderHolidayList();
  }
});
$("#addHolidayButton").addEventListener("click", () => {
  const date = holidayDateInput.value;
  const name = holidayNameInput.value.trim();
  if (!date || !name) {
    showToast("Indica una fecha y un nombre para el festivo");
    return;
  }
  const existingIndex = customHolidays.findIndex((holiday) => holiday.date === date);
  const holiday = { date, name };
  if (existingIndex >= 0) customHolidays[existingIndex] = holiday;
  else customHolidays.push(holiday);
  localStorage.setItem(customHolidayKey, JSON.stringify(customHolidays));
  driveChangesPending = true;
  updateSyncUi();
  queueDriveSync();
  renderHolidayList();
  renderCalendar();
  holidayNameInput.value = "";
  showToast("Festivo guardado");
});
holidayList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".holiday-remove");
  if (!removeButton) return;
  const index = customHolidays.findIndex((holiday) => holiday.date === removeButton.dataset.date);
  if (index < 0) return;
  customHolidays.splice(index, 1);
  localStorage.setItem(customHolidayKey, JSON.stringify(customHolidays));
  driveChangesPending = true;
  updateSyncUi();
  queueDriveSync();
  renderHolidayList();
  renderCalendar();
  showToast("Festivo eliminado");
});
groupInput.addEventListener("input", renderCalendar);
previewDaySelect.addEventListener("change", () => selectDay(Number(previewDaySelect.value)));
const syncEntryClock = () => {
  syncTimeInput($("#timeInput"), entryHourInput, entryMinuteInput);
  $("#timeInput").dataset.punch = "false";
  autoFillExit();
  updateWorkDuration();
};
entryHourInput.addEventListener("change", syncEntryClock);
entryMinuteInput.addEventListener("change", syncEntryClock);
const syncExitClock = () => {
  syncTimeInput(exitInput, exitHourInput, exitMinuteInput);
  exitInput.dataset.punch = "false";
  exitInput.dataset.manual = "true";
  updateWorkDuration();
};
exitHourInput.addEventListener("change", syncExitClock);
exitMinuteInput.addEventListener("change", syncExitClock);
$("#timeInput").addEventListener("change", () => { $("#timeInput").dataset.punch = "false"; autoFillExit(); });
$("#timeInput").addEventListener("change", updateWorkDuration);
shiftInput.addEventListener("change", () => {
  exitInput.dataset.manual = "false";
  autoFillExit();
  updateWorkDuration();
});
exitInput.addEventListener("change", () => {
  exitInput.dataset.punch = "false";
  exitInput.dataset.manual = "true";
  updateWorkDuration();
});
agendaCanvas.addEventListener("click", selectCanvasDay);
backgroundToggle.addEventListener("change", () => {
  localStorage.setItem("limasam-show-background", String(backgroundToggle.checked));
  updateBackgroundOptions();
  drawAgendaCanvas();
});
backgroundColorInput.addEventListener("input", () => {
  localStorage.setItem("limasam-background-color", backgroundColorInput.value);
  drawAgendaCanvas();
});
themeSelect.addEventListener("change", () => {
  const isDark = themeSelect.value === "dark";
  const isNight = themeSelect.value === "night";
  document.body.classList.toggle("dark-mode", isDark);
  document.body.classList.toggle("night-mode", isNight);
  localStorage.setItem("limasam-theme", themeSelect.value);
  localStorage.setItem("limasam-dark-mode", String(isDark || isNight));
});
soundToggle.addEventListener("change", () => {
  localStorage.setItem("limasam-sounds", String(soundToggle.checked));
  if (soundToggle.checked) playSavedMelody();
});
weekdayColorInput.addEventListener("input", () => {
  document.documentElement.style.setProperty("--weekday-color", weekdayColorInput.value);
  localStorage.setItem("limasam-weekday-color", weekdayColorInput.value);
  drawAgendaCanvas();
});
weekendColorInput.addEventListener("input", () => {
  document.documentElement.style.setProperty("--weekend-color", weekendColorInput.value);
  localStorage.setItem("limasam-weekend-color", weekendColorInput.value);
  drawAgendaCanvas();
});
backgroundFiles.addEventListener("change", async () => {
  const files = [...backgroundFiles.files].slice(0, months.length);
  if (!files.length) return;
  try {
    const sources = await Promise.all(files.map(readImage));
    const startIndex = sources.length === 1 ? state.month : 0;
    if (sources.length > 1) {
      customBackgroundData.fill(null);
      customAgendaBackgrounds.fill(null);
    }
    sources.forEach((source, index) => {
      const monthIndex = startIndex + index;
      if (monthIndex >= months.length) return;
      customBackgroundData[monthIndex] = source;
      const image = new Image();
      image.src = source;
      image.addEventListener("load", () => drawAgendaCanvas());
      customAgendaBackgrounds[monthIndex] = image;
    });
    localStorage.setItem(customBackgroundKey, JSON.stringify(customBackgroundData));
    updateShareBackgroundOption();
    drawAgendaCanvas();
    showToast(`${sources.length} imagen${sources.length === 1 ? "" : "es"} personalizada${sources.length === 1 ? "" : "s"}`);
  } catch {
    showToast("No se pudieron cargar las imágenes");
  }
});
backgroundReset.addEventListener("click", () => {
  customBackgroundData.fill(null);
  customAgendaBackgrounds.fill(null);
  localStorage.removeItem(customBackgroundKey);
  backgroundFiles.value = "";
  updateShareBackgroundOption();
  drawAgendaCanvas();
  showToast("Fondos predeterminados restaurados");
});

driveButton.addEventListener("click", connectGoogleDrive);
syncNowButton.addEventListener("click", syncNow);
pdfButton.addEventListener("click", downloadRecordPdf);
csvButton.addEventListener("click", downloadRecordCsv);
shareRecordButton.addEventListener("click", shareRecordSummary);
driveLogoutButton.addEventListener("click", disconnectGoogleDrive);
recordButton.addEventListener("click", () => {
  recordCard.hidden = !recordCard.hidden;
  document.body.classList.toggle("record-view", !recordCard.hidden);
  recordButton.textContent = recordCard.hidden ? "Ver expediente" : "Ocultar expediente";
  if (!recordCard.hidden) renderAnnualSummary();
});
document.querySelectorAll(".record-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".record-tab").forEach((item) => item.classList.toggle("is-active", item === tab));
    const selectedPanel = tab.dataset.recordTab;
    document.querySelectorAll(".record-tab-panel").forEach((panel) => {
      const active = panel.id === `record${selectedPanel[0].toUpperCase()}${selectedPanel.slice(1)}Tab`;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  });
});
document.querySelectorAll(".chart-view-button").forEach((button) => {
  button.addEventListener("click", () => {
    const fan = button.dataset.chartView === "fan";
    const chart = document.querySelector(".annual-chart");
    chart.classList.toggle("is-fan", fan);
    document.querySelectorAll(".chart-view-button").forEach((item) => item.classList.toggle("is-active", item === button));
    $("#fanChart").hidden = !fan;
    $("#fanLabels").hidden = !fan;
  });
});
extraHoursMinus.addEventListener("click", () => changeExtraHours(-1));
extraHoursPlus.addEventListener("click", () => changeExtraHours(1));
entryNowButton.addEventListener("click", () => registerCurrentTime("entry"));
exitNowButton.addEventListener("click", () => registerCurrentTime("exit"));

$("#routeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedDay = state.selected;
  const existingRoute = state.routes[selectedDay] || {};
  const destination = $("#destinationInput").value.trim();
  const time = $("#timeInput").value;
  const exit = exitInput.value;
  const status = statusInput.value;
  if (!destination && status === "trabajado") {
    $("#destinationInput").focus();
    showToast("Escribe un destino para guardar la ruta");
    return;
  }
  if (time && !validTime(time)) {
    $("#timeInput").focus();
    showToast("La entrada debe tener formato HH:MM");
    return;
  }
  if (exit && !validTime(exit)) {
    exitInput.focus();
    showToast("La salida debe tener formato HH:MM");
    return;
  }
  const actualEntry = $("#timeInput").dataset.punch === "true" ? time : existingRoute.actualEntry || "";
  const actualExit = exitInput.dataset.punch === "true" ? exit : existingRoute.actualExit || "";
  const plannedTime = $("#timeInput").dataset.punch === "true" ? existingRoute.plannedTime || existingRoute.time || "" : time;
  const plannedExit = exitInput.dataset.punch === "true" ? existingRoute.plannedExit || existingRoute.exit || "" : exit;
  state.routes[selectedDay] = {
    destination,
    time: actualEntry || plannedTime,
    type: $("#typeInput").value,
    shift: shiftInput.value,
    exit: actualExit || plannedExit,
    plannedTime,
    plannedExit,
    actualEntry,
    actualExit,
    workedMinutes: workedMinutes(time, exit),
    exitManual: exitInput.dataset.manual === "true",
    extraHours: Number(extraHoursValue.textContent) || 0,
    reminder: Number(reminderInput.value),
    status,
    alarm: alarmInput.checked
  };
  unmarkRouteDeleted(selectedDay);
  saveRememberedRoute(state.routes[selectedDay]);
  saveRoutes();
  renderCalendar();
  selectDay(selectedDay);
  await scheduleAlarm(selectedDay, state.routes[selectedDay]);
  playSavedMelody();
  showToast("Ruta guardada");
});

$("#clearRememberedButton").addEventListener("click", () => {
  if (!window.confirm("¿Quieres borrar el recuerdo de la última ruta?")) return;
  localStorage.removeItem(rememberedRouteKey);
  $("#destinationInput").value = "";
  $("#timeInput").value = "";
  shiftInput.value = "completa";
  exitInput.value = "";
  syncClockParts($("#timeInput"), entryHourInput, entryMinuteInput);
  syncClockParts(exitInput, exitHourInput, exitMinuteInput);
  exitInput.dataset.manual = "false";
  showToast("Recuerdo borrado");
});

$("#clearButton").addEventListener("click", async () => {
  const selectedDay = state.selected;
  if (selectedDay && window.confirm("¿Quieres vaciar todos los datos de este día?")) {
    delete state.routes[selectedDay];
    markRouteDeleted(selectedDay);
    saveRoutes();
    renderCalendar();
    selectDay(selectedDay);
    await cancelAlarm(selectedDay);
    showToast("Día vaciado");
  }
});

$("#downloadButton").addEventListener("click", downloadPng);
$("#shareMonthButton").addEventListener("click", shareMonthAgenda);
importSharedAgenda();
listenNativeAgendaLinks();
renderHolidayList();
renderCalendar();
updateShareBackgroundOption();
selectDay(1);
translatePage();
if (driveFileId) recordButton.hidden = false;
$("#shareButton")?.remove();
$(".agenda-preview").appendChild($(".export-actions"));
$(".export-actions").appendChild($(".share-punches-toggle"));
updateSyncUi();
