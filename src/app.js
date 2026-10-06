import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { decryptDriveBackup, encryptDriveBackup } from "./drive-encryption.mjs";
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";
import "@material/web/icon/icon.js";
import "@material/web/button/filled-button.js";

// Catálogos de meses, días, tipos de ruta y estados de la jornada.
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
const localizedCalendarLabels = { es: "CALENDARIO DE RUTAS", en: "ROUTE CALENDAR", fr: "CALENDRIER DES ITINÉRAIRES", it: "CALENDARIO DEI PERCORSI", de: "ROUTENKALENDER" };

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
const workedDayViewColorKey = "limasam-workday-view-color";
const holidayColorKey = "limasam-holiday-color";
const localDriveBackupKey = "limasam-drive-local-backup";
const googleClientId = "129023096829-69s79kbie7pkc43gqf02qr175hhni3jm.apps.googleusercontent.com";
const publicAppUrl = "https://mvisions.github.io/perfect-proyect/";
const driveFileName = "Agenda de trabajos y actividades.json";
const lastSyncKey = "limasam-last-sync";
const driveSessionKey = "limasam-drive-session";
const deletedRoutesKey = "limasam-deleted-routes";
const calendarViewStorageKey = "limasam-calendar-view";

function readDriveSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(driveSessionKey) || "null");
    if (typeof session?.token === "string" && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now()) return session;
  } catch {
    // Session storage may be unavailable in restricted browser contexts.
  }
  try {
    sessionStorage.removeItem(driveSessionKey);
  } catch {
    // Ignore unavailable session storage.
  }
  return null;
}

function persistDriveSession(tokenResponse, token) {
  const expiresIn = Number(tokenResponse?.expires_in);
  const lifetime = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
  const expiresAt = Date.now() + lifetime * 1000;
  try {
    sessionStorage.setItem(driveSessionKey, JSON.stringify({ token, expiresAt }));
  } catch {
    // Keep the current in-memory session if storage is unavailable.
  }
  return expiresAt;
}

function clearDriveSession() {
  try {
    sessionStorage.removeItem(driveSessionKey);
  } catch {
    // Ignore unavailable session storage.
  }
}


// Estado de navegación: mes, año, día seleccionado y rutas cargadas.
const currentDate = new Date();
const state = {
  month: currentDate.getMonth(),
  year: currentDate.getFullYear(),
  selected: null,
  routes: {}
};

const $ = (selector) => document.querySelector(selector);
const mobileViewportQuery = window.matchMedia("(max-width: 760px), (orientation: landscape) and (max-height: 520px)");
const mobileLandscapeQuery = window.matchMedia("(orientation: landscape) and (max-height: 520px)");
const introScreen = document.getElementById("introScreen");
const webWelcomeBanner = document.getElementById("webWelcomeBanner");
const introVideo = document.getElementById("introVideo");
const introPlayButton = document.getElementById("introPlayButton");
const introSkipButton = document.getElementById("introSkipButton");
const introEnableToggle = document.getElementById("introEnableToggle");
const introEnableKey = "limasam-intro-enabled";
const introEnabled = localStorage.getItem(introEnableKey) === "true";
if (introEnableToggle) introEnableToggle.checked = introEnabled;

function finishIntro() {
  if (!introScreen || introScreen.hidden || introScreen.classList.contains("is-leaving")) return;
  introScreen.classList.add("is-leaving");
  window.setTimeout(() => {
    introScreen.hidden = true;
    introVideo?.pause();
  }, 400);
}

function playIntro() {
  if (!introScreen || !introVideo) return;
  introScreen.hidden = false;
  introScreen.classList.remove("is-leaving");
  introVideo.currentTime = 0;
  introVideo.play().then(() => {
    if (introPlayButton) introPlayButton.hidden = true;
  }).catch(() => {
    if (introPlayButton) introPlayButton.hidden = false;
  });
}

introEnableToggle?.addEventListener("change", () => {
  localStorage.setItem(introEnableKey, String(introEnableToggle.checked));
  if (introEnableToggle.checked) playIntro();
  else finishIntro();
});

if (introScreen && introVideo) {
  introVideo.addEventListener("ended", finishIntro);
  introVideo.addEventListener("error", finishIntro);
  introSkipButton?.addEventListener("click", finishIntro);
  introPlayButton?.addEventListener("click", playIntro);
  if (introEnabled) playIntro();
}

// Referencias a los controles del documento para usarlos en toda la aplicación.
const monthSelect = $("#monthSelect");
const yearInput = $("#yearInput");
const groupInput = $("#groupNumber");
const calendarGrid = $("#calendarGrid");
const calendarViewToggle = $("#calendarViewToggle");
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
const backgroundThemeSelect = $("#backgroundThemeSelect");
const backgroundFiles = $("#backgroundFiles");
const backgroundOptions = $("#backgroundOptions");
const solidBackground = $("#solidBackground");
const backgroundColorInput = $("#backgroundColorInput");
const backgroundReset = $("#backgroundReset");
const themeSelect = $("#themeSelect");
const soundToggle = $("#soundToggle");
const languageSelect = $("#languageSelect");
const weekdayColorInput = $("#weekdayColorInput");
const weekendColorInput = $("#weekendColorInput");
const workedDayViewColorInput = $("#workedDayViewColorInput");
const holidayColorInput = $("#holidayColorInput");
const driveButton = $("#driveButton");
const driveButtonLabel = $("#driveButtonLabel");
const topbarAccountActions = $(".topbar-account-actions");
const driveTutorialDialog = $("#driveTutorialDialog");
const driveTutorialClose = $("#driveTutorialClose");
const driveTutorialCancel = $("#driveTutorialCancel");
const driveTutorialContinue = $("#driveTutorialContinue");
const driveLogoutButton = $("#driveLogoutButton");
const syncStatus = $("#syncStatus");
const syncNowButton = $("#syncNowButton");
const pdfButton = $("#pdfButton");
const csvButton = $("#csvButton");
const shareRecordButton = $("#shareRecordButton");
const googleCalendarButton = $("#googleCalendarButton");
const shareBackgroundToggle = $("#shareBackgroundToggle");
const sharePunchesToggle = $("#sharePunchesToggle");
const installButton = $("#installButton");
const updateButton = $("#updateButton");
const updateButtonLabel = $("#updateButtonLabel");
const showQrButton = $("#showQrButton");
const shareQrDialog = $("#shareQrDialog");
const shareQrClose = $("#shareQrClose");
const shareQrImage = $("#shareQrImage");
const offlineStatus = $("#offlineStatus");
const previewDaySelect = $("#previewDaySelect");
const previewMonthYearControls = $("#previewMonthYearControls");
const previousMonthButton = $("#previousMonthButton");
const nextMonthButton = $("#nextMonthButton");
const agendaCanvas = $("#agendaCanvas");
const agendaZoomDialog = $("#agendaZoomDialog");
const agendaZoomCanvas = $("#agendaZoomCanvas");
const agendaZoomClose = $("#agendaZoomClose");
const agendaPreview = $(".agenda-preview");
const introBlock = $(".intro-block");
const formPanel = $(".form-panel");
const preferencesPanel = $(".preferences-panel");
const mobileConfigurationDetails = $(".preferences-panel .advanced-options:not(.help-options)");
const topbarLocaleActions = $(".topbar-locale-actions");
const previousWeekButton = $("#previousWeekButton");
const nextWeekButton = $("#nextWeekButton");
const todayButton = $("#todayButton");
const exportActions = $(".export-actions");
const webSettingsTabs = $(".web-settings-tabs");
const plannerDetails = $(".holiday-manager");
const routeManager = $("#routeManager");
const mobileRouteDialog = $("#mobileRouteDialog");
const mobileRouteDialogClose = $("#mobileRouteDialogClose");
const mobileRouteDialogContent = $("#mobileRouteDialogContent");
const mobileRouteTitle = $("#mobileRouteTitle");
const recordButton = $("#recordButton");
const recordCard = $("#recordCard");
const mobilePageTabs = $("#mobilePageTabs");
const mobileSettingsPage = $("#mobileSettingsPage");
const mobileSettingsControls = $("#mobileSettingsControls");
const mobileSettingsPlanning = $("#mobileSettingsPlanning");
const mobileSettingsPreferences = $("#mobileSettingsPreferences");
const mobileHelpPage = $("#mobileHelpPage");
const mobileHelpContent = $("#mobileHelpContent");
const mobileHelpSection = $(".help-options");
const mobileOrientationHint = $("#mobileOrientationHint");
const monthFieldGroup = monthSelect.closest(".field-group");
const yearFieldGroup = yearInput.closest(".field-group");
const mobileLocaleHome = document.createComment("mobile locale controls home");
const mobileAccountHome = document.createComment("mobile account controls home");
const mobilePreferencesHome = document.createComment("mobile preferences home");
const mobilePlanningHome = document.createComment("mobile planning home");
const mobileHelpHome = document.createComment("mobile help home");
const mobileRouteManagerHome = document.createComment("mobile route manager home");
const monthFieldHome = document.createComment("month field home");
const yearFieldHome = document.createComment("year field home");
topbarLocaleActions.before(mobileLocaleHome);
topbarAccountActions.before(mobileAccountHome);
preferencesPanel.before(mobilePreferencesHome);
plannerDetails.before(mobilePlanningHome);
mobileHelpSection.before(mobileHelpHome);
routeManager.before(mobileRouteManagerHome);
monthFieldGroup.before(monthFieldHome);
yearFieldGroup.before(yearFieldHome);
let mobileLayoutEnabled = false;
let activeMobilePage = "agenda";
let configurationWasOpenBeforeMobile = mobileConfigurationDetails.open;
mobileConfigurationDetails.addEventListener("toggle", () => {
  if (mobileLayoutEnabled && activeMobilePage === "settings" && !mobileConfigurationDetails.open) {
    mobileConfigurationDetails.open = true;
  }
});
const customBackgroundKey = "limasam-custom-backgrounds";
const restoredDriveSession = readDriveSession();
let driveAccessToken = restoredDriveSession?.token || null;
let driveAccessTokenExpiresAt = restoredDriveSession?.expiresAt || 0;
let driveFileId = localStorage.getItem("limasam-drive-file-id");
let driveSyncTimer = null;
let driveChangesPending = false;
let nativeGoogleAuthPromise = null;
const browserAlarmTimers = new Map();
let currentLanguage = localStorage.getItem("limasam-language") || "es";
const availableCalendarViews = ["month", "filled", "week"];
const savedCalendarView = localStorage.getItem(calendarViewStorageKey);
let calendarView = availableCalendarViews.includes(savedCalendarView) ? savedCalendarView : "month";

// Traducciones base para los textos visibles y los controles de la interfaz.
const languagePairs = {
  "Memoria laboral": "Work Log",
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
  "Mostrar tema": "Show theme",
  "Configuración": "Settings",
  "Subir imágenes": "Upload images",
  "Usar fondos predeterminados": "Use default backgrounds",
  "Descargar PNG": "Download PNG",
  "Compartir estructura del mes": "Share month structure",
  "Importar a Google Calendar": "Import to Google Calendar",
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
  "Activar recordatorio": "Enable reminder",
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
  "Tema del fondo": "Background theme",
  "Limpieza viaria": "Street cleaning",
  "Jardinería": "Gardening",
  "Transportes": "Transport",
  "Extraescolares": "After-school activities",
  "Seguridad": "Security",
  "Deportes": "Sports",
  "Animales": "Animals",
  "Planificación mensual": "Monthly planning",
  "Ayuda": "Help",
  "Primeros pasos": "Getting started",
  "Cambia el idioma y el tema desde los selectores superiores. «Instalar app» abre su descarga y «Actualizar» busca una versión nueva.": "Change the language and theme using the selectors above. ‘Install app’ opens its download page, and ‘Update’ checks for a new version.",
  "Registrar una jornada": "Log a workday",
  "Toca un día para editarlo. Añade destino, trabajo, entrada, salida y estado; «Guardar ruta» conserva los cambios. Los botones de huella registran la hora actual y puedes activar un aviso.": "Select a day to edit it. Enter the destination, work type, start and end times, and status; ‘Save route’ keeps your changes. The fingerprint buttons record the current time, and you can enable a reminder.",
  "Vaciar y reutilizar": "Clear and reuse",
  "«Vaciar día» elimina los datos de la fecha seleccionada. «Borrar recuerdo» elimina la última ruta guardada para que no se complete automáticamente en otros días.": "‘Clear day’ removes the selected date’s data. ‘Clear remembered route’ removes the last saved route so it is not filled in automatically on other days.",
  "Configuración y fondos": "Settings and backgrounds",
  "En Configuración puedes activar sonidos, ocultar la introducción, ajustar colores, cambiar fondos temáticos, subir imágenes propias o elegir un color sólido.": "In Settings, enable sounds, hide the introduction, adjust colors, change themed backgrounds, upload your own images, or choose a solid color.",
  "Elige grupo, mes y año, y añade festivos locales. El resumen del calendario cuenta rutas, horas y festivos.": "Choose a group, month, and year, and add local holidays. The calendar summary counts routes, hours, and holidays.",
  "Descargar y compartir": "Download and share",
  "«Descargar PNG» guarda una imagen. «Compartir estructura del mes» crea un enlace para importar sus datos; «Compartir por WhatsApp» comparte la agenda. Las casillas permiten incluir el fondo y las horas fichadas.": "‘Download PNG’ saves an image. ‘Share month structure’ creates a link for importing its data; ‘Share on WhatsApp’ shares the agenda. The checkboxes let you include the background and clocked hours.",
  "Expediente y sincronización": "Records and sync",
  "«Ver expediente» muestra resúmenes, jornadas y gráficos del año. Desde Exportar puedes descargar PDF o CSV, compartir el resumen e importar a Google Calendar. Conectar Google Drive sincroniza tus datos.": "‘View record’ shows yearly summaries, workdays, and charts. From Export, download PDF or CSV, share the summary, or import into Google Calendar. Connect Google Drive to sync your data.",
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
    "Memoria laboral": "Journal de travail", "Planificador mensual": "Planificateur mensuel", "Número de grupo": "Numéro de groupe", Mes: "Mois", Año: "Année", Tema: "Thème", Sonidos: "Sons", "Colores del calendario": "Couleurs du calendrier", Diarios: "Jours ouvrés", "Fines de semana": "Week-ends", "Subir imágenes": "Télécharger des images", "Usar fondos predeterminados": "Utiliser les fonds par défaut", "Descargar PNG": "Télécharger PNG", "Compartir estructura del mes": "Partager la structure du mois", "Gestionar festivos personalizados": "Gérer les jours fériés", Desplegar: "Déployer", "Tema del fondo": "Thème du fond", "Limpieza viaria": "Nettoyage des rues", "Jardinería": "Jardinage", Transportes: "Transports", Extraescolares: "Activités périscolaires", Seguridad: "Sécurité", "Detalle del día": "Détails du jour", Destino: "Destination", "Tipo de trabajo": "Type de travail", "Avisar": "Rappel", "Estado del día": "Statut du jour", Trabajado: "Travaillé", "Festivo trabajado": "Jour férié travaillé", Baja: "Arrêt maladie", Vacaciones: "Congés", Ampliaciones: "Extensions", "Tiempo trabajado": "Temps travaillé", Barras: "Barres", Abanico: "Éventail", "Editar día": "Modifier le jour", "Guardar ruta": "Enregistrer la journée"
  },
  it: {
    "Memoria laboral": "Diario di lavoro", "Planificador mensual": "Pianificatore mensile", "Número de grupo": "Numero gruppo", Mes: "Mese", Año: "Anno", Tema: "Tema", Sonidos: "Suoni", "Colores del calendario": "Colori del calendario", Diarios: "Giorni lavorativi", "Fines de semana": "Fine settimana", "Subir imágenes": "Carica immagini", "Usar fondos predeterminados": "Usa sfondi predefiniti", "Descargar PNG": "Scarica PNG", "Compartir estructura del mes": "Condividi struttura del mese", "Gestionar festivos personalizados": "Gestisci festività personalizzate", Desplegar: "Espandi", "Tema del fondo": "Tema dello sfondo", "Limpieza viaria": "Pulizia stradale", "Jardinería": "Giardinaggio", Transportes: "Trasporti", Extraescolares: "Attività extrascolastiche", Seguridad: "Sicurezza", "Detalle del día": "Dettagli del giorno", Destino: "Destinazione", "Tipo de trabajo": "Tipo di lavoro", "Avisar": "Promemoria", "Estado del día": "Stato del giorno", Trabajado: "Lavorato", "Festivo trabajado": "Festivo lavorato", Baja: "Malattia", Vacaciones: "Ferie", Ampliaciones: "Estensioni", "Tiempo trabajado": "Tempo lavorato", Barras: "Barre", Abanico: "Ventaglio", "Editar día": "Modifica giorno", "Guardar ruta": "Salva giornata"
  },
  de: {
    "Memoria laboral": "Arbeitsprotokoll", "Planificador mensual": "Monatsplaner", "Número de grupo": "Gruppennummer", Mes: "Monat", Año: "Jahr", Tema: "Thema", Sonidos: "Töne", "Colores del calendario": "Kalenderfarben", Diarios: "Werktage", "Fines de semana": "Wochenenden", "Subir imágenes": "Bilder hochladen", "Usar fondos predeterminados": "Standardhintergründe verwenden", "Descargar PNG": "PNG herunterladen", "Compartir estructura del mes": "Monatsstruktur teilen", "Gestionar festivos personalizados": "Eigene Feiertage verwalten", Desplegar: "Ausklappen", "Tema del fondo": "Hintergrundthema", "Limpieza viaria": "Straßenreinigung", "Jardinería": "Gartenpflege", Transportes: "Verkehr", Extraescolares: "Außerschulische Aktivitäten", Seguridad: "Sicherheit", "Detalle del día": "Tagesdetails", Destino: "Ziel", "Tipo de trabajo": "Arbeitsart", "Avisar": "Erinnerung", "Estado del día": "Tagesstatus", Trabajado: "Gearbeitet", "Festivo trabajado": "Gearbeiteter Feiertag", Baja: "Krankheit", Vacaciones: "Urlaub", Ampliaciones: "Erweiterungen", "Tiempo trabajado": "Arbeitszeit", Barras: "Balken", Abanico: "Fächer", "Editar día": "Tag bearbeiten", "Guardar ruta": "Tag speichern"
  }
};
Object.assign(languageTranslations.fr, { Deportes: "Sports", Animales: "Animaux" });
Object.assign(languageTranslations.it, { Deportes: "Sport", Animales: "Animali" });
Object.assign(languageTranslations.de, { Deportes: "Sport", Animales: "Tiere" });
Object.assign(languageTranslations.fr, {
  "Configuración": "Configuration",
  "Planificación mensual": "Planification mensuelle",
  "Tipo de jornada": "Type de journée",
  "Incluir fondo del mes": "Inclure l’arrière-plan du mois",
  "Incluir horas fichadas": "Inclure les heures pointées"
});
Object.assign(languageTranslations.it, {
  "Configuración": "Impostazioni",
  "Planificación mensual": "Pianificazione mensile",
  "Tipo de jornada": "Tipo di giornata",
  "Incluir fondo del mes": "Includi lo sfondo del mese",
  "Incluir horas fichadas": "Includi le ore registrate"
});
Object.assign(languageTranslations.de, {
  "Configuración": "Einstellungen",
  "Planificación mensual": "Monatsplanung",
  "Tipo de jornada": "Art der Schicht",
  "Incluir fondo del mes": "Monatshintergrund einbeziehen",
  "Incluir horas fichadas": "Erfasste Zeiten einbeziehen"
});
Object.assign(languageTranslations.fr, {
  "Ayuda": "Aide",
  "Primeros pasos": "Premiers pas",
  "Cambia el idioma y el tema desde los selectores superiores. «Instalar app» abre su descarga y «Actualizar» busca una versión nueva.": "Changez la langue et le thème à l’aide des sélecteurs en haut. « Installer app » ouvre la page de téléchargement et « Mettre à jour » recherche une nouvelle version.",
  "Registrar una jornada": "Saisir une journée",
  "Toca un día para editarlo. Añade destino, trabajo, entrada, salida y estado; «Guardar ruta» conserva los cambios. Los botones de huella registran la hora actual y puedes activar un aviso.": "Touchez un jour pour le modifier. Ajoutez la destination, le travail, les heures d’entrée et de sortie ainsi que le statut ; « Enregistrer la journée » conserve vos modifications. Les boutons d’empreinte enregistrent l’heure actuelle et vous pouvez activer un rappel.",
  "Vaciar y reutilizar": "Effacer et réutiliser",
  "«Vaciar día» elimina los datos de la fecha seleccionada. «Borrar recuerdo» elimina la última ruta guardada para que no se complete automáticamente en otros días.": "« Vider le jour » supprime les données de la date sélectionnée. « Effacer la journée mémorisée » supprime le dernier itinéraire enregistré afin qu’il ne soit pas renseigné automatiquement les autres jours.",
  "Configuración y fondos": "Paramètres et arrière-plans",
  "En Configuración puedes activar sonidos, ocultar la introducción, ajustar colores, cambiar fondos temáticos, subir imágenes propias o elegir un color sólido.": "Dans les paramètres, vous pouvez activer les sons, masquer l’introduction, ajuster les couleurs, changer les arrière-plans thématiques, importer vos propres images ou choisir une couleur unie.",
  "Planificación mensual": "Planification mensuelle",
  "Elige grupo, mes y año, y añade festivos locales. El resumen del calendario cuenta rutas, horas y festivos.": "Choisissez le groupe, le mois et l’année, puis ajoutez les jours fériés locaux. Le récapitulatif du calendrier compte les itinéraires, les heures et les jours fériés.",
  "Descargar y compartir": "Télécharger et partager",
  "«Descargar PNG» guarda una imagen. «Compartir estructura del mes» crea un enlace para importar sus datos; «Compartir por WhatsApp» comparte la agenda. Las casillas permiten incluir el fondo y las horas fichadas.": "« Télécharger PNG » enregistre une image. « Partager la structure du mois » crée un lien pour importer ses données ; « Partager sur WhatsApp » partage l’agenda. Les cases permettent d’inclure l’arrière-plan et les heures pointées.",
  "Expediente y sincronización": "Dossier et synchronisation",
  "«Ver expediente» muestra resúmenes, jornadas y gráficos del año. Desde Exportar puedes descargar PDF o CSV, compartir el resumen e importar a Google Calendar. Conectar Google Drive sincroniza tus datos.": "« Voir le dossier » affiche les récapitulatifs, les journées et les graphiques de l’année. Dans Exporter, vous pouvez télécharger un PDF ou un CSV, partager le récapitulatif et importer dans Google Agenda. Connectez Google Drive pour synchroniser vos données."
});
Object.assign(languageTranslations.it, {
  "Ayuda": "Aiuto",
  "Primeros pasos": "Per iniziare",
  "Cambia el idioma y el tema desde los selectores superiores. «Instalar app» abre su descarga y «Actualizar» busca una versión nueva.": "Cambia la lingua e il tema dai selettori in alto. «Installa app» apre la pagina di download e «Aggiorna» cerca una nuova versione.",
  "Registrar una jornada": "Registrare una giornata",
  "Toca un día para editarlo. Añade destino, trabajo, entrada, salida y estado; «Guardar ruta» conserva los cambios. Los botones de huella registran la hora actual y puedes activar un aviso.": "Tocca un giorno per modificarlo. Aggiungi destinazione, tipo di lavoro, orari di entrata e uscita e stato; «Salva giornata» conserva le modifiche. I pulsanti con l’impronta registrano l’ora attuale e puoi attivare un promemoria.",
  "Vaciar y reutilizar": "Svuotare e riutilizzare",
  "«Vaciar día» elimina los datos de la fecha seleccionada. «Borrar recuerdo» elimina la última ruta guardada para que no se complete automáticamente en otros días.": "«Svuota giorno» elimina i dati della data selezionata. «Cancella percorso memorizzato» elimina l’ultimo percorso salvato, così non verrà compilato automaticamente negli altri giorni.",
  "Configuración y fondos": "Impostazioni e sfondi",
  "En Configuración puedes activar sonidos, ocultar la introducción, ajustar colores, cambiar fondos temáticos, subir imágenes propias o elegir un color sólido.": "Nelle impostazioni puoi attivare i suoni, nascondere l’introduzione, modificare i colori, cambiare gli sfondi tematici, caricare immagini personali o scegliere un colore uniforme.",
  "Planificación mensual": "Pianificazione mensile",
  "Elige grupo, mes y año, y añade festivos locales. El resumen del calendario cuenta rutas, horas y festivos.": "Scegli il gruppo, il mese e l’anno e aggiungi le festività locali. Il riepilogo del calendario conta percorsi, ore e festività.",
  "Descargar y compartir": "Scaricare e condividere",
  "«Descargar PNG» guarda una imagen. «Compartir estructura del mes» crea un enlace para importar sus datos; «Compartir por WhatsApp» comparte la agenda. Las casillas permiten incluir el fondo y las horas fichadas.": "«Scarica PNG» salva un’immagine. «Condividi struttura del mese» crea un link per importarne i dati; «Condividi su WhatsApp» condivide l’agenda. Le caselle consentono di includere lo sfondo e le ore registrate.",
  "Expediente y sincronización": "Registro e sincronizzazione",
  "«Ver expediente» muestra resúmenes, jornadas y gráficos del año. Desde Exportar puedes descargar PDF o CSV, compartir el resumen e importar a Google Calendar. Conectar Google Drive sincroniza tus datos.": "«Visualizza registro» mostra riepiloghi, giornate e grafici dell’anno. Da Esporta puoi scaricare PDF o CSV, condividere il riepilogo e importare in Google Calendar. Collega Google Drive per sincronizzare i tuoi dati."
});
Object.assign(languageTranslations.de, {
  "Ayuda": "Hilfe",
  "Primeros pasos": "Erste Schritte",
  "Cambia el idioma y el tema desde los selectores superiores. «Instalar app» abre su descarga y «Actualizar» busca una versión nueva.": "Ändere Sprache und Design über die Auswahlfelder oben. „App installieren“ öffnet die Downloadseite und „Aktualisieren“ sucht nach einer neuen Version.",
  "Registrar una jornada": "Arbeitstag erfassen",
  "Toca un día para editarlo. Añade destino, trabajo, entrada, salida y estado; «Guardar ruta» conserva los cambios. Los botones de huella registran la hora actual y puedes activar un aviso.": "Tippe auf einen Tag, um ihn zu bearbeiten. Füge Ziel, Tätigkeit, Beginn, Ende und Status hinzu; „Tag speichern“ übernimmt deine Änderungen. Die Stempeltasten erfassen die aktuelle Uhrzeit und du kannst eine Erinnerung aktivieren.",
  "Vaciar y reutilizar": "Leeren und wiederverwenden",
  "«Vaciar día» elimina los datos de la fecha seleccionada. «Borrar recuerdo» elimina la última ruta guardada para que no se complete automáticamente en otros días.": "„Tag leeren“ löscht die Daten des ausgewählten Datums. „Gespeicherte Route löschen“ entfernt die zuletzt gespeicherte Route, damit sie an anderen Tagen nicht automatisch eingetragen wird.",
  "Configuración y fondos": "Einstellungen und Hintergründe",
  "En Configuración puedes activar sonidos, ocultar la introducción, ajustar colores, cambiar fondos temáticos, subir imágenes propias o elegir un color sólido.": "In den Einstellungen kannst du Töne aktivieren, die Einführung ausblenden, Farben anpassen, Themenhintergründe ändern, eigene Bilder hochladen oder eine einheitliche Farbe auswählen.",
  "Planificación mensual": "Monatsplanung",
  "Elige grupo, mes y año, y añade festivos locales. El resumen del calendario cuenta rutas, horas y festivos.": "Wähle Gruppe, Monat und Jahr aus und füge lokale Feiertage hinzu. Die Kalenderübersicht zählt Routen, Arbeitsstunden und Feiertage.",
  "Descargar y compartir": "Herunterladen und teilen",
  "«Descargar PNG» guarda una imagen. «Compartir estructura del mes» crea un enlace para importar sus datos; «Compartir por WhatsApp» comparte la agenda. Las casillas permiten incluir el fondo y las horas fichadas.": "„PNG herunterladen“ speichert ein Bild. „Monatsstruktur teilen“ erstellt einen Link zum Importieren der Daten; „Per WhatsApp teilen“ teilt den Kalender. Über die Kontrollkästchen lassen sich Hintergrund und erfasste Arbeitszeiten einbeziehen.",
  "Expediente y sincronización": "Jahresübersicht und Synchronisierung",
  "«Ver expediente» muestra resúmenes, jornadas y gráficos del año. Desde Exportar puedes descargar PDF o CSV, compartir el resumen e importar a Google Calendar. Conectar Google Drive sincroniza tus datos.": "„Übersicht anzeigen“ zeigt Zusammenfassungen, Arbeitstage und Jahresdiagramme. Unter Exportieren kannst du PDF oder CSV herunterladen, die Zusammenfassung teilen und in Google Kalender importieren. Verbinde Google Drive, um deine Daten zu synchronisieren."
});
Object.assign(languagePairs, {
  "Desarrollador: Miguel Ángel Sánchez Aranda © 2026": "Developer: Miguel Ángel Sánchez Aranda © 2026",
  "Claro": "Light",
  "Oscuro": "Dark",
  "Nocturno": "Night",
  "Sin sincronizar": "Not synced",
  "Calendario de rutas": "Route calendar",
  "Instalar app": "Install app",
  "Actualizar": "Update",
  "Comprobando...": "Checking...",
  "Actualizando...": "Updating...",
  "Instalar aplicación": "Install application",
  "Comprobar actualizaciones": "Check for updates",
  "Mostrar QR": "Show QR",
  "Compartir calendario": "Share calendar",
  "Escanea el QR": "Scan the QR code",
  "Cerrar ventana del QR": "Close QR window",
  "Escanea el código con otro dispositivo para abrir la agenda compartida.": "Scan this code with another device to open the shared calendar."
});
Object.assign(languageTranslations.fr, {
  "Mostrar tema": "Afficher le thème",
  "Desarrollador: Miguel Ángel Sánchez Aranda © 2026": "Développeur : Miguel Ángel Sánchez Aranda © 2026",
  "Claro": "Clair",
  "Oscuro": "Sombre",
  "Nocturno": "Nuit",
  "Sin sincronizar": "Non synchronisé",
  "Calendario de rutas": "Calendrier des itinéraires",
  "Instalar app": "Installer l’application",
  "Actualizar": "Mettre à jour",
  "Comprobando...": "Vérification...",
  "Actualizando...": "Mise à jour...",
  "Instalar aplicación": "Installer l’application",
  "Comprobar actualizaciones": "Vérifier les mises à jour",
  "Mostrar QR": "Afficher le QR code",
  "Compartir calendario": "Partager le calendrier",
  "Escanea el QR": "Scannez le QR code",
  "Cerrar ventana del QR": "Fermer la fenêtre QR",
  "Escanea el código con otro dispositivo para abrir la agenda compartida.": "Scannez ce code avec un autre appareil pour ouvrir l’agenda partagé."
});
Object.assign(languageTranslations.it, {
  "Mostrar tema": "Mostra tema",
  "Desarrollador: Miguel Ángel Sánchez Aranda © 2026": "Sviluppatore: Miguel Ángel Sánchez Aranda © 2026",
  "Claro": "Chiaro",
  "Oscuro": "Scuro",
  "Nocturno": "Notturno",
  "Sin sincronizar": "Non sincronizzato",
  "Calendario de rutas": "Calendario dei percorsi",
  "Instalar app": "Installa app",
  "Actualizar": "Aggiorna",
  "Comprobando...": "Verifica...",
  "Actualizando...": "Aggiornamento...",
  "Instalar aplicación": "Installa l’applicazione",
  "Comprobar actualizaciones": "Verifica aggiornamenti",
  "Mostrar QR": "Mostra il codice QR",
  "Compartir calendario": "Condividi calendario",
  "Escanea el QR": "Scansiona il codice QR",
  "Cerrar ventana del QR": "Chiudi la finestra QR",
  "Escanea el código con otro dispositivo para abrir la agenda compartida.": "Scansiona questo codice con un altro dispositivo per aprire l’agenda condivisa."
});
Object.assign(languageTranslations.de, {
  "Mostrar tema": "Thema anzeigen",
  "Desarrollador: Miguel Ángel Sánchez Aranda © 2026": "Entwickler: Miguel Ángel Sánchez Aranda © 2026",
  "Claro": "Hell",
  "Oscuro": "Dunkel",
  "Nocturno": "Nacht",
  "Sin sincronizar": "Nicht synchronisiert",
  "Calendario de rutas": "Routenkalender",
  "Instalar app": "App installieren",
  "Actualizar": "Aktualisieren",
  "Comprobando...": "Prüfe...",
  "Actualizando...": "Aktualisierung...",
  "Instalar aplicación": "Anwendung installieren",
  "Comprobar actualizaciones": "Nach Updates suchen"
});
const installAndUpdateLabels = {
  es: { install: "Instalar aplicación", update: "Comprobar actualizaciones" },
  en: { install: "Install application", update: "Check for updates" },
  fr: { install: "Installer l’application", update: "Vérifier les mises à jour" },
  it: { install: "Installa l’applicazione", update: "Verifica aggiornamenti" },
  de: { install: "Anwendung installieren", update: "Nach Updates suchen" }
};
const driveTutorialTranslations = {
  "Antes de sincronizar": { en: "Before syncing", fr: "Avant la synchronisation", it: "Prima di sincronizzare", de: "Vor der Synchronisierung" },
  "Conectar Google Drive": { en: "Connect Google Drive", fr: "Connecter Google Drive", it: "Connetti Google Drive", de: "Google Drive verbinden" },
  "La aplicación necesita tu permiso para guardar y recuperar tu agenda en tu Google Drive.": {
    en: "The app needs your permission to save and retrieve your schedule in Google Drive.",
    fr: "L’application a besoin de votre autorisation pour enregistrer et récupérer votre agenda dans Google Drive.",
    it: "L’applicazione ha bisogno della tua autorizzazione per salvare e recuperare l’agenda su Google Drive.",
    de: "Die App benötigt deine Berechtigung, um deinen Kalender auf Google Drive zu speichern und abzurufen."
  },
  "Pulsa continuar.": { en: "Tap Continue.", fr: "Appuyez sur Continuer.", it: "Tocca Continua.", de: "Tippe auf Weiter." },
  "Se abrirá la ventana segura de Google.": { en: "Google’s secure window will open.", fr: "La fenêtre sécurisée de Google va s’ouvrir.", it: "Si aprirà la finestra sicura di Google.", de: "Das sichere Google-Fenster wird geöffnet." },
  "Elige tu cuenta.": { en: "Choose your account.", fr: "Choisissez votre compte.", it: "Scegli il tuo account.", de: "Wähle dein Konto aus." },
  "Usa la cuenta donde quieras guardar la agenda.": { en: "Use the account where you want to save your schedule.", fr: "Utilisez le compte sur lequel vous souhaitez enregistrer votre agenda.", it: "Usa l’account in cui vuoi salvare l’agenda.", de: "Verwende das Konto, in dem du deinen Kalender speichern möchtest." },
  "Revisa y acepta el permiso.": { en: "Review and accept the permission.", fr: "Vérifiez et acceptez l’autorisation.", it: "Controlla e accetta l’autorizzazione.", de: "Prüfe und bestätige die Berechtigung." },
  "Google permitirá a la aplicación gestionar los archivos que cree.": { en: "Google will let the app manage the files it creates.", fr: "Google autorisera l’application à gérer les fichiers qu’elle crée.", it: "Google consentirà all’applicazione di gestire i file che crea.", de: "Google erlaubt der App, die von ihr erstellten Dateien zu verwalten." },
  "Vuelve a la aplicación.": { en: "Return to the app.", fr: "Retournez dans l’application.", it: "Torna all’applicazione.", de: "Kehre zur App zurück." },
  "La agenda se sincronizará automáticamente.": { en: "Your schedule will sync automatically.", fr: "Votre agenda sera synchronisé automatiquement.", it: "L’agenda verrà sincronizzata automaticamente.", de: "Dein Kalender wird automatisch synchronisiert." },
  "Tu contraseña está segura y gestionada únicamente por Google.": { en: "Your password is protected and managed only by Google.", fr: "Votre mot de passe est protégé et géré uniquement par Google.", it: "La tua password è protetta e gestita solo da Google.", de: "Dein Passwort wird ausschließlich von Google geschützt und verwaltet." },
  "Cancelar": { en: "Cancel", fr: "Annuler", it: "Annulla", de: "Abbrechen" },
  "Continuar con Google": { en: "Continue with Google", fr: "Continuer avec Google", it: "Continua con Google", de: "Mit Google fortfahren" }
};
Object.entries(driveTutorialTranslations).forEach(([source, translations]) => {
  languagePairs[source] = translations.en;
  Object.entries(translations).forEach(([language, translation]) => {
    languageTranslations[language][source] = translation;
  });
});
const tutorialCloseLabels = {
  es: "Cerrar tutorial",
  en: "Close tutorial",
  fr: "Fermer le tutoriel",
  it: "Chiudi il tutorial",
  de: "Tutorial schließen"
};
const localizedGroupLabels = {
  es: { assigned: "Grupo", unassigned: "Grupo sin asignar" },
  en: { assigned: "Group", unassigned: "No group assigned" },
  fr: { assigned: "Groupe", unassigned: "Aucun groupe attribué" },
  it: { assigned: "Gruppo", unassigned: "Nessun gruppo assegnato" },
  de: { assigned: "Gruppe", unassigned: "Keine Gruppe zugewiesen" }
};
function updateFooterGroup() {
  const labels = localizedGroupLabels[currentLanguage] || localizedGroupLabels.es;
  const group = groupInput.value.trim();
  $("#footerGroup").textContent = group ? `${labels.assigned} ${group}` : labels.unassigned;
}
Object.assign(languageTranslations.fr, Object.fromEntries(months.map((month, index) => [month, localizedMonths.fr[index]])));
Object.assign(languageTranslations.it, Object.fromEntries(months.map((month, index) => [month, localizedMonths.it[index]])));
Object.assign(languageTranslations.de, Object.fromEntries(months.map((month, index) => [month, localizedMonths.de[index]])));
const fieldExampleTranslations = {
  "Ej. 204": { en: "E.g. 204", fr: "Ex. 204", it: "Es. 204", de: "Z. B. 204" },
  "Ej. Fiesta local": { en: "E.g. Local holiday", fr: "Ex. Fête locale", it: "Es. Festa locale", de: "Z. B. Ortsfest" },
  "Ej. Barrio de Salamanca": { en: "E.g. Salamanca district", fr: "Ex. Quartier de Salamanca", it: "Es. Quartiere Salamanca", de: "Z. B. Viertel Salamanca" },
  "Ej. Recogida de muebles": { en: "E.g. Furniture collection", fr: "Ex. Collecte de meubles", it: "Es. Ritiro di mobili", de: "Z. B. Möbelabholung" }
};
Object.entries(fieldExampleTranslations).forEach(([source, translations]) => {
  languagePairs[source] = translations.en;
  Object.entries(translations).forEach(([language, translation]) => {
    languageTranslations[language][source] = translation;
  });
});

Object.assign(languagePairs, {
  "Configuración del calendario": "Calendar settings",
  "Organiza destinos y horas de entrada para cada día. Después descarga una imagen limpia, lista para compartir.": "Plan destinations and start times for each day, then download a clean image to share.",
  Fecha: "Date", Nombre: "Name", "Añadir festivo": "Add holiday", "No hay festivos personalizados este año": "No custom holidays this year",
  "Vista mensual": "Monthly view", "Mes actual": "Current month", "Día con ruta": "Scheduled route",
  "Selecciona un día": "Select a day", "Haz clic en un día del calendario para registrar su destino y hora.": "Select a calendar day to enter its destination and time.",
  "Selecciona cualquier día para añadir o editar una ruta": "Select a day to add or edit a route", rutas: "routes", "horas con entrada": "scheduled starts", festivos: "holidays",
  "Tu ruta aparecerá aquí": "Your route will appear here", Festivo: "Holiday", "Hora de entrada (24 h)": "Entry time (24 h)",
  "Hora de salida (24 h)": "Exit time (24 h)", "Huella de entrada": "Entry punch", "Huella de salida": "Exit punch",
  "Jornada completa · 8 h": "Full day · 8 h", "Jornada continua · 7 h": "Continuous day · 7 h", "Media jornada · 4 h": "Half day · 4 h",
  "Sin calcular": "Not calculated", "Horas extra": "Overtime", "Se suma de una en una": "Added one at a time",
  "30 minutos antes": "30 minutes before", "A la hora de entrada": "At entry time", "15 minutos antes": "15 minutes before", "1 hora antes": "1 hour before", "2 horas antes": "2 hours before",
  "Asuntos propios": "Personal days", Descanso: "Rest day", "Activar recordatorio": "Enable reminder",
  "Vaciar día": "Clear day", "Borrar recuerdo": "Clear remembered route", "Resumen del mes": "Monthly summary", "rutas": "routes",
  "horas con entrada": "scheduled starts", "festivos": "holidays", "Vista previa en tiempo real": "Live preview", "Agenda lista para compartir": "Agenda ready to share",
  "Editar día": "Edit day", "Días y horas extra por mes": "Days and overtime by month", "días registrados": "recorded days",
  "Total registrados": "Total recorded", "Festivos trabajados": "Worked holidays", Bajas: "Sick leave", "Horas normales": "Regular hours",
  "Año completo": "Full year", "Detalle de días": "Daily details", Resumen: "Summary", Exportar: "Export", Fecha: "Date", Estado: "Status",
  Entrada: "Start", Salida: "End", "Tiempo trabajado": "Time worked", "Horas extra": "Overtime", "Descargar PDF": "Download PDF", "Descargar CSV": "Download CSV",
  "Compartir resumen": "Share summary", "Todavía no hay registros para este año": "No records for this year yet", "Ver expediente": "View record", "Ocultar expediente": "Hide record",
  "Conectar Google Drive": "Connect Google Drive", "Sincronizado ahora": "Synced just now", "Sincronización pendiente": "Sync pending", "Desconectado de Google Drive": "Disconnected from Google Drive"
});

Object.assign(languageTranslations.fr, {
  "Configuración del calendario": "Paramètres du calendrier",
  "Organiza destinos y horas de entrada para cada día. Después descarga una imagen limpia, lista para compartir.": "Planifiez les destinations et les heures de début, puis téléchargez une image à partager.",
  Fecha: "Date", Nombre: "Nom", "Añadir festivo": "Ajouter un jour férié", "No hay festivos personalizados este año": "Aucun jour férié personnalisé cette année",
  "Vista mensual": "Vue mensuelle", "Mes actual": "Mois actuel", "Día con ruta": "Tournée prévue",
  "Selecciona un día": "Choisissez un jour", "Haz clic en un día del calendario para registrar su destino y hora.": "Choisissez une date pour saisir la destination et l’heure.",
  "Selecciona cualquier día para añadir o editar una ruta": "Choisissez une date pour ajouter ou modifier une tournée", rutas: "tournées", "horas con entrada": "heures de début", festivos: "jours fériés",
  "Tu ruta aparecerá aquí": "Votre tournée apparaîtra ici", Festivo: "Jour férié", "Hora de entrada (24 h)": "Heure de début (24 h)",
  "Hora de salida (24 h)": "Heure de fin (24 h)", "Huella de entrada": "Pointage d’entrée", "Huella de salida": "Pointage de sortie",
  "Jornada completa · 8 h": "Journée complète · 8 h", "Jornada continua · 7 h": "Journée continue · 7 h", "Media jornada · 4 h": "Demi-journée · 4 h",
  "Sin calcular": "Non calculé", "Horas extra": "Heures supplémentaires", "Se suma de una en una": "Ajoutées une par une",
  "30 minutos antes": "30 minutes avant", "A la hora de entrada": "À l’heure de début", "15 minutos antes": "15 minutes avant", "1 hora antes": "1 heure avant", "2 horas antes": "2 heures avant",
  "Asuntos propios": "Congés personnels", Descanso: "Repos", "Activar recordatorio": "Activer le rappel",
  "Vaciar día": "Effacer la journée", "Borrar recuerdo": "Effacer la tournée mémorisée", "Resumen del mes": "Résumé du mois", "rutas": "tournées",
  "horas con entrada": "heures de début", "festivos": "jours fériés", "Vista previa en tiempo real": "Aperçu en temps réel", "Agenda lista para compartir": "Agenda prête à partager",
  "Editar día": "Modifier le jour", "Días y horas extra por mes": "Jours et heures supplémentaires par mois", "días registrados": "jours enregistrés",
  "Total registrados": "Total enregistré", "Festivos trabajados": "Jours fériés travaillés", Bajas: "Arrêts maladie", "Horas normales": "Heures normales",
  "Año completo": "Année complète", "Detalle de días": "Détail des journées", Resumen: "Résumé", Exportar: "Exporter", Estado: "Statut",
  Entrada: "Début", Salida: "Fin", "Tiempo trabajado": "Temps travaillé", "Descargar PDF": "Télécharger le PDF", "Descargar CSV": "Télécharger le CSV",
  "Compartir resumen": "Partager le résumé", "Todavía no hay registros para este año": "Aucun enregistrement pour cette année", "Ver expediente": "Voir le dossier", "Ocultar expediente": "Masquer le dossier",
  "Conectar Google Drive": "Connecter Google Drive", "Sincronizado ahora": "Synchronisé à l’instant", "Sincronización pendiente": "Synchronisation en attente", "Desconectado de Google Drive": "Déconnecté de Google Drive"
});

Object.assign(languageTranslations.it, {
  "Configuración del calendario": "Impostazioni del calendario",
  "Organiza destinos y horas de entrada para cada día. Después descarga una imagen limpia, lista para compartir.": "Organizza destinazioni e orari di ingresso, poi scarica un’immagine da condividere.",
  Fecha: "Data", Nombre: "Nome", "Añadir festivo": "Aggiungi festività", "No hay festivos personalizados este año": "Nessuna festività personalizzata quest’anno",
  "Vista mensual": "Vista mensile", "Mes actual": "Mese corrente", "Día con ruta": "Percorso programmato",
  "Selecciona un día": "Seleziona un giorno", "Haz clic en un día del calendario para registrar su destino y hora.": "Seleziona un giorno per inserire destinazione e orario.",
  "Selecciona cualquier día para añadir o editar una ruta": "Seleziona un giorno per aggiungere o modificare un percorso", rutas: "percorsi", "horas con entrada": "ingressi programmati", festivos: "festività",
  "Tu ruta aparecerá aquí": "Il percorso apparirà qui", Festivo: "Festività", "Hora de entrada (24 h)": "Ora di ingresso (24 h)",
  "Hora de salida (24 h)": "Ora di uscita (24 h)", "Huella de entrada": "Timbro ingresso", "Huella de salida": "Timbro uscita",
  "Jornada completa · 8 h": "Giornata completa · 8 h", "Jornada continua · 7 h": "Giornata continuata · 7 h", "Media jornada · 4 h": "Mezza giornata · 4 h",
  "Sin calcular": "Non calcolato", "Horas extra": "Straordinari", "Se suma de una en una": "Si aggiungono una alla volta",
  "30 minutos antes": "30 minuti prima", "A la hora de entrada": "All’ora di ingresso", "15 minutos antes": "15 minuti prima", "1 hora antes": "1 ora prima", "2 horas antes": "2 ore prima",
  "Asuntos propios": "Permessi personali", Descanso: "Riposo", "Activar recordatorio": "Attiva promemoria",
  "Vaciar día": "Svuota giornata", "Borrar recuerdo": "Elimina percorso memorizzato", "Resumen del mes": "Riepilogo mensile", "rutas": "percorsi",
  "horas con entrada": "ingressi programmati", "festivos": "festività", "Vista previa en tiempo real": "Anteprima in tempo reale", "Agenda lista para compartir": "Agenda pronta da condividere",
  "Editar día": "Modifica giorno", "Días y horas extra por mes": "Giorni e straordinari per mese", "días registrados": "giorni registrati",
  "Total registrados": "Totale registrato", "Festivos trabajados": "Festività lavorate", Bajas: "Malattia", "Horas normales": "Ore ordinarie",
  "Año completo": "Anno completo", "Detalle de días": "Dettaglio giornaliero", Resumen: "Riepilogo", Exportar: "Esporta", Estado: "Stato",
  Entrada: "Ingresso", Salida: "Uscita", "Tiempo trabajado": "Tempo lavorato", "Descargar PDF": "Scarica PDF", "Descargar CSV": "Scarica CSV",
  "Compartir resumen": "Condividi riepilogo", "Todavía no hay registros para este año": "Nessun dato registrato per quest’anno", "Ver expediente": "Visualizza fascicolo", "Ocultar expediente": "Nascondi fascicolo",
  "Conectar Google Drive": "Connetti Google Drive", "Sincronizado ahora": "Sincronizzato ora", "Sincronización pendiente": "Sincronizzazione in sospeso", "Desconectado de Google Drive": "Disconnesso da Google Drive"
});

Object.assign(languageTranslations.de, {
  "Configuración del calendario": "Kalendereinstellungen",
  "Organiza destinos y horas de entrada para cada día. Después descarga una imagen limpia, lista para compartir.": "Plane deine Ziele und Startzeiten und lade anschließend ein teilbares Kalenderbild herunter.",
  Fecha: "Datum", Nombre: "Name", "Añadir festivo": "Feiertag hinzufügen", "No hay festivos personalizados este año": "Keine eigenen Feiertage in diesem Jahr",
  "Vista mensual": "Monatsübersicht", "Mes actual": "Aktueller Monat", "Día con ruta": "Geplante Route",
  "Selecciona un día": "Tag auswählen", "Haz clic en un día del calendario para registrar su destino y hora.": "Wähle einen Kalendertag, um Ziel und Uhrzeit einzutragen.",
  "Selecciona cualquier día para añadir o editar una ruta": "Wähle einen Tag, um eine Route hinzuzufügen oder zu bearbeiten", rutas: "Routen", "horas con entrada": "geplante Starts", festivos: "Feiertage",
  "Tu ruta aparecerá aquí": "Deine Route erscheint hier", Festivo: "Feiertag", "Hora de entrada (24 h)": "Startzeit (24 Std.)",
  "Hora de salida (24 h)": "Endzeit (24 Std.)", "Huella de entrada": "Einstempeln", "Huella de salida": "Ausstempeln",
  "Jornada completa · 8 h": "Ganztags · 8 Std.", "Jornada continua · 7 h": "Durchgehend · 7 Std.", "Media jornada · 4 h": "Halbtags · 4 Std.",
  "Sin calcular": "Nicht berechnet", "Horas extra": "Überstunden", "Se suma de una en una": "Wird stundenweise addiert",
  "30 minutos antes": "30 Minuten vorher", "A la hora de entrada": "Zur Startzeit", "15 minutos antes": "15 Minuten vorher", "1 hora antes": "1 Stunde vorher", "2 horas antes": "2 Stunden vorher",
  "Asuntos propios": "Sonderurlaub", Descanso: "Ruhetag", "Activar recordatorio": "Erinnerung aktivieren",
  "Vaciar día": "Tag leeren", "Borrar recuerdo": "Gespeicherte Route löschen", "Resumen del mes": "Monatsübersicht", "rutas": "Routen",
  "horas con entrada": "geplante Starts", "festivos": "Feiertage", "Vista previa en tiempo real": "Live-Vorschau", "Agenda lista para compartir": "Kalender zum Teilen bereit",
  "Editar día": "Tag bearbeiten", "Días y horas extra por mes": "Tage und Überstunden pro Monat", "días registrados": "erfasste Tage",
  "Total registrados": "Insgesamt erfasst", "Festivos trabajados": "Gearbeitete Feiertage", Bajas: "Krankheitstage", "Horas normales": "Reguläre Stunden",
  "Año completo": "Ganzes Jahr", "Detalle de días": "Tagesdetails", Resumen: "Übersicht", Exportar: "Exportieren", Estado: "Status",
  Entrada: "Start", Salida: "Ende", "Tiempo trabajado": "Arbeitszeit", "Descargar PDF": "PDF herunterladen", "Descargar CSV": "CSV herunterladen",
  "Compartir resumen": "Zusammenfassung teilen", "Todavía no hay registros para este año": "Für dieses Jahr liegen noch keine Einträge vor", "Ver expediente": "Jahresübersicht anzeigen", "Ocultar expediente": "Jahresübersicht ausblenden",
  "Conectar Google Drive": "Google Drive verbinden", "Sincronizado ahora": "Gerade synchronisiert", "Sincronización pendiente": "Synchronisierung ausstehend", "Desconectado de Google Drive": "Von Google Drive getrennt"
});

Object.assign(languagePairs, {
  "Control anual": "Annual record", "Expediente de": "Record for", "Resumen de días y actividades": "Days and activities summary",
  Trabajados: "Worked", Festivos: "Holidays", "Total registrados": "Total recorded", "Festivos trabajados": "Worked holidays",
  Bajas: "Sick leave", "Horas normales": "Regular hours", "Año completo": "Full year", "Comparación mensual y anual": "Monthly and yearly comparison",
  "Días y horas extra por mes": "Days and overtime by month", "días registrados": "recorded days", "Descargar PDF": "Download PDF",
  "Descargar CSV": "Download CSV", "Compartir resumen": "Share summary", "Todavía no hay registros para este año": "No records for this year yet",
  "Total registrados": "Total recorded", Estado: "Status", Entrada: "Start", Salida: "End", "Horas extra": "Overtime",
  "Incluir fondo del mes": "Include month background", "Incluir horas fichadas": "Include clocked hours", "No sincronizado": "Not synced",
  "Ningún festivo personalizado": "No custom holidays"
});
Object.assign(languageTranslations.fr, {
  "Control anual": "Suivi annuel", "Expediente de": "Dossier de", "Resumen de días y actividades": "Résumé des jours et activités",
  Trabajados: "Jours travaillés", Festivos: "Jours fériés", "Total registrados": "Total enregistré", "Festivos trabajados": "Jours fériés travaillés",
  Bajas: "Arrêts maladie", "Horas normales": "Heures normales", "Año completo": "Année complète", "Comparación mensual y anual": "Comparaison mensuelle et annuelle",
  "Días y horas extra por mes": "Jours et heures supplémentaires par mois", "días registrados": "jours enregistrés", "Descargar PDF": "Télécharger le PDF",
  "Descargar CSV": "Télécharger le CSV", "Compartir resumen": "Partager le résumé", "Todavía no hay registros para este año": "Aucun enregistrement pour cette année",
  Estado: "Statut", Entrada: "Début", Salida: "Fin", "Incluir fondo del mes": "Inclure l’arrière-plan du mois", "Incluir horas fichadas": "Inclure les heures pointées"
});
Object.assign(languageTranslations.it, {
  "Control anual": "Riepilogo annuale", "Expediente de": "Registro di", "Resumen de días y actividades": "Riepilogo di giorni e attività",
  Trabajados: "Giorni lavorati", Festivos: "Festività", "Total registrados": "Totale registrato", "Festivos trabajados": "Festività lavorate",
  Bajas: "Malattia", "Horas normales": "Ore ordinarie", "Año completo": "Anno intero", "Comparación mensual y anual": "Confronto mensile e annuale",
  "Días y horas extra por mes": "Giorni e straordinari per mese", "días registrados": "giorni registrati", "Descargar PDF": "Scarica PDF",
  "Descargar CSV": "Scarica CSV", "Compartir resumen": "Condividi riepilogo", "Todavía no hay registros para este año": "Nessun dato registrato per quest’anno",
  Estado: "Stato", Entrada: "Ingresso", Salida: "Uscita", "Incluir fondo del mes": "Includi lo sfondo del mese", "Incluir horas fichadas": "Includi le ore registrate"
});
Object.assign(languageTranslations.de, {
  "Control anual": "Jahresübersicht", "Expediente de": "Jahresbericht für", "Resumen de días y actividades": "Übersicht über Tage und Aktivitäten",
  Trabajados: "Gearbeitete Tage", Festivos: "Feiertage", "Total registrados": "Insgesamt erfasst", "Festivos trabajados": "Gearbeitete Feiertage",
  Bajas: "Krankheitstage", "Horas normales": "Reguläre Stunden", "Año completo": "Ganzes Jahr", "Comparación mensual y anual": "Monats- und Jahresvergleich",
  "Días y horas extra por mes": "Tage und Überstunden pro Monat", "días registrados": "erfasste Tage", "Descargar PDF": "PDF herunterladen",
  "Descargar CSV": "CSV herunterladen", "Compartir resumen": "Zusammenfassung teilen", "Todavía no hay registros para este año": "Für dieses Jahr liegen noch keine Einträge vor",
  Estado: "Status", Entrada: "Start", Salida: "Ende", "Incluir fondo del mes": "Monatshintergrund einbeziehen", "Incluir horas fichadas": "Erfasste Zeiten einbeziehen"
});

const staticUiTranslations = {
  "Agenda": { en: "Agenda", fr: "Agenda", it: "Agenda", de: "Kalender" },
  "Agenda semanal": { en: "Weekly agenda", fr: "Agenda hebdomadaire", it: "Agenda settimanale", de: "Wochenkalender" },
  "Estadísticas": { en: "Statistics", fr: "Statistiques", it: "Statistiche", de: "Statistiken" },
  "Ajustes": { en: "Settings", fr: "Paramètres", it: "Impostazioni", de: "Einstellungen" },
  "Usar intro al iniciar": { en: "Play intro on startup", fr: "Lire l’introduction au démarrage", it: "Riproduci l’introduzione all’avvio", de: "Einführung beim Start abspielen" },
  "Reproducir intro": { en: "Play intro", fr: "Lire l’introduction", it: "Riproduci introduzione", de: "Einführung abspielen" },
  "Saltar intro": { en: "Skip intro", fr: "Passer l’introduction", it: "Salta introduzione", de: "Einführung überspringen" },
  "Sin conexión": { en: "Offline", fr: "Hors ligne", it: "Non in linea", de: "Offline" },
  "Sincronizar ahora": { en: "Sync now", fr: "Synchroniser", it: "Sincronizza ora", de: "Jetzt synchronisieren" },
  "Cerrar sesión": { en: "Sign out", fr: "Se déconnecter", it: "Esci", de: "Abmelden" },
  "No mostrar intro": { en: "Hide intro", fr: "Masquer l’introduction", it: "Nascondi introduzione", de: "Einführung ausblenden" },
  "Color sólido": { en: "Solid color", fr: "Couleur unie", it: "Colore uniforme", de: "Einheitliche Farbe" },
  "Privacidad / Privacy": { en: "Privacy", fr: "Confidentialité", it: "Privacy", de: "Datenschutz" },
  "Agenda mensual": { en: "Monthly agenda", fr: "Agenda mensuelle", it: "Agenda mensile", de: "Monatskalender" },
  "Introducción de Memoria laboral": { en: "Work Log introduction", fr: "Présentation du journal de travail", it: "Introduzione al diario di lavoro", de: "Einführung ins Arbeitsprotokoll" },
  Idioma: { en: "Language", fr: "Langue", it: "Lingua", de: "Sprache" },
  "Acciones de la aplicación": { en: "App actions", fr: "Actions de l’application", it: "Azioni dell’app", de: "App-Aktionen" },
  "Gestión de calendario y detalle del día": { en: "Calendar and day details", fr: "Gestion du calendrier et détails du jour", it: "Gestione del calendario e dettagli del giorno", de: "Kalender- und Tagesdetails" },
  "Calendario mensual": { en: "Monthly calendar", fr: "Calendrier mensuel", it: "Calendario mensile", de: "Monatskalender" },
  "Navegación principal": { en: "Main navigation", fr: "Navigation principale", it: "Navigazione principale", de: "Hauptnavigation" },
  "Secciones principales": { en: "Main sections", fr: "Sections principales", it: "Sezioni principali", de: "Hauptbereiche" },
  "Mes anterior": { en: "Previous month", fr: "Mois précédent", it: "Mese precedente", de: "Vorheriger Monat" },
  "Mes siguiente": { en: "Next month", fr: "Mois suivant", it: "Mese successivo", de: "Nächster Monat" },
  "Gira el móvil para ver la agenda apaisada.": { en: "Rotate your phone for a landscape agenda.", fr: "Tournez le téléphone pour afficher l’agenda en paysage.", it: "Ruota il telefono per visualizzare l’agenda in orizzontale.", de: "Drehe dein Smartphone für die Kalenderansicht im Querformat." },
  "Hora de entrada, horas": { en: "Entry hour", fr: "Heure d’entrée", it: "Ora di ingresso", de: "Eingangsstunde" },
  "Hora de entrada, minutos": { en: "Entry minutes", fr: "Minutes d’entrée", it: "Minuti di ingresso", de: "Eingangsminuten" },
  "Usar huella de entrada": { en: "Record entry time", fr: "Enregistrer l’heure d’entrée", it: "Registra l’ora di ingresso", de: "Eingangszeit erfassen" },
  "Hora de salida, horas": { en: "Exit hour", fr: "Heure de sortie", it: "Ora di uscita", de: "Ausgangsstunde" },
  "Hora de salida, minutos": { en: "Exit minutes", fr: "Minutes de sortie", it: "Minuti di uscita", de: "Ausgangsminuten" },
  "Usar huella de salida": { en: "Record exit time", fr: "Enregistrer l’heure de sortie", it: "Registra l’ora di uscita", de: "Ausstiegszeit erfassen" },
  "Restar una hora extra": { en: "Subtract one overtime hour", fr: "Retirer une heure supplémentaire", it: "Sottrai un’ora di straordinario", de: "Eine Überstunde abziehen" },
  "Añadir una hora extra": { en: "Add one overtime hour", fr: "Ajouter une heure supplémentaire", it: "Aggiungi un’ora di straordinario", de: "Eine Überstunde hinzufügen" },
  "Cambiar de año": { en: "Change year", fr: "Changer d’année", it: "Cambia anno", de: "Jahr ändern" },
  "Año anterior": { en: "Previous year", fr: "Année précédente", it: "Anno precedente", de: "Vorheriges Jahr" },
  "Año del expediente": { en: "Record year", fr: "Année du dossier", it: "Anno del registro", de: "Jahr des Berichts" },
  "Año siguiente": { en: "Next year", fr: "Année suivante", it: "Anno successivo", de: "Nächstes Jahr" },
  "Secciones del expediente": { en: "Record sections", fr: "Sections du dossier", it: "Sezioni del registro", de: "Berichtsbereiche" },
  "Cerrar calendario ampliado": { en: "Close expanded calendar", fr: "Fermer le calendrier agrandi", it: "Chiudi il calendario esteso", de: "Erweiterten Kalender schließen" },
  "Agenda mensual ampliada": { en: "Expanded monthly agenda", fr: "Agenda mensuelle agrandie", it: "Agenda mensile estesa", de: "Erweiterter Monatskalender" },
  "Política de privacidad / Privacy policy": { en: "Privacy policy", fr: "Politique de confidentialité", it: "Informativa sulla privacy", de: "Datenschutzerklärung" },
  "Vistas": { en: "Views", fr: "Vues", it: "Viste", de: "Ansichten" },
  "Vista semanal": { en: "Weekly view", fr: "Vue hebdomadaire", it: "Vista settimanale", de: "Wochenansicht" },
  "Semana anterior": { en: "Previous week", fr: "Semaine précédente", it: "Settimana precedente", de: "Vorherige Woche" },
  "Semana siguiente": { en: "Next week", fr: "Semaine suivante", it: "Settimana successiva", de: "Nächste Woche" },
  "Hoy": { en: "Today", fr: "Aujourd’hui", it: "Oggi", de: "Heute" },
  "Calendario semanal": { en: "Weekly calendar", fr: "Calendrier hebdomadaire", it: "Calendario settimanale", de: "Wochenkalender" },
  "Cambiar vista del calendario": { en: "Change calendar view", fr: "Changer la vue du calendrier", it: "Cambia vista calendario", de: "Kalenderansicht ändern" },
  "Sin actividad programada": { en: "No activity scheduled", fr: "Aucune activité prévue", it: "Nessuna attività programmata", de: "Keine Aktivität geplant" },
  "Días trabajados": { en: "Worked days", fr: "Jours travaillés", it: "Giorni lavorati", de: "Arbeitstage" },
  "PLANIFICACIÓN LABORAL, MÁS CLARA": { en: "CLEARER WORKDAY PLANNING", fr: "UNE PLANIFICATION DU TRAVAIL PLUS CLAIRE", it: "PIANIFICAZIONE DEL LAVORO PIÙ CHIARA", de: "KLARE ARBEITSPLANUNG" },
  "Funciones principales": { en: "Key features", fr: "Fonctionnalités principales", it: "Funzioni principali", de: "Die wichtigsten Funktionen" },
  "Todo tu trabajo, claro en un calendario.": { en: "All your work, clear in one calendar.", fr: "Tout votre travail, dans un calendrier clair.", it: "Tutto il tuo lavoro, in un unico calendario.", de: "Deine Arbeit, klar in einem Kalender." },
  "Planifica rutas, registra fichajes y controla horas extra y festivos. Guarda en Drive y comparte tu agenda cuando la necesites.": { en: "Plan routes, track work hours, and keep holidays and overtime in view. Save to Drive and share your calendar whenever you need.", fr: "Planifiez les itinéraires, suivez les horaires et gardez les congés et heures supplémentaires en vue. Enregistrez sur Drive et partagez votre agenda.", it: "Pianifica i percorsi, registra le presenze e tieni sotto controllo festività e straordinari. Salva su Drive e condividi l’agenda quando vuoi.", de: "Plane Routen, erfasse Arbeitszeiten und behalte Feiertage und Überstunden im Blick. Speichere in Drive und teile deinen Kalender." },
  "Rutas y turnos": { en: "Routes and shifts", fr: "Itinéraires et horaires", it: "Percorsi e turni", de: "Routen und Schichten" },
  "Fichajes y horas extra": { en: "Time tracking and overtime", fr: "Pointages et heures supplémentaires", it: "Presenze e straordinari", de: "Zeiterfassung und Überstunden" },
  "Drive y exportación": { en: "Drive and exports", fr: "Drive et exportations", it: "Drive ed esportazioni", de: "Drive und Exporte" },
  "Empezar a planificar": { en: "Start planning", fr: "Commencer à planifier", it: "Inizia a pianificare", de: "Jetzt planen" },
  "Tu jornada, clara de un vistazo": { en: "Your workday, clear at a glance", fr: "Votre journée en un coup d’œil", it: "La tua giornata, a colpo d’occhio", de: "Dein Arbeitstag auf einen Blick" },
  "Organiza rutas, horarios y festivos en un calendario fácil de compartir.": { en: "Organize routes, schedules, and holidays in a calendar that is easy to share.", fr: "Organisez itinéraires, horaires et jours fériés dans un calendrier facile à partager.", it: "Organizza percorsi, orari e festività in un calendario facile da condividere.", de: "Organisiere Routen, Arbeitszeiten und Feiertage in einem Kalender, den du einfach teilen kannst." },
  "Ir a la agenda": { en: "Open calendar", fr: "Ouvrir l’agenda", it: "Apri il calendario", de: "Kalender öffnen" }
};
Object.entries(staticUiTranslations).forEach(([source, translations]) => {
  languagePairs[source] = translations.en;
  Object.entries(translations).forEach(([language, translation]) => {
    languageTranslations[language][source] = translation;
  });
});

Object.assign(languageTranslations.fr, { "Importar a Google Calendar": "Importer dans Google Agenda" });
Object.assign(languageTranslations.it, { "Importar a Google Calendar": "Importa in Google Calendar" });
Object.assign(languageTranslations.de, { "Importar a Google Calendar": "In Google Kalender importieren" });

function localizedUiText(source) {
  if (currentLanguage === "es") return source;
  return languageTranslations[currentLanguage]?.[source] || languagePairs[source] || source;
}

function updateCalendarViewButton() {
  const labels = {
    es: ["Detallada", "Compacta", "Semanal"],
    en: ["Detailed", "Compact", "Weekly"],
    fr: ["Détaillée", "Compacte", "Hebdomadaire"],
    it: ["Dettagliata", "Compatta", "Settimanale"],
    de: ["Detailliert", "Kompakt", "Wöchentlich"]
  };
  const modes = ["month", "filled", "week"];
  const activeLabels = labels[currentLanguage] || labels.es;
  calendarViewToggle.textContent = activeLabels[modes.indexOf(calendarView)];
  calendarViewToggle.setAttribute("aria-label", localizedUiText("Cambiar vista del calendario"));
  const weekly = calendarView === "week";
  agendaPreview.dataset.calendarView = calendarView;
  document.querySelector(".calendar-view-controls")?.classList.toggle("is-weekly", weekly);
  calendarViewToggle.hidden = false;
  calendarViewToggle.parentElement.classList.toggle("is-weekly", weekly);
  previousMonthButton.hidden = weekly;
  nextMonthButton.hidden = weekly;
  previewMonthYearControls.hidden = weekly;
  previousWeekButton.hidden = !weekly;
  nextWeekButton.hidden = !weekly;
  todayButton.hidden = !weekly;
}

// Traduce el contenido existente y mantiene sincronizados los controles de idioma.
function translatePage() {
  document.documentElement.lang = currentLanguage;
  document.title = { es: "Memoria laboral", en: "Work Log", fr: "Journal de travail", it: "Diario di lavoro", de: "Arbeitsprotokoll" }[currentLanguage] || "Memoria laboral";
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
      : dynamicMonthYear
        ? `${(localizedMonths[currentLanguage] || months)[months.indexOf(dynamicMonthYear[1])]} ${dynamicMonthYear[2]}`
        : currentLanguage === "es" ? sourceKey : activeTranslations[sourceKey] || languagePairs[sourceKey] || original;
    if (translated) node.nodeValue = node.nodeValue.replace(original, translated);
  }
  (localizedWeekdays[currentLanguage] || localizedWeekdays.es).forEach((weekday, index) => {
    const weekdayElement = document.querySelectorAll(".weekdays span")[index];
    if (weekdayElement) weekdayElement.textContent = weekday;
  });
  document.querySelectorAll("input[placeholder]").forEach((input) => {
    const placeholderSource = Object.entries(languageTranslations).flatMap(([, map]) => Object.entries(map)).find(([key, value]) => key === input.placeholder || value === input.placeholder)?.[0] || input.placeholder;
    const translated = currentLanguage === "es" ? placeholderSource : languageTranslations[currentLanguage]?.[placeholderSource] || languagePairs[placeholderSource] || input.placeholder;
    if (translated) input.placeholder = translated;
  });
  document.querySelectorAll("[aria-label], [title]").forEach((element) => {
    ["aria-label", "title"].forEach((attribute) => {
      const original = element.getAttribute(attribute);
      if (!original) return;
      const sourceKey = Object.entries(languageTranslations).flatMap(([, map]) => Object.entries(map)).find(([key, value]) => key === original || value === original)?.[0] || original;
      const translated = currentLanguage === "es" ? sourceKey : languageTranslations[currentLanguage]?.[sourceKey] || languagePairs[sourceKey] || original;
      if (translated) element.setAttribute(attribute, translated);
    });
  });
  const actionLabels = installAndUpdateLabels[currentLanguage] || installAndUpdateLabels.es;
  installButton.setAttribute("aria-label", actionLabels.install);
  updateButton.setAttribute("aria-label", actionLabels.update);
  updateButton.title = actionLabels.update;
  driveTutorialClose.setAttribute("aria-label", tutorialCloseLabels[currentLanguage] || tutorialCloseLabels.es);
  languageSelect.value = currentLanguage;
  updateCalendarViewButton();
  updateFooterGroup();
}

// Guarda el idioma elegido y actualiza inmediatamente la página.
function setLanguage(language) {
  currentLanguage = language;
  localStorage.setItem("limasam-language", language);
  renderCalendar();
  renderHolidayList();
  if (state.selected) $("#routeDate").textContent = dateLabel(state.selected);
  translatePage();
  drawAgendaCanvas();
}

languageSelect.addEventListener("change", () => setLanguage(languageSelect.value));

agendaPreview.append(exportActions);
backgroundToggle.checked = localStorage.getItem("limasam-show-background") !== "false";
const backgroundThemes = ["cleaning", "gardening", "transport", "school", "security", "sports", "animals"];
let selectedBackgroundTheme = localStorage.getItem("limasam-background-theme") || "cleaning";
if (!backgroundThemes.includes(selectedBackgroundTheme)) selectedBackgroundTheme = "cleaning";
backgroundThemeSelect.value = selectedBackgroundTheme;
backgroundColorInput.value = localStorage.getItem("limasam-background-color") || "#f5f7f3";
weekdayColorInput.value = localStorage.getItem("limasam-weekday-color") || "#ffffff";
weekendColorInput.value = localStorage.getItem("limasam-weekend-color") || "#e4f2ff";
workedDayViewColorInput.value = localStorage.getItem(workedDayViewColorKey) || "#d64545";
holidayColorInput.value = localStorage.getItem(holidayColorKey) || "#fff0c9";
// Restaura las preferencias visuales y de sonido almacenadas en el navegador.
const savedTheme = localStorage.getItem("limasam-theme") || (localStorage.getItem("limasam-dark-mode") === "true" ? "dark" : "light");
themeSelect.value = savedTheme;
soundToggle.checked = localStorage.getItem("limasam-sounds") !== "false";
document.body.classList.toggle("dark-mode", savedTheme === "dark");
document.body.classList.toggle("night-mode", savedTheme === "night");
document.documentElement.style.setProperty("--weekday-color", weekdayColorInput.value);
document.documentElement.style.setProperty("--weekend-color", weekendColorInput.value);
document.documentElement.style.setProperty("--holiday-color", holidayColorInput.value);

let audioContext;
let welcomeSoundPlayed = false;

// Reproduce una secuencia de notas con Web Audio si los sonidos están activados.
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

// Genera el tono breve que acompaña las acciones de la interfaz.
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

// Recupera los fondos personalizados; si el almacenamiento falla, usa valores vacíos.
function loadCustomBackgrounds() {
  try {
    const saved = JSON.parse(localStorage.getItem(customBackgroundKey) || "[]");
    return months.map((_, index) => saved[index] || null);
  } catch {
    return months.map(() => null);
  }
}

const customBackgroundData = loadCustomBackgrounds();
const themeBackgroundAssets = import.meta.glob("../assets/background-themes/*/*.{jpg,webp}", {
  eager: true,
  query: "?url",
  import: "default"
});
const customAgendaBackgrounds = customBackgroundData.map((source) => {
  if (!source) return null;
  const image = new Image();
  image.src = source;
  image.addEventListener("load", () => drawAgendaCanvas());
  return image;
});
function createAgendaBackgrounds(theme) {
  return months.map((_, index) => {
    const image = new Image();
    const assetPath = theme === "cleaning"
      ? index === 0
        ? "../assets/background-themes/cleaning/barrenderos.webp"
        : `../assets/background-themes/cleaning/barrenderos-${String(index + 1).padStart(2, "0")}.jpg`
      : `../assets/background-themes/${theme}/month-${String(index + 1).padStart(2, "0")}.jpg`;
    const assetUrl = themeBackgroundAssets[assetPath];
    if (assetUrl) image.src = assetUrl;
    image.addEventListener("load", () => drawAgendaCanvas());
    return image;
  });
}

let agendaBackgrounds = createAgendaBackgrounds(selectedBackgroundTheme);

// Prioriza el fondo personalizado del mes y, si no existe, usa el predeterminado.
function currentAgendaBackground() {
  return customAgendaBackgrounds[state.month] || agendaBackgrounds[state.month];
}

function updateShareBackgroundOption() {
  const available = backgroundToggle.checked && Boolean(customBackgroundData[state.month] || currentAgendaBackground()?.src);
  shareBackgroundToggle.disabled = !available;
  if (!available) shareBackgroundToggle.checked = false;
}

function updateBackgroundOptions() {
  backgroundOptions.hidden = !backgroundToggle.checked;
  solidBackground.hidden = backgroundToggle.checked;
}

// Rellena la lista de días según la cantidad de días del mes seleccionado.
function renderPreviewDayOptions() {
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  monthSelect.value = String(state.month);
  yearInput.value = String(state.year);
  previewDaySelect.innerHTML = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return `<option value="${day}">Día ${day}</option>`;
  }).join("");
  previewDaySelect.value = String(state.selected || 1);
}

// Convierte una imagen subida en una cadena de datos que puede guardarse localmente.
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

// Construye las claves de almacenamiento para las rutas del mes activo.
function storageKey() {
  return `limasam-${state.year}-${state.month}`;
}

function routeStorageId(year, month, day) {
  return `limasam-${year}-${month}-${day}`;
}

// Mantiene un registro de rutas borradas para propagar las eliminaciones a Drive.
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

// Recupera los datos de la última ruta para facilitar el registro de días nuevos.
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

// Carga las rutas del mes y restablece el estado si los datos guardados no son válidos.
function loadRoutes() {
  try {
    state.routes = JSON.parse(localStorage.getItem(storageKey()) || "{}");
  } catch {
    state.routes = {};
  }
}

// Guarda las rutas locales y programa su sincronización con Google Drive.
function saveRoutes() {
  localStorage.setItem(storageKey(), JSON.stringify(state.routes));
  driveChangesPending = true;
  updateSyncUi();
  queueDriveSync();
}

// Refleja en pantalla si hay cambios pendientes o cuándo se sincronizó por última vez.
function updateSyncUi() {
  const savedAt = localStorage.getItem(lastSyncKey);
  syncNowButton.hidden = !driveAccessToken;
  if (driveChangesPending) {
    syncStatus.textContent = "Cambios pendientes";
    syncStatus.title = "Hay cambios pendientes de sincronización";
    syncStatus.setAttribute("aria-label", syncStatus.title);
    syncStatus.classList.add("is-pending");
  } else if (savedAt) {
    const syncedAt = new Date(savedAt);
    const fullTimestamp = syncedAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
    syncStatus.textContent = `Última ${syncedAt.toLocaleDateString("es-ES", { dateStyle: "short" })}`;
    syncStatus.title = `Sincronizado por última vez ${fullTimestamp}`;
    syncStatus.setAttribute("aria-label", syncStatus.title);
    syncStatus.classList.remove("is-pending");
  } else {
    syncStatus.textContent = driveAccessToken ? "Sincronizado ahora" : "Sin sincronizar";
    syncStatus.title = syncStatus.textContent;
    syncStatus.setAttribute("aria-label", syncStatus.textContent);
    syncStatus.classList.remove("is-pending");
  }
}

function updateOfflineStatus() {
  offlineStatus.hidden = navigator.onLine;
}

// Registra el service worker para permitir el uso sin conexión.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((error) => console.error("No se pudo activar el modo offline", error)));
}
updateButton.addEventListener("click", async () => {
  updateButton.disabled = true;
  updateButtonLabel.textContent = "Comprobando...";
  try {
    if (!("serviceWorker" in navigator)) {
      showToast("Este navegador no permite comprobar actualizaciones automáticamente.");
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      showToast("No encontramos el actualizador. Recarga la página e inténtalo de nuevo.");
      return;
    }
    const activeWorker = registration.active;
    await registration.update();
    const worker = registration.installing || registration.waiting;
    if (!worker && registration.active === activeWorker) {
      showToast("Estás en la última versión.");
      return;
    }
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    const nextWorker = registration.installing || worker;
    if (nextWorker) {
      updateButtonLabel.textContent = "Actualizando...";
      await new Promise((resolve) => {
        let timeoutId;
        const finish = () => {
          if (!["activated", "redundant"].includes(nextWorker.state)) return;
          clearTimeout(timeoutId);
          nextWorker.removeEventListener("statechange", finish);
          resolve();
        };
        nextWorker.addEventListener("statechange", finish);
        timeoutId = setTimeout(() => {
          nextWorker.removeEventListener("statechange", finish);
          resolve();
        }, 15000);
        finish();
      });
    }
    if (registration.active && registration.active !== activeWorker) {
      showToast("Actualización instalada. Recargando la página...");
      window.location.reload();
      return;
    }
    showToast("La actualización sigue en curso. Vuelve a comprobarlo en unos segundos.");
  } catch (error) {
    console.error("No se pudo comprobar si hay actualizaciones", error);
    showToast("No pudimos comprobar las actualizaciones. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    updateButton.disabled = false;
    updateButtonLabel.textContent = "Actualizar";
  }
});
window.addEventListener("online", updateOfflineStatus);
window.addEventListener("offline", updateOfflineStatus);
updateOfflineStatus();

function markDriveSynced() {
  driveChangesPending = false;
  localStorage.setItem(lastSyncKey, new Date().toISOString());
  updateSyncUi();
}

async function getNativeGoogleAuth() {
  if (!nativeGoogleAuthPromise) {
    nativeGoogleAuthPromise = import("@capgo/capacitor-social-login")
      .then(async ({ SocialLogin }) => {
        await SocialLogin.initialize({ google: { webClientId: googleClientId } });
        return SocialLogin;
      })
      .catch((error) => {
        nativeGoogleAuthPromise = null;
        throw error;
      });
  }
  return nativeGoogleAuthPromise;
}

async function requestDriveAccessToken() {
  if (nativeAndroid()) {
    const socialLogin = await getNativeGoogleAuth();
    const response = await socialLogin.login({
      provider: "google",
      options: { scopes: ["https://www.googleapis.com/auth/drive.file"] }
    });
    const token = response.result.accessToken?.token;
    if (!token) throw new Error("Google no devolvió un token de acceso a Drive");
    return token;
  }

  await loadExternalScript("https://accounts.google.com/gsi/client");
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Google tardó demasiado en responder")), 60000);
    const finish = (callback) => (value) => {
      clearTimeout(timeout);
      callback(value);
    };
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: finish(resolve),
        error_callback: finish(reject)
      });
      client.requestAccessToken({ prompt: driveFileId ? "" : "consent" });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

async function requestCalendarAccessToken() {
  const scope = "https://www.googleapis.com/auth/calendar.events";
  if (nativeAndroid()) {
    const socialLogin = await getNativeGoogleAuth();
    const response = await socialLogin.login({ provider: "google", options: { scopes: [scope] } });
    const token = response.result.accessToken?.token;
    if (!token) throw new Error(calendarText().noToken);
    return token;
  }

  await loadExternalScript("https://accounts.google.com/gsi/client");
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Google tardó demasiado en responder")), 60000);
    const finish = (callback) => (value) => {
      clearTimeout(timeout);
      callback(value);
    };
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope,
        callback: finish((response) => response.access_token ? resolve(response.access_token) : reject(new Error(calendarText().noToken))),
        error_callback: finish(reject)
      });
      client.requestAccessToken({ prompt: "consent" });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

const calendarTexts = {
  es: { noRoutes: "No hay rutas guardadas en el mes seleccionado.", done: (n, m) => `Se importaron ${n} rutas de ${m} en Google Calendar.`, fail: "No se pudo importar el mes", noToken: "Google no devolvió un token de Calendar", destination: "Destino", noDestination: "Sin destino", status: "Estado", type: "Tipo de trabajo", route: "Ruta", shift: "Jornada", plannedEntry: "Entrada planificada", actualEntry: "Entrada fichada", plannedExit: "Salida planificada", actualExit: "Salida fichada", none: "Sin registrar", worked: "Tiempo trabajado", extra: "Horas extra", reminder: "Recordatorio", alarm: "Alarma activada", yes: "Sí", no: "No" },
  en: { noRoutes: "There are no saved routes in the selected month.", done: (n, m) => `${n} routes from ${m} were imported to Google Calendar.`, fail: "The month could not be imported", noToken: "Google did not return a Calendar token", destination: "Destination", noDestination: "No destination", status: "Status", type: "Work type", route: "Route", shift: "Workday", plannedEntry: "Planned entry", actualEntry: "Clocked entry", plannedExit: "Planned exit", actualExit: "Clocked exit", none: "Not recorded", worked: "Time worked", extra: "Overtime hours", reminder: "Reminder", alarm: "Alarm enabled", yes: "Yes", no: "No" },
  fr: { noRoutes: "Aucune tournée enregistrée pour le mois sélectionné.", done: (n, m) => `${n} tournées de ${m} ont été importées dans Google Agenda.`, fail: "Impossible d’importer le mois", noToken: "Google n’a pas renvoyé de jeton Agenda", destination: "Destination", noDestination: "Sans destination", status: "Statut", type: "Type de travail", route: "Tournée", shift: "Journée", plannedEntry: "Début prévu", actualEntry: "Début pointé", plannedExit: "Fin prévue", actualExit: "Fin pointée", none: "Non enregistré", worked: "Temps travaillé", extra: "Heures supplémentaires", reminder: "Rappel", alarm: "Alarme activée", yes: "Oui", no: "Non" },
  it: { noRoutes: "Nessun percorso salvato nel mese selezionato.", done: (n, m) => `${n} percorsi di ${m} importati in Google Calendar.`, fail: "Impossibile importare il mese", noToken: "Google non ha restituito un token di Calendar", destination: "Destinazione", noDestination: "Senza destinazione", status: "Stato", type: "Tipo di lavoro", route: "Percorso", shift: "Giornata", plannedEntry: "Entrata prevista", actualEntry: "Entrata registrata", plannedExit: "Uscita prevista", actualExit: "Uscita registrata", none: "Non registrato", worked: "Tempo lavorato", extra: "Ore extra", reminder: "Promemoria", alarm: "Allarme attivo", yes: "Sì", no: "No" },
  de: { noRoutes: "Im gewählten Monat sind keine Routen gespeichert.", done: (n, m) => `${n} Routen aus ${m} wurden in Google Kalender importiert.`, fail: "Der Monat konnte nicht importiert werden", noToken: "Google hat kein Kalender-Token zurückgegeben", destination: "Ziel", noDestination: "Kein Ziel", status: "Status", type: "Arbeitsart", route: "Route", shift: "Schicht", plannedEntry: "Geplanter Beginn", actualEntry: "Erfasster Beginn", plannedExit: "Geplantes Ende", actualExit: "Erfasstes Ende", none: "Nicht erfasst", worked: "Arbeitszeit", extra: "Überstunden", reminder: "Erinnerung", alarm: "Alarm aktiv", yes: "Ja", no: "Nein" }
};
const calendarText = () => calendarTexts[currentLanguage] || calendarTexts.es;

function calendarDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calendarEventForRoute(day, route, timeZone) {
  const date = calendarDateString(new Date(state.year, state.month, Number(day)));
  const entry = recordEntryTime(route);
  const exit = recordExitTime(route);
  const eventId = `limasam${state.year}m${String(state.month + 1).padStart(2, "0")}d${String(day).padStart(2, "0")}`;
  const text = calendarText();
  const description = [
    `${text.destination}: ${route.destination || text.noDestination}`,
    `${text.status}: ${statusLabel(route)}`,
    `${text.type}: ${routeTypes[route.type]?.label || text.route}`,
    `${text.shift}: ${route.shift || "completa"} (${shiftHours(route)} h)`,
    `${text.plannedEntry}: ${route.plannedTime || route.time || text.none}`,
    `${text.actualEntry}: ${route.actualEntry || text.none}`,
    `${text.plannedExit}: ${route.plannedExit || route.exit || text.none}`,
    `${text.actualExit}: ${route.actualExit || text.none}`,
    `${text.worked}: ${workedMinutes(entry, exit)} min`,
    `${text.extra}: ${routeExtraHours(route)}`,
    `${text.reminder}: ${Number(route.reminder ?? 30)} min`,
    `${text.alarm}: ${route.alarm === true ? text.yes : text.no}`
  ].join("\n");
  const event = {
    id: eventId,
    summary: `${route.destination || statusLabel(route)} · ${localizedMonth(state.month)} ${state.year}`,
    description
  };

  if (validTime(entry)) {
    const start = new Date(`${date}T${entry}:00`);
    let end = validTime(exit) ? new Date(`${date}T${exit}:00`) : new Date(start.getTime() + Math.max(shiftHours(route) * 60, workedMinutes(entry, exit)) * 60000);
    if (end <= start) end.setDate(end.getDate() + 1);
    event.start = { dateTime: `${date}T${entry}:00`, timeZone };
    event.end = { dateTime: `${calendarDateString(end)}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:00`, timeZone };
  } else {
    const nextDay = new Date(state.year, state.month, Number(day) + 1);
    event.start = { date };
    event.end = { date: calendarDateString(nextDay) };
  }
  return event;
}

async function importSelectedMonthToGoogleCalendar() {
  const routes = Object.entries(state.routes).filter(([, route]) => route && typeof route === "object");
  if (!routes.length) {
    showToast(calendarText().noRoutes);
    return;
  }

  googleCalendarButton.disabled = true;
  try {
    const accessToken = await requestCalendarAccessToken();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let imported = 0;
    for (const [day, route] of routes) {
      const event = calendarEventForRoute(day, route, timeZone);
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
      const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
      const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(event) });
      if (response.status === 409) {
        const update = await fetch(`${url}/${event.id}`, { method: "PATCH", headers, body: JSON.stringify(event) });
        if (!update.ok) throw new Error(`Calendar respondió ${update.status}`);
      } else if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Calendar respondió ${response.status}`);
      }
      imported += 1;
    }
    showToast(calendarText().done(imported, `${localizedMonth(state.month)} ${state.year}`));
  } catch (error) {
    console.error("No se pudo importar el mes en Google Calendar", error);
    showToast(`${calendarText().fail}: ${error.message}`);
  } finally {
    googleCalendarButton.disabled = false;
  }
}

// Carga una biblioteca externa una sola vez y espera a que esté disponible.
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

// Prepara un respaldo anual para mantener cada archivo de Drive ligero.
function cloudPayload(year) {
  const routes = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const match = key?.match(/^limasam-(\d{4})-\d+$/);
    if (!match || (Number.isInteger(year) && Number(match[1]) !== year)) continue;
    try {
      const monthRoutes = JSON.parse(localStorage.getItem(key) || "{}");
      routes[key] = Object.fromEntries(Object.entries(monthRoutes).map(([day, route]) => [day, {
        ...route,
        type: route.type || "",
        shift: route.shift || "completa",
        alarm: route.alarm === true,
        reminder: Number(route.reminder ?? 30),
        plannedTime: route.plannedTime || route.time || "",
        plannedExit: route.plannedExit || route.exit || "",
        actualEntry: route.actualEntry || "",
        actualExit: route.actualExit || "",
        workedMinutes: workedMinutes(route.time, route.exit)
      }]));
    } catch (error) {
      console.warn(`No se pudo preparar el respaldo de ${key}`, error);
    }
  }
  const holidays = Number.isInteger(year) ? customHolidays.filter((holiday) => holiday.date.startsWith(`${year}-`)) : customHolidays;
  const deletedRoutes = [...loadDeletedRoutes()].filter((key) => !Number.isInteger(year) || key.startsWith(`limasam-${year}-`));
  return { version: 3, ...(Number.isInteger(year) ? { year } : {}), updatedAt: new Date().toISOString(), routes, customHolidays: holidays, deletedRoutes };
}

function driveBackupYears() {
  const years = new Set([state.year]);
  for (let index = 0; index < localStorage.length; index += 1) {
    const match = localStorage.key(index)?.match(/^limasam-(\d{4})-\d+$/);
    if (match) years.add(Number(match[1]));
  }
  customHolidays.forEach((holiday) => years.add(Number(holiday.date.slice(0, 4))));
  loadDeletedRoutes().forEach((key) => {
    const match = key.match(/^limasam-(\d{4})-/);
    if (match) years.add(Number(match[1]));
  });
  return [...years].filter(Number.isFinite).sort((left, right) => left - right);
}

function driveYearFileName(year) {
  return `Agenda de trabajos y actividades ${year}.enc`;
}

// Centraliza las solicitudes autenticadas a la API de Google Drive.
async function driveRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${driveAccessToken}`, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Google Drive respondió ${response.status}`);
  return response;
}

async function uploadDriveFile() {
  const query = encodeURIComponent(`name contains 'Agenda de trabajos y actividades' and trashed = false and mimeType = 'application/json'`);
  const listResponse = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=1000`);
  const files = (await listResponse.json()).files || [];
  const latestByName = new Map();
  files.sort((left, right) => (right.modifiedTime || "").localeCompare(left.modifiedTime || "")).forEach((file) => {
    if (!latestByName.has(file.name)) latestByName.set(file.name, file);
  });

  for (const year of driveBackupYears()) {
    const name = driveYearFileName(year);
    const content = JSON.stringify(await encryptDriveBackup(cloudPayload(year)), null, 2);
    const body = new Blob([content], { type: "application/json" });
    const existingFile = latestByName.get(name);
    if (existingFile) {
      await driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
      driveFileId = existingFile.id;
    } else {
      const metadata = new Blob([JSON.stringify({ name, mimeType: "application/json" })], { type: "application/json" });
      const form = new FormData();
      form.append("metadata", metadata);
      form.append("file", body);
      const response = await driveRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: form });
      driveFileId = (await response.json()).id;
      latestByName.set(name, { id: driveFileId, name });
    }
  }
  if (driveFileId) localStorage.setItem("limasam-drive-file-id", driveFileId);
  markDriveSynced();
}

// Descarga respaldos anuales, migra el archivo combinado antiguo y restaura los datos.
async function syncFromDrive() {
  const query = encodeURIComponent(`name contains 'Agenda de trabajos y actividades' and trashed = false and mimeType = 'application/json'`);
  const listResponse = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=1000`);
  const files = (await listResponse.json()).files || [];
  const legacyFiles = files.filter((file) => file.name === driveFileName).sort((left, right) => (right.modifiedTime || "").localeCompare(left.modifiedTime || ""));
  const encryptedAnnualFiles = files.filter((file) => /^Agenda de trabajos y actividades \d{4}\.enc$/.test(file.name));
  const legacyAnnualFiles = files.filter((file) => /^Agenda de trabajos y actividades \d{4}\.json$/.test(file.name));
  const encryptedYears = new Set(encryptedAnnualFiles.map((file) => Number(file.name.match(/(\d{4})\.enc$/)?.[1])));
  const annualFilesToMigrate = legacyAnnualFiles.filter((file) => !encryptedYears.has(Number(file.name.match(/(\d{4})\.json$/)?.[1])));
  const filesToRead = [...legacyFiles.slice(0, 1), ...annualFilesToMigrate, ...encryptedAnnualFiles];
  if (!filesToRead.length) {
    await uploadDriveFile();
    return;
  }

  driveFileId = encryptedAnnualFiles[0]?.id || annualFilesToMigrate[0]?.id || legacyFiles[0]?.id || driveFileId;
  if (driveFileId) localStorage.setItem("limasam-drive-file-id", driveFileId);
  const payloads = await Promise.all(filesToRead.map(async (file) => {
    const response = await driveRequest(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
    return { file, payload: await decryptDriveBackup(await response.text(), file.name.endsWith(".enc")) };
  }));
  localStorage.setItem(localDriveBackupKey, JSON.stringify({ savedAt: new Date().toISOString(), payload: cloudPayload() }));

  const routes = {};
  const holidays = new Map();
  const deletedRoutes = new Set(loadDeletedRoutes());
  payloads.forEach(({ payload }) => {
    Object.entries(payload.routes || {}).forEach(([key, monthRoutes]) => {
      routes[key] = { ...(routes[key] || {}), ...(monthRoutes || {}) };
    });
    (payload.customHolidays || []).forEach((holiday) => holidays.set(holiday.date, holiday));
    (payload.deletedRoutes || []).forEach((key) => deletedRoutes.add(key));
  });

  Object.entries(routes).forEach(([key, monthRoutes]) => {
    deletedRoutes.forEach((deletedKey) => {
      const prefix = `${key}-`;
      if (deletedKey.startsWith(prefix)) delete monthRoutes[deletedKey.slice(prefix.length)];
    });
  });
  saveDeletedRoutes(deletedRoutes);
  Object.keys(localStorage).filter((key) => key.match(/^limasam-\d{4}-\d+$/)).forEach((key) => localStorage.removeItem(key));
  Object.entries(routes).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  customHolidays.splice(0, customHolidays.length, ...holidays.values());
  localStorage.setItem(customHolidayKey, JSON.stringify(customHolidays));

  renderHolidayList();
  renderCalendar();
  await refreshAndroidAlarms({ requestPermission: true });
  await uploadDriveFile();

  for (const plaintextFile of [...legacyFiles, ...legacyAnnualFiles]) {
    try {
      await driveRequest(`https://www.googleapis.com/drive/v3/files/${plaintextFile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true })
      });
    } catch (error) {
      console.warn("El respaldo cifrado se guardó, pero no se pudo retirar un JSON antiguo", error);
    }
  }
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
      driveButtonLabel.textContent = "Sincronización pendiente";
    }
  }, 500);
}

// Solicita autorización de Google y conecta la agenda con la cuenta del usuario.
async function connectGoogleDrive() {
  driveButton.disabled = true;
  driveButtonLabel.textContent = "Conectando...";
  syncStatus.textContent = "Conectando con Drive...";
  try {
    const tokenResponse = await requestDriveAccessToken();
    driveAccessToken = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.access_token;
    if (!driveAccessToken) throw new Error("No se recibió el permiso de Google");
    await syncFromDrive();
    driveAccessTokenExpiresAt = persistDriveSession(tokenResponse, driveAccessToken);
    driveButtonLabel.textContent = "Drive conectado";
    driveLogoutButton.hidden = false;
    topbarAccountActions.classList.add("is-connected");
    updateSyncUi();
    showToast("Agenda sincronizada con Google Drive");
  } catch (error) {
    console.error("No se pudo conectar Google Drive", error);
    driveAccessToken = null;
    driveAccessTokenExpiresAt = 0;
    clearDriveSession();
    driveLogoutButton.hidden = true;
    topbarAccountActions.classList.remove("is-connected");
    driveButtonLabel.textContent = "Conectar Google Drive";
    updateSyncUi();
    showToast("No se completó la conexión con Google Drive. Revisa el permiso de Google e inténtalo de nuevo.");
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
    syncStatus.textContent = "Cambios pendientes";
    showToast("No se completó la sincronización. Tus cambios siguen guardados en este dispositivo.");
  } finally {
    syncNowButton.disabled = false;
    updateSyncUi();
  }
}

async function disconnectGoogleDrive() {
  const token = driveAccessToken;
  driveAccessToken = null;
  driveAccessTokenExpiresAt = 0;
  clearDriveSession();
  clearTimeout(driveSyncTimer);
  if (nativeAndroid() && nativeGoogleAuthPromise) {
    try {
      const socialLogin = await nativeGoogleAuthPromise;
      await socialLogin.logout({ provider: "google" });
    } catch (error) {
      console.error("No se pudo cerrar la sesión de Google", error);
    }
  } else if (token && window.google?.accounts?.oauth2?.revoke) {
    await new Promise((resolve) => window.google.accounts.oauth2.revoke(token, resolve));
  }
  driveButtonLabel.textContent = "Desconectado de Google Drive";
  driveLogoutButton.hidden = true;
  topbarAccountActions.classList.remove("is-connected");
  recordCard.hidden = true;
  document.body.classList.remove("record-view");
  recordButton.textContent = "Ver expediente";
  updateSyncUi();
  showToast("Sesión de Google cerrada");
}

// Lee y valida los festivos personalizados guardados en el navegador.
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

// Formatea una fecha completa usando el idioma activo.
function dateLabel(day) {
  const locale = { es: "es-ES", en: "en-US", fr: "fr-FR", it: "it-IT", de: "de-DE" }[currentLanguage] || "es-ES";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(state.year, state.month, day));
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

// Muestra los festivos del año activo y sus acciones para eliminarlos.
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

const calendarDetailLabels = {
  es: { type: "Tipo de trabajo", shift: "Jornada", alarm: "Alarma activada" },
  en: { type: "Work type", shift: "Shift", alarm: "Alarm enabled" },
  fr: { type: "Type de travail", shift: "Journée", alarm: "Alarme activée" },
  it: { type: "Tipo di lavoro", shift: "Turno", alarm: "Sveglia attiva" },
  de: { type: "Arbeitsart", shift: "Arbeitszeit", alarm: "Alarm aktiviert" }
};

const alarmMessages = {
  es: {
    title: "Memoria laboral · Recordatorio de jornada", day: "Jornada", entry: "entrada a las", reminder: "aviso", minutes: "min antes",
    browserUnsupported: "Este navegador no admite notificaciones.", browserPermission: "Permite las notificaciones del navegador para recibir recordatorios mientras la página esté abierta.",
    androidPermission: "Para activar el recordatorio, permite las notificaciones en Android.", syncPermission: "Permite las notificaciones de Android para activar los recordatorios sincronizados.",
    futureTime: "Elige una hora futura para programar el recordatorio.", browserScheduled: "Recordatorio programado. Mantén esta página abierta.", androidScheduled: "Recordatorio programado en Android",
    scheduleError: "No se completó el recordatorio. Revisa los permisos de notificación e inténtalo de nuevo.",
    importPrompt: "¿Importar la agenda de {month} {year}? También se importarán las preferencias de alarma. Los fichajes reales solo se incluirán si se compartieron."
  },
  en: {
    title: "Work Log · Shift reminder", day: "Shift", entry: "starts at", reminder: "reminder", minutes: "min before",
    browserUnsupported: "This browser does not support notifications.", browserPermission: "Allow browser notifications to receive reminders while this page is open.",
    androidPermission: "Allow notifications on Android to enable this reminder.", syncPermission: "Allow Android notifications to enable synced reminders.",
    futureTime: "Choose a future time to schedule the reminder.", browserScheduled: "Reminder scheduled. Keep this page open.", androidScheduled: "Reminder scheduled on Android",
    scheduleError: "The reminder could not be scheduled. Check notification permissions and try again.",
    importPrompt: "Import the {month} {year} calendar? Alarm settings will also be imported. Actual clock-ins are included only if they were shared."
  },
  fr: {
    title: "Mémoire de travail · Rappel de journée", day: "Journée", entry: "entrée à", reminder: "rappel", minutes: "min avant",
    browserUnsupported: "Ce navigateur ne prend pas en charge les notifications.", browserPermission: "Autorisez les notifications du navigateur pour recevoir des rappels tant que cette page est ouverte.",
    androidPermission: "Autorisez les notifications sur Android pour activer ce rappel.", syncPermission: "Autorisez les notifications Android pour activer les rappels synchronisés.",
    futureTime: "Choisissez une heure future pour programmer le rappel.", browserScheduled: "Rappel programmé. Gardez cette page ouverte.", androidScheduled: "Rappel programmé sur Android",
    scheduleError: "Le rappel n’a pas pu être programmé. Vérifiez les autorisations de notification et réessayez.",
    importPrompt: "Importer l’agenda de {month} {year} ? Les réglages des rappels seront également importés. Les pointages réels ne seront inclus que s’ils ont été partagés."
  },
  it: {
    title: "Memoria di lavoro · Promemoria turno", day: "Turno", entry: "ingresso alle", reminder: "avviso", minutes: "min prima",
    browserUnsupported: "Questo browser non supporta le notifiche.", browserPermission: "Consenti le notifiche del browser per ricevere promemoria mentre la pagina è aperta.",
    androidPermission: "Consenti le notifiche su Android per attivare questo promemoria.", syncPermission: "Consenti le notifiche Android per attivare i promemoria sincronizzati.",
    futureTime: "Scegli un orario futuro per programmare il promemoria.", browserScheduled: "Promemoria programmato. Mantieni aperta questa pagina.", androidScheduled: "Promemoria programmato su Android",
    scheduleError: "Impossibile programmare il promemoria. Controlla i permessi di notifica e riprova.",
    importPrompt: "Importare il calendario di {month} {year}? Verranno importate anche le impostazioni dei promemoria. Le timbrature effettive saranno incluse solo se condivise."
  },
  de: {
    title: "Arbeitsprotokoll · Schichterinnerung", day: "Schicht", entry: "Beginn um", reminder: "Erinnerung", minutes: "Min. vorher",
    browserUnsupported: "Dieser Browser unterstützt keine Benachrichtigungen.", browserPermission: "Erlaube Browserbenachrichtigungen, um Erinnerungen zu erhalten, solange diese Seite geöffnet ist.",
    androidPermission: "Erlaube Benachrichtigungen auf Android, um diese Erinnerung zu aktivieren.", syncPermission: "Erlaube Android-Benachrichtigungen, um synchronisierte Erinnerungen zu aktivieren.",
    futureTime: "Wähle eine zukünftige Uhrzeit für die Erinnerung.", browserScheduled: "Erinnerung geplant. Lass diese Seite geöffnet.", androidScheduled: "Erinnerung auf Android geplant",
    scheduleError: "Die Erinnerung konnte nicht geplant werden. Prüfe die Benachrichtigungsberechtigungen und versuche es erneut.",
    importPrompt: "Kalender für {month} {year} importieren? Die Erinnerungseinstellungen werden ebenfalls importiert. Tatsächliche Stempelzeiten werden nur übernommen, wenn sie geteilt wurden."
  }
};

function alarmText(key) {
  return (alarmMessages[currentLanguage] || alarmMessages.es)[key];
}

function alarmNotificationBody(route) {
  const text = alarmMessages[currentLanguage] || alarmMessages.es;
  return `${route.destination || text.day} · ${text.entry} ${route.time}${Number(route.reminder || 0) ? ` · ${text.reminder} ${route.reminder} ${text.minutes}` : ""}`;
}

function importAgendaPrompt(month, year) {
  return alarmText("importPrompt").replace("{month}", month).replace("{year}", String(year));
}

function shiftHours(shift) {
  return ({ completa: 8, continua: 7, media: 4 })[shift] || 8;
}

function reminderOffset(reminder) {
  return ({ 15: "-15", 30: "-30", 60: "-1H", 120: "-2" })[Number(reminder)] || "";
}

function routeDisplayName(route) {
  return route.destination || statusLabel(route);
}

// Valida y manipula horas en formato de 24 horas (HH:MM).
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

// Calcula una hora de salida sumando la duración de la jornada a la entrada.
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

const annualSummaryLocale = {
  es: { days: "días", regular: "normales", extra: "extra" },
  en: { days: "days", regular: "regular", extra: "overtime" },
  fr: { days: "jours", regular: "normales", extra: "supplémentaires" },
  it: { days: "giorni", regular: "ordinarie", extra: "straordinari" },
  de: { days: "Tage", regular: "reguläre", extra: "Überstunden" }
};

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

// Registra la hora real de entrada o salida cuando se trabaja en el día actual.
function registerCurrentTime(target) {
  const today = new Date();
  const selectedDate = new Date(state.year, state.month, state.selected);
  const isToday = state.selected && selectedDate.getFullYear() === today.getFullYear()
    && selectedDate.getMonth() === today.getMonth()
    && selectedDate.getDate() === today.getDate();
  if (!isToday) {
    showToast("Para registrar la hora actual, selecciona la fecha de hoy.");
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

// Actualiza los contadores del mes y las horas extra de cada ruta.
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

// Reúne y ordena las rutas almacenadas para los doce meses del año indicado.
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

// Calcula los indicadores anuales, gráficos y filas del expediente.
function renderAnnualSummary() {
  const locale = annualSummaryLocale[currentLanguage] || annualSummaryLocale.es;
  const reportMonths = localizedMonths[currentLanguage] || months;
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
  renderRecordYearOptions();
  $("#annualTotalCount").textContent = records.length;
  $("#workedCount").textContent = weekdayWorked;
  $("#holidayWorkedCount").textContent = counts["festivo-trabajado"] || 0;
  $("#leaveCount").textContent = counts.baja || 0;
  $("#personalCount").textContent = counts["asuntos-propios"] || 0;
  $("#vacationCount").textContent = counts.vacaciones || 0;
  $("#extensionCount").textContent = counts.ampliaciones || 0;
  $("#extraHoursCount").textContent = totalExtraHours;
  $("#normalHoursCount").textContent = formatTotalHours(totalNormalMinutes);
  $("#comparisonMonthLabel").textContent = reportMonths[state.month];
  $("#comparisonMonthDays").textContent = `${currentMonthRecords.length} ${locale.days}`;
  $("#comparisonMonthHours").textContent = `${formatTotalHours(currentMonthMinutes)} ${locale.regular} · ${currentMonthExtraHours} h ${locale.extra}`;
  $("#comparisonYearDays").textContent = `${records.length} ${locale.days}`;
  $("#comparisonYearHours").textContent = `${formatTotalHours(totalNormalMinutes)} ${locale.regular} · ${totalExtraHours} h ${locale.extra}`;
  $("#monthlyStats").innerHTML = months.map((month, monthIndex) => {
    const reportMonth = reportMonths[monthIndex];
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
    return `<div class="month-row"><span class="month-name">${reportMonth.slice(0, 3)}</span><div class="month-track" aria-label="${reportMonth}: ${total} ${locale.days}, ${values.extra} ${locale.extra}"><span class="month-bar bar-worked" style="--bar-size:${values.worked}"></span><span class="month-bar bar-holiday" style="--bar-size:${values.holiday}"></span><span class="month-bar bar-vacation" style="--bar-size:${values.vacation}"></span><span class="month-bar bar-leave" style="--bar-size:${values.leave}"></span><span class="month-bar bar-personal" style="--bar-size:${values.personal}"></span><span class="month-bar bar-extension" style="--bar-size:${values.extension}"></span><span class="month-bar bar-extra" style="--bar-size:${values.extra}"></span></div><strong class="month-total">${total} + ${values.extra} h</strong></div>`;
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
  $("#fanLabels").innerHTML = reportMonths.map((month, index) => `<span style="--fan-color:${fanColors[index]}">${month.slice(0, 3)} ${monthlyTotals[index]}</span>`).join("");
  $("#recordRows").innerHTML = records.length
    ? records.map((record) => `<tr><td>${String(record.day).padStart(2, "0")}/${String(record.month + 1).padStart(2, "0")}/${state.year}</td><td><span class="status-pill status-${record.status || "trabajado"}">${escapeHtml(statusLabel(record))}</span></td><td>${escapeHtml(routeDisplayName(record))}</td><td>${escapeHtml(recordEntryTime(record) || "Sin entrada")}</td><td>${escapeHtml(recordExitTime(record) || "Sin salida")}</td><td>${formatWorkedTime(workedMinutes(recordEntryTime(record), recordExitTime(record)))}</td><td>${routeExtraHours(record)} h</td></tr>`).join("")
    : "<tr><td class=\"record-empty\" colspan=\"7\">Todavía no hay registros para este año</td></tr>";
}

// Descarga contenido generado por la aplicación como un archivo local.
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
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(16);
  pdf.text(`Expediente de ${state.year}`, 14, 18);
  pdf.setFontSize(10);
  pdf.text("Memoria laboral", 14, 25);
  autoTable(pdf, {
    startY: 31,
    head: [["Fecha", "Estado", "Destino", "Entrada", "Salida", "Tiempo trabajado", "Horas extra"]],
    body: records.length ? records.map((record) => [
      `${String(record.day).padStart(2, "0")}/${String(record.month + 1).padStart(2, "0")}/${state.year}`,
      statusLabel(record),
      routeDisplayName(record),
      recordEntryTime(record) || "Sin entrada",
      recordExitTime(record) || "Sin salida",
      formatWorkedTime(workedMinutes(recordEntryTime(record), recordExitTime(record))),
      `${routeExtraHours(record)} h`
    ]) : [[{ content: "Sin registros", colSpan: 7, styles: { halign: "center" } }]],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [32, 124, 98] }
  });
  pdf.save(`expediente-${state.year}.pdf`);
  showToast("PDF descargado");
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

// Escapa caracteres HTML para mostrar con seguridad los datos introducidos.
function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[character]));
}

function visibleWeekDates() {
  const anchor = new Date(state.year, state.month, state.selected || 1);
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
}

function localizedCalendarDate(date) {
  const locale = { es: "es-ES", en: "en-US", fr: "fr-FR", it: "it-IT", de: "de-DE" }[currentLanguage] || "es-ES";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function showCalendarDate(date, revealPlanner = true) {
  state.year = date.getFullYear();
  state.month = date.getMonth();
  state.selected = date.getDate();
  monthSelect.value = state.month;
  yearInput.value = state.year;
  holidayDateInput.value = `${state.year}-${String(state.month + 1).padStart(2, "0")}-01`;
  loadRoutes();
  renderPreviewDayOptions();
  updateShareBackgroundOption();
  renderHolidayList();
  renderCalendar();
  if (!recordCard.hidden) renderAnnualSummary();
  selectDay(state.selected, { revealPlanner, focusInput: revealPlanner });
}

function moveCalendarWeek(amount) {
  const target = new Date(state.year, state.month, state.selected || 1);
  target.setDate(target.getDate() + amount * 7);
  showCalendarDate(target, false);
}

function moveCalendarMonth(amount) {
  const target = new Date(state.year, state.month + amount, 1);
  if (target.getFullYear() < 2000 || target.getFullYear() > 2100) return;
  const selectedDay = Math.min(state.selected || 1, new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
  showCalendarDate(new Date(target.getFullYear(), target.getMonth(), selectedDay), false);
}

// Construye la cuadrícula mensual o semanal sin modificar las preferencias de fondo.
function renderCalendar() {
  loadRoutes();
  refreshBrowserAlarms();
  calendarGrid.classList.remove("month-enter");
  void calendarGrid.offsetWidth;
  calendarGrid.classList.add("month-enter");
  calendarGrid.innerHTML = "";

  calendarGrid.classList.remove("is-week-view", "is-month-view");
  calendarGrid.setAttribute("aria-label", localizedUiText("Calendario mensual"));
  $(".month-summary").hidden = false;
  $("#calendarTitle").textContent = `${localizedMonth(state.month)} ${state.year}`;
  $("#stampMonth").textContent = localizedMonth(state.month).toUpperCase();
  $("#stampYear").textContent = state.year;

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const visibleDates = Array.from({ length: daysInMonth }, (_, index) => new Date(state.year, state.month, index + 1));
  const weekdayLabels = localizedWeekdays[currentLanguage] || localizedWeekdays.es;
  const today = new Date();
  const routeCache = new Map([[storageKey(), state.routes]]);
  const routesForDate = (date) => {
    const key = `limasam-${date.getFullYear()}-${date.getMonth()}`;
    if (!routeCache.has(key)) {
      try {
        routeCache.set(key, JSON.parse(localStorage.getItem(key) || "{}"));
      } catch {
        routeCache.set(key, {});
      }
    }
    return routeCache.get(key)[date.getDate()];
  };
  const holidayForDate = (date) => customHolidays.find((holiday) => holiday.date === calendarDateString(date));
  const isCalendarHoliday = (date) => nationalHolidays.has(`${date.getMonth() + 1}-${date.getDate()}`) || Boolean(holidayForDate(date));

  for (let index = 0; index < offset; index += 1) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day-cell is-empty";
    calendarGrid.appendChild(emptyCell);
  }

  for (const date of visibleDates) {
    const day = date.getDate();
    const route = routesForDate(date);
    const holiday = isCalendarHoliday(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-cell";
    button.setAttribute("role", "gridcell");
    const detailLabels = calendarDetailLabels[currentLanguage] || calendarDetailLabels.es;
    const reminderLabel = route?.alarm ? reminderOffset(route.reminder) : "";
    const routeDescription = route ? [
      `${routeDisplayName(route)} ${shiftHours(route.shift)}h`,
      route.time || "",
      route.type?.trim() ? `${detailLabels.type}: ${route.type.trim()}` : "",
      route.alarm ? `${detailLabels.alarm}${reminderLabel ? ` ${reminderLabel}` : ""}` : ""
    ].filter(Boolean).join(", ") : "";
    button.setAttribute("aria-label", `${localizedCalendarDate(date)}${routeDescription ? `, ${routeDescription}` : ""}`);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) button.classList.add("is-weekend");
    if (route) {
      button.classList.add("has-route", `route-${routeTypes[route.type] ? route.type : "ruta"}`, `status-${route.status || "trabajado"}`);
    }
    if (holiday) button.classList.add("is-holiday");
    if (today.getDate() === day && today.getMonth() === date.getMonth() && today.getFullYear() === date.getFullYear()) button.classList.add("is-today");
    if (state.selected === day && date.getMonth() === state.month && date.getFullYear() === state.year) button.classList.add("is-selected");

    const weekdayName = weekdayLabels[(dayOfWeek + 6) % 7];
    button.innerHTML = `<span class="day-number">${day}</span>`;
    if (holiday) button.innerHTML += `<span class="holiday-label">${escapeHtml(holidayForDate(date)?.name || "Festivo")}</span>`;
    if (route) {
      const alarmIndicator = route.alarm
        ? `<span class="route-alarm" title="${detailLabels.alarm}" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M12.2 6.5a4.2 4.2 0 0 0-8.4 0c0 4.8-1.6 4.8-1.6 6.1h11.6c0-1.3-1.6-1.3-1.6-6.1ZM6.4 14.1h3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${reminderLabel ? `<span class="route-reminder">(${reminderLabel})</span>` : ""}`
        : "";
      button.innerHTML += `<span class="route-dot" aria-hidden="true"></span><span class="route-preview">${escapeHtml(routeDisplayName(route))} ${shiftHours(route.shift)}h</span><span class="route-time-row"><span class="route-time">${escapeHtml(route.time || statusLabel(route))}</span>${alarmIndicator}</span>`;
      if (route.type?.trim()) button.innerHTML += `<span class="route-meta">${escapeHtml(route.type.trim())}</span>`;
    }
    button.addEventListener("click", () => {
      if (date.getMonth() !== state.month || date.getFullYear() !== state.year) showCalendarDate(date);
      else selectDay(day);
    });
    calendarGrid.appendChild(button);
  }

  const cellCount = offset + daysInMonth;
  const trailingCells = (7 - (cellCount % 7)) % 7;
  for (let index = 0; index < trailingCells; index += 1) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day-cell is-empty";
    calendarGrid.appendChild(emptyCell);
  }

  updateFooterGroup();
  updateMonthSummary();
  renderAnnualSummary();
  drawAgendaCanvas();
}

// Carga en el formulario los datos del día seleccionado o una ruta recordada.
function selectDay(day, { useRemembered = true, revealPlanner = true, focusInput = true } = {}) {
  state.selected = day;
  previewDaySelect.value = String(day);
  if (revealPlanner) {
    plannerDetails.open = true;
    routeManager.open = true;
  }
  calendarGrid.querySelectorAll("button").forEach((button) => button.classList.remove("is-selected"));
  const selectedButton = [...calendarGrid.querySelectorAll("button")]
    .find((button) => button.querySelector(".day-number")?.textContent === String(day));
  selectedButton?.classList.add("is-selected");

  const rememberedRoute = loadRememberedRoute();
  const wasCleared = loadDeletedRoutes().has(routeStorageId(state.year, state.month, day));
  const route = state.routes[day] || (useRemembered && rememberedRoute && !wasCleared ? { ...rememberedRoute, reminder: 30 } : { destination: "", time: "", type: "", reminder: 30, status: "trabajado", shift: "continua", exit: "", alarm: true });
  $("#selectedDayBadge").textContent = day;
  $("#editorTitle").textContent = `Día ${day}`;
  $("#routeDate").textContent = dateLabel(day);
  $("#destinationInput").value = route.destination;
  $("#typeInput").value = route.type || "";
  $("#timeInput").value = route.actualEntry || route.plannedTime || route.time || "";
  $("#timeInput").dataset.punch = route.actualEntry ? "true" : "false";
  syncClockParts($("#timeInput"), entryHourInput, entryMinuteInput);
  shiftInput.value = route.shift || "continua";
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
  if (focusInput) $("#destinationInput").focus();
  drawAgendaCanvas();
  translatePage();
  if (mobileLayoutEnabled && activeMobilePage === "agenda" && revealPlanner) {
    routeManager.open = true;
    mobileRouteTitle.textContent = $("#editorTitle").textContent;
    if (!mobileRouteDialog.open) mobileRouteDialog.showModal();
  }
}

// Convierte la posición del clic en la vista previa al día correspondiente.
function openAgendaZoom() {
  if (agendaZoomDialog.open) return;
  agendaZoomCanvas.width = agendaCanvas.width;
  agendaZoomCanvas.height = agendaCanvas.height;
  agendaZoomCanvas.getContext("2d").drawImage(agendaCanvas, 0, 0);
  agendaZoomDialog.showModal();
}

function selectCanvasDay(event) {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const onBackground = () => {
    if (canvas === agendaCanvas) {
      openAgendaZoom();
      return;
    }
    agendaZoomDialog.close();
  };

  if (isLandscapeMobile()) {
    let selectedDate;
    if (calendarView === "week") {
      const { margin, gridTop, rowHeight, rowGap, cardWidth } = landscapeWeekLayout(canvas);
      const row = Math.floor((y - gridTop) / (rowHeight + rowGap));
      const dates = visibleWeekDates();
      const rowY = gridTop + row * (rowHeight + rowGap);
      if (x < margin || x > margin + cardWidth || row < 0 || row >= dates.length || y > rowY + rowHeight) {
        onBackground();
        return;
      }
      selectedDate = dates[row];
    } else {
      const layout = landscapeMonthLayout(canvas);
      const horizontalGap = layout.compact ? layout.gridGap : layout.columnGap;
      const column = Math.floor((x - layout.margin) / (layout.cellWidth + horizontalGap));
      const row = Math.floor((y - layout.gridTop) / (layout.cellHeight + layout.gridGap));
      const day = row * 7 + column - layout.offset + 1;
      const cellX = layout.margin + column * (layout.cellWidth + horizontalGap);
      const cellY = layout.gridTop + row * (layout.cellHeight + layout.gridGap);
      if (column < 0 || column >= layout.columns || row < 0 || row >= layout.rows || day < 1 || day > layout.daysInMonth || x > cellX + layout.cellWidth || y > cellY + layout.cellHeight) {
        onBackground();
        return;
      }
      if (layout.compact) {
        const radius = Math.min(layout.cellHeight * 0.43, layout.cellWidth * 0.19);
        const centerX = cellX + layout.cellWidth / 2;
        const centerY = cellY + layout.cellHeight / 2;
        if (Math.hypot(x - centerX, y - centerY) > radius + 8) {
          onBackground();
          return;
        }
      }
      selectedDate = new Date(state.year, state.month, day);
    }
    showCalendarDate(selectedDate);
    if (canvas === agendaZoomCanvas) agendaZoomDialog.close();
    return;
  }

  if (calendarView === "week") {
    const margin = 72;
    const gridTop = 320;
    const rowHeight = 130;
    const rowGap = 10;
    if (x < margin || x > canvas.width - margin || y < gridTop) {
      onBackground();
      return;
    }
    const row = Math.floor((y - gridTop) / (rowHeight + rowGap));
    const rowY = gridTop + row * (rowHeight + rowGap);
    if (row < 0 || row >= 7 || y > rowY + rowHeight) {
      onBackground();
      return;
    }
    showCalendarDate(visibleWeekDates()[row]);
    if (canvas === agendaZoomCanvas) agendaZoomDialog.close();
    return;
  }

  const margin = 72;
  const gridTop = 470;
  const gridGap = 14;
  const cellWidth = (1600 - margin * 2 - gridGap * 6) / 7;
  const cellHeight = 148;
  if (x < margin || y < gridTop) {
    onBackground();
    return;
  }
  const column = Math.floor((x - margin) / (cellWidth + gridGap));
  const row = Math.floor((y - gridTop) / (cellHeight + gridGap));
  if (column > 6 || row < 0 || row > 5) {
    onBackground();
    return;
  }
  const cellX = margin + column * (cellWidth + gridGap);
  const cellY = gridTop + row * (cellHeight + gridGap);
  if (x > cellX + cellWidth || y > cellY + cellHeight) {
    onBackground();
    return;
  }
  const firstDay = new Date(state.year, state.month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const day = row * 7 + column - offset + 1;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  if (day >= 1 && day <= daysInMonth) {
    selectDay(day);
    if (canvas === agendaZoomCanvas) agendaZoomDialog.close();
  } else {
    onBackground();
  }
}

// Muestra mensajes temporales de confirmación o error en la interfaz.
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function nativeAndroid() {
  return Capacitor.isNativePlatform();
}

function isMobileExperience() {
  return nativeAndroid() || mobileViewportQuery.matches;
}

webSettingsTabs?.addEventListener("toggle", (event) => {
  const activeTab = event.target;
  if (!(activeTab instanceof HTMLDetailsElement) || !activeTab.open || isMobileExperience()) return;
  webSettingsTabs.querySelectorAll("details[open]").forEach((tab) => {
    if (tab !== activeTab) tab.open = false;
  });
}, true);

function isLandscapeMobile() {
  return isMobileExperience() && mobileLandscapeQuery.matches;
}

function setMobilePage(page) {
  if (!isMobileExperience()) return;
  activeMobilePage = page;
  const pageIndex = { agenda: 0, stats: 1, settings: 2, help: 3 }[page] ?? 0;
  const isAgenda = pageIndex === 0;
  const isStats = pageIndex === 1;
  const isSettings = pageIndex === 2;
  const isHelp = pageIndex === 3;
  if (!isAgenda && mobileRouteDialog.open) mobileRouteDialog.close();
  if (isSettings) mobileConfigurationDetails.open = true;
  if (nativeAndroid()) {
    ScreenOrientation.unlock().catch(() => {});
  } else if (window.screen?.orientation?.unlock) {
    Promise.resolve().then(() => window.screen.orientation.unlock()).catch(() => {});
  }
  webWelcomeBanner.hidden = !isAgenda || mobileLayoutEnabled;
  [introBlock, agendaPreview].forEach((section) => {
    section.hidden = !isAgenda;
  });
  formPanel.hidden = true;
  preferencesPanel.hidden = !isSettings;
  recordCard.hidden = !isStats;
  mobileSettingsPage.hidden = !isSettings;
  mobileHelpPage.hidden = !isHelp;
  mobileHelpSection.open = isHelp;
  document.body.classList.toggle("record-view", isStats);
  document.body.classList.toggle("settings-view", isSettings);
  document.body.classList.toggle("help-view", isHelp);
  mobileOrientationHint.hidden = isLandscapeMobile() || !isAgenda;
  mobilePageTabs.activeTabIndex = pageIndex;
  updateCalendarViewButton();
  if (isStats) renderAnnualSummary();
  if (isAgenda) renderCalendar();
}

function restorePortal(element, anchor) {
  anchor.parentNode.insertBefore(element, anchor.nextSibling);
}

function syncMobileLayout() {
  const shouldEnable = isMobileExperience();
  if (shouldEnable === mobileLayoutEnabled) return;
  mobileLayoutEnabled = shouldEnable;
  if (shouldEnable) {
    document.body.classList.add("native-android");
    configurationWasOpenBeforeMobile = mobileConfigurationDetails.open;
    mobileConfigurationDetails.open = true;
    mobileSettingsControls.append(topbarLocaleActions, topbarAccountActions);
    mobileSettingsPlanning.append(plannerDetails);
    mobileSettingsPreferences.append(preferencesPanel);
    mobileHelpContent.append(mobileHelpSection);
    mobileRouteDialogContent.append(routeManager);
    previewMonthYearControls.append(monthFieldGroup, yearFieldGroup);
    setMobilePage(activeMobilePage);
    return;
  }

  restorePortal(topbarLocaleActions, mobileLocaleHome);
  restorePortal(topbarAccountActions, mobileAccountHome);
  restorePortal(plannerDetails, mobilePlanningHome);
  restorePortal(preferencesPanel, mobilePreferencesHome);
  mobileConfigurationDetails.open = configurationWasOpenBeforeMobile;
  restorePortal(mobileHelpSection, mobileHelpHome);
  restorePortal(routeManager, mobileRouteManagerHome);
  restorePortal(monthFieldGroup, monthFieldHome);
  restorePortal(yearFieldGroup, yearFieldHome);
  document.body.classList.remove("native-android", "settings-view", "help-view");
  document.body.classList.toggle("record-view", activeMobilePage === "stats");
  [webWelcomeBanner, introBlock, formPanel, agendaPreview].forEach((section) => { section.hidden = false; });
  mobileSettingsPage.hidden = true;
  preferencesPanel.hidden = false;
  recordCard.hidden = activeMobilePage !== "stats";
}

mobileViewportQuery.addEventListener("change", syncMobileLayout);
mobileLandscapeQuery.addEventListener("change", () => {
  if (!mobileLayoutEnabled) return;
  mobileOrientationHint.hidden = mobileLandscapeQuery.matches || activeMobilePage !== "agenda";
  updateCalendarViewButton();
  renderCalendar();
});

function browserAlarmKey(year, month, day) {
  return `${year}-${month}-${day}`;
}

function routeAlarmTime(year, month, day, route) {
  if (!route || typeof route !== "object") return null;
  if (!route.alarm || !route.time || ["baja", "asuntos-propios", "descanso"].includes(route.status)) return null;
  const [hour, minute] = route.time.split(":").map(Number);
  const reminder = Number(route.reminder || 0);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59 || !Number.isFinite(reminder) || reminder < 0) return null;
  const entryAt = new Date(year, month, day, hour, minute);
  if (entryAt.getFullYear() !== year || entryAt.getMonth() !== month || entryAt.getDate() !== day) return null;
  const alarmAt = new Date(entryAt.getTime() - reminder * 60_000);
  return alarmAt > new Date() ? alarmAt : null;
}

function storedRouteEntries() {
  const entries = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    const match = storageKey?.match(/^limasam-(\d{4})-(\d{1,2})$/);
    if (!match) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month > 11) continue;
    try {
      const routes = JSON.parse(localStorage.getItem(storageKey) || "{}");
      Object.entries(routes).forEach(([day, route]) => {
        const numericDay = Number(day);
        if (Number.isInteger(numericDay)) entries.push({ year, month, day: numericDay, route });
      });
    } catch {
      continue;
    }
  }
  return entries;
}

function scheduleBrowserAlarm(year, month, day, route) {
  const key = browserAlarmKey(year, month, day);
  const alarmAt = routeAlarmTime(year, month, day, route);
  if (!alarmAt) {
    const existing = browserAlarmTimers.get(key);
    if (existing) clearTimeout(existing.timeout);
    browserAlarmTimers.delete(key);
    return;
  }
  const body = alarmNotificationBody(route);
  const existing = browserAlarmTimers.get(key);
  if (existing?.at === alarmAt.getTime() && existing.body === body) return;
  if (existing) clearTimeout(existing.timeout);
  const timeout = setTimeout(async () => {
    browserAlarmTimers.delete(key);
    if (Date.now() < alarmAt.getTime()) {
      scheduleBrowserAlarm(year, month, day, route);
      return;
    }
    if (Notification.permission !== "granted") return;
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(alarmText("title"), { body, icon: "icon.svg", tag: `jornada-${key}` });
      } else {
        new Notification(alarmText("title"), { body, tag: `jornada-${key}` });
      }
    } catch (error) {
      console.error("No se pudo mostrar el recordatorio web", error);
    }
  }, Math.min(alarmAt.getTime() - Date.now(), 2147483647));
  browserAlarmTimers.set(key, { timeout, at: alarmAt.getTime(), body });
}

function refreshBrowserAlarms() {
  if (nativeAndroid() || !("Notification" in window) || Notification.permission !== "granted") return;
  const activeKeys = new Set();
  storedRouteEntries().forEach(({ year, month, day, route }) => {
    const key = browserAlarmKey(year, month, day);
    if (routeAlarmTime(year, month, day, route)) activeKeys.add(key);
    scheduleBrowserAlarm(year, month, day, route);
  });
  browserAlarmTimers.forEach(({ timeout }, key) => {
    if (!activeKeys.has(key)) {
      clearTimeout(timeout);
      browserAlarmTimers.delete(key);
    }
  });
}

function androidAlarmId(year, month, day) {
  return year * 10000 + (month + 1) * 100 + day;
}

function androidAlarmNotification({ year, month, day, route, alarmAt }) {
  return {
    id: androidAlarmId(year, month, day),
    title: alarmText("title"),
    body: alarmNotificationBody(route),
    schedule: { at: alarmAt },
    sound: "default"
  };
}

async function refreshAndroidAlarms({ requestPermission = false } = {}) {
  if (!nativeAndroid()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const pending = await LocalNotifications.getPending();
    const routeNotifications = pending.notifications.filter(({ id }) => id >= 20000000 && id <= 21001231);
    if (routeNotifications.length) await LocalNotifications.cancel({ notifications: routeNotifications });

    const notifications = storedRouteEntries()
      .map((entry) => ({ ...entry, alarmAt: routeAlarmTime(entry.year, entry.month, entry.day, entry.route) }))
      .filter((entry) => entry.alarmAt)
      .map(androidAlarmNotification);
    if (!notifications.length) return;

    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted" && requestPermission) permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") {
      if (requestPermission) showToast(alarmText("syncPermission"));
      return;
    }
    await LocalNotifications.schedule({ notifications });
  } catch (error) {
    console.error("No se pudieron sincronizar los recordatorios de Android", error);
  }
}

// Programa un recordatorio en la plataforma actual y cancela antes cualquier versión anterior.
async function scheduleAlarm(day, route) {
  await cancelAlarm(day);
  if (!route.alarm || !route.time || ["baja", "asuntos-propios", "descanso"].includes(route.status)) return;
  if (!nativeAndroid()) {
    if (!("Notification" in window)) {
      showToast(alarmText("browserUnsupported"));
      return;
    }
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") {
      showToast(alarmText("browserPermission"));
      return;
    }
    refreshBrowserAlarms();
    showToast(alarmText("browserScheduled"));
    return;
  }
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") {
      showToast(alarmText("androidPermission"));
      return;
    }
    const [hour, minute] = route.time.split(":").map(Number);
    const at = new Date(state.year, state.month, day, hour, minute);
    at.setMinutes(at.getMinutes() - Number(route.reminder || 0));
    if (at <= new Date()) {
      showToast(alarmText("futureTime"));
      return;
    }
    const id = androidAlarmId(state.year, state.month, day);
    await LocalNotifications.cancel({ notifications: [{ id }] });
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: alarmText("title"),
        body: alarmNotificationBody(route),
        schedule: { at },
        sound: "default"
      }]
    });
    showToast(alarmText("androidScheduled"));
  } catch (error) {
    console.error("No se pudo programar la alarma", error);
    showToast(alarmText("scheduleError"));
  }
}

async function cancelAlarm(day) {
  const key = browserAlarmKey(state.year, state.month, day);
  const browserTimer = browserAlarmTimers.get(key);
  if (browserTimer) clearTimeout(browserTimer.timeout);
  browserAlarmTimers.delete(key);
  if (!nativeAndroid()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const id = androidAlarmId(state.year, state.month, day);
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (error) {
    console.error("No se pudo cancelar la alarma", error);
  }
}

function fillUppercaseText(context, text, ...coordinates) {
  context.font = context.font.replace(/^(?:400|500|600)\s/, "700 ");
  context.fillText(String(text).toLocaleUpperCase(currentLanguage), ...coordinates);
}

// Ajusta textos largos a un máximo de dos líneas en el lienzo de la agenda.
function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
  const words = String(text).toLocaleUpperCase(currentLanguage).split(" ");
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
  lines.slice(0, 2).forEach((currentLine, index) => fillUppercaseText(context, currentLine, x, y + index * lineHeight));
}

function drawAlarmBell(context, centerX, centerY, color) {
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(centerX - 9, centerY + 5);
  context.quadraticCurveTo(centerX - 5, centerY + 2, centerX - 5, centerY - 4);
  context.quadraticCurveTo(centerX - 4, centerY - 10, centerX, centerY - 10);
  context.quadraticCurveTo(centerX + 5, centerY - 10, centerX + 5, centerY - 4);
  context.lineTo(centerX + 5, centerY + 1);
  context.quadraticCurveTo(centerX + 5, centerY + 4, centerX + 9, centerY + 5);
  context.closePath();
  context.fill();
  context.beginPath();
  context.arc(centerX, centerY + 8, 1.8, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function canvasTextColorForFill(color) {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return "#17211f";
  const channels = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255);
  const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2] > 0.52 ? "#17211f" : "#ffffff";
}

function drawWeeklyAgendaCanvas() {
  const canvas = $("#agendaCanvas");
  const context = canvas.getContext("2d");
  const width = 1600;
  const margin = 72;
  const gridTop = 320;
  const rowHeight = 130;
  const rowGap = 10;
  const rowWidth = width - margin * 2;
  const dates = visibleWeekDates();
  const height = gridTop + dates.length * (rowHeight + rowGap) + 54;
  const agendaBackground = currentAgendaBackground();
  const locale = { es: "es-ES", en: "en-US", fr: "fr-FR", it: "it-IT", de: "de-DE" }[currentLanguage] || "es-ES";
  canvas.width = width;
  canvas.height = height;

  if (backgroundToggle.checked && agendaBackground.complete && agendaBackground.naturalWidth) {
    const scale = Math.max(width / agendaBackground.naturalWidth, height / agendaBackground.naturalHeight);
    const imageWidth = agendaBackground.naturalWidth * scale;
    const imageHeight = agendaBackground.naturalHeight * scale;
    context.drawImage(agendaBackground, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
    context.fillStyle = "rgba(245,247,243,.26)";
    context.fillRect(0, 0, width, height);
  } else if (!backgroundToggle.checked) {
    context.fillStyle = backgroundColorInput.value;
    context.fillRect(0, 0, width, height);
  }

  const drawPanel = (x, y, panelWidth, panelHeight, fill, stroke) => {
    context.fillStyle = fill;
    context.beginPath();
    context.roundRect(x, y, panelWidth, panelHeight, 16);
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
  };
  const headerX = margin - 18;
  drawPanel(headerX, 46, 900, 100, "rgba(23,33,31,.94)", "rgba(255,255,255,.35)");
  drawPanel(headerX, 166, 900, 64, "rgba(242,125,101,.94)", "rgba(255,255,255,.72)");
  context.fillStyle = "#17211f";
  context.fillRect(0, 0, width, 17);
  context.fillStyle = "#ffffff";
  context.font = "700 44px Arial";
  fillUppercaseText(context, languageTranslations[currentLanguage]?.["Memoria laboral"] || "Memoria laboral", margin + 28, 101);
  context.fillStyle = "#ccefe1";
  context.font = "700 18px Arial";
  fillUppercaseText(context, localizedCalendarLabels[currentLanguage] || localizedCalendarLabels.es, margin + 28, 132);
  const rangeStart = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(dates[0]);
  const rangeEnd = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(dates[dates.length - 1]);
  context.fillStyle = "#17211f";
  context.font = "700 40px Arial";
  drawWrappedText(context, `${rangeStart} – ${rangeEnd}`, margin, 208, 840, 42);

  const routeCache = new Map([[storageKey(), state.routes]]);
  const routeForDate = (date) => {
    const key = `limasam-${date.getFullYear()}-${date.getMonth()}`;
    if (!routeCache.has(key)) {
      try {
        routeCache.set(key, JSON.parse(localStorage.getItem(key) || "{}"));
      } catch {
        routeCache.set(key, {});
      }
    }
    return routeCache.get(key)[date.getDate()];
  };
  const holidayForDate = (date) => customHolidays.find((holiday) => holiday.date === calendarDateString(date));
  dates.forEach((date, index) => {
    const rowY = gridTop + index * (rowHeight + rowGap);
    const route = routeForDate(date);
    const customHoliday = holidayForDate(date);
    const holiday = nationalHolidays.has(`${date.getMonth() + 1}-${date.getDate()}`) || Boolean(customHoliday);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const fill = route ? "rgba(255,255,255,.96)" : holiday ? holidayColorInput.value : calendarColor(weekend ? "--weekend-color" : "--weekday-color", weekend ? "#e4f2ff" : "#ffffff");
    drawPanel(margin, rowY, rowWidth, rowHeight, fill, route ? "rgba(217,101,78,.68)" : "rgba(113,128,122,.42)");
    context.fillStyle = route ? workedDayViewColorInput.value : "rgba(32,124,98,.9)";
    context.beginPath();
    context.roundRect(margin, rowY, 14, rowHeight, [10, 0, 0, 10]);
    context.fill();
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
    const dayDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);
    context.fillStyle = "#17211f";
    context.font = "700 20px Arial";
    fillUppercaseText(context, weekday, margin + 34, rowY + 48);
    context.font = "600 18px Arial";
    fillUppercaseText(context, dayDate, margin + 34, rowY + 78);
    if (state.selected === date.getDate() && state.month === date.getMonth() && state.year === date.getFullYear()) {
      context.strokeStyle = "#f27d65";
      context.lineWidth = 4;
      context.strokeRect(margin + 2, rowY + 2, rowWidth - 4, rowHeight - 4);
    }
    if (route) {
      const x = margin + 300;
      context.fillStyle = routeColor(route);
      context.font = "700 25px Arial";
      drawWrappedText(context, `${routeDisplayName(route)} · ${shiftHours(route.shift)} h`, x, rowY + 48, rowWidth - 350, 28);
      const entry = route.actualEntry || route.plannedTime || route.time || "";
      const exit = route.actualExit || route.plannedExit || route.exit || "";
      const schedule = entry ? `${entry}${exit ? ` – ${exit}` : ""}` : statusLabel(route);
      const details = [route.type?.trim(), schedule, routeExtraHours(route) ? `${routeExtraHours(route)} h` : ""].filter(Boolean).join(" · ");
      context.fillStyle = "#40534b";
      context.font = "600 18px Arial";
      drawWrappedText(context, details, x, rowY + 88, rowWidth - 350, 22);
      if (route.alarm) drawAlarmBell(context, margin + rowWidth - 30, rowY + 34, "#d9654e");
    } else {
      context.fillStyle = "#71807a";
      context.font = "600 19px Arial";
      const label = customHoliday?.name || (holiday ? holidayLabel(date.getDate()) : localizedUiText("Sin actividad programada"));
      drawWrappedText(context, label, margin + 300, rowY + 61, rowWidth - 350, 24);
    }
  });
  context.fillStyle = "#71807a";
  context.font = "500 15px Arial";
  const calendarCredit = currentLanguage === "en" ? "Calendar generated with Work Memory" : currentLanguage === "fr" ? "Calendrier généré avec Mémoire de travail" : currentLanguage === "it" ? "Calendario creato con Memoria lavorativa" : currentLanguage === "de" ? "Kalender erstellt mit Arbeitsgedächtnis" : "Calendario generado con Memoria laboral";
  fillUppercaseText(context, calendarCredit, margin, height - 20);
  return canvas;
}

function drawLandscapeCanvasBackground(context, width, height) {
  const background = backgroundToggle.checked ? currentAgendaBackground() : null;
  if (background?.complete && background.naturalWidth) {
    const scale = Math.max(width / background.naturalWidth, height / background.naturalHeight);
    const imageWidth = background.naturalWidth * scale;
    const imageHeight = background.naturalHeight * scale;
    context.drawImage(background, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
    context.fillStyle = "rgba(245,247,243,.3)";
    context.fillRect(0, 0, width, height);
    return;
  }
  context.fillStyle = backgroundToggle.checked ? "#f5f7f3" : backgroundColorInput.value;
  context.fillRect(0, 0, width, height);
}

function landscapeCanvasLogicalHeight(canvas, width) {
  const availableWidth = canvas.clientWidth || Math.max(1, window.innerWidth - 35);
  const availableHeight = Math.max(160, window.innerHeight - 114);
  return Math.round(width * availableHeight / availableWidth);
}

function landscapeMonthLayout(canvas) {
  const width = 1600;
  const margin = 36;
  const compact = calendarView === "filled";
  const gridTop = compact ? 80 : 88;
  const gridGap = compact ? 4 : 8;
  const columnGap = compact ? gridGap : 14;
  const firstDay = new Date(state.year, state.month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const columns = 7;
  const rows = Math.ceil((offset + daysInMonth) / 7);
  const cellWidth = (width - margin * 2 - columnGap * (columns - 1)) / columns;
  const cellHeight = compact
    ? Math.max(54, Math.min(96, (landscapeCanvasLogicalHeight(canvas, width) - gridTop - 8) / rows - gridGap))
    : Math.max(96, Math.min(124, (landscapeCanvasLogicalHeight(canvas, width) - gridTop - 8) / rows - gridGap));
  return { width, margin, compact, gridTop, gridGap, columnGap, cellHeight, firstDay, offset, daysInMonth, columns, rows, cellWidth };
}

function landscapeWeekLayout(canvas) {
  const width = 1600;
  const margin = 36;
  const gridTop = 66;
  const rowGap = 5;
  const rowHeight = Math.max(58, Math.min(82, (landscapeCanvasLogicalHeight(canvas, width) - gridTop - 12) / 7 - rowGap));
  const cardWidth = width - margin * 2;
  const height = gridTop + 7 * (rowHeight + rowGap) + 12;
  return { width, margin, gridTop, rowHeight, rowGap, cardWidth, height };
}

function drawLandscapeMonthCanvas() {
  const canvas = $("#agendaCanvas");
  const context = canvas.getContext("2d");
  const { width, margin, compact, gridTop, gridGap, columnGap, cellHeight, firstDay, offset, daysInMonth, columns, rows, cellWidth } = landscapeMonthLayout(canvas);
  const height = gridTop + rows * (cellHeight + gridGap) + 8;
  canvas.width = width;
  canvas.height = height;
  drawLandscapeCanvasBackground(context, width, height);
  context.fillStyle = "#17211f";
  context.beginPath();
  context.roundRect(margin, 8, width - margin * 2, 48, 12);
  context.fill();
  context.fillStyle = "#fff";
  context.font = "700 32px Arial";
  fillUppercaseText(context, `${(localizedMonths[currentLanguage] || months)[state.month]} ${state.year}`, margin + 18, 41);
  const weekdays = localizedWeekdays[currentLanguage] || localizedWeekdays.es;
  context.font = "700 18px Arial";
  weekdays.forEach((weekday, column) => {
    const x = margin + column * (cellWidth + columnGap);
    context.fillStyle = "#40534b";
    context.textAlign = "center";
    context.fillText(weekday, x + cellWidth / 2, 73);
  });
  context.textAlign = "left";

  for (let day = 1; day <= daysInMonth; day += 1) {
    const index = offset + day - 1;
    const column = index % 7;
    const row = Math.floor(index / 7);
    const x = margin + column * (cellWidth + columnGap);
    const y = gridTop + row * (cellHeight + gridGap);
    const date = new Date(state.year, state.month, day);
    const route = state.routes[day];
    const holiday = isHoliday(day);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const fill = route && compact
      ? workedDayViewColorInput.value
      : route ? "#dff4e8" : holiday ? holidayColorInput.value : calendarColor(weekend ? "--weekend-color" : "--weekday-color", weekend ? "#e4f2ff" : "#fff");
    if (!compact) {
      context.fillStyle = fill;
      context.beginPath();
      context.roundRect(x, y, cellWidth, cellHeight, 12);
      context.fill();
      context.strokeStyle = "rgba(113,128,122,.36)";
      context.lineWidth = 1;
      context.stroke();
    }

    if (compact) {
      const radius = Math.min(cellHeight * 0.43, cellWidth * 0.19);
      const centerX = x + cellWidth / 2;
      const centerY = y + cellHeight / 2;
      const badgeFill = fill;
      context.fillStyle = badgeFill;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = state.selected === day ? "#f27d65" : "rgba(23,33,31,.28)";
      context.lineWidth = state.selected === day ? 3 : 1.5;
      context.stroke();
      context.fillStyle = canvasTextColorForFill(badgeFill);
      context.font = `700 ${Math.round(radius * 1.12)}px Arial`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(day), centerX, centerY + 1);
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
    } else {
      context.fillStyle = "#17211f";
      context.font = "700 25px Arial";
      context.fillText(String(day), x + 9, y + 27);
      const textX = x + 9;
      const textWidth = cellWidth - 18;
      if (route) {
        const title = route.destination?.trim() || route.type?.trim() || statusLabel(route);
        const entry = route.actualEntry || route.plannedTime || route.time || "";
        const exit = route.actualExit || route.plannedExit || route.exit || "";
        const schedule = entry ? `${entry}${exit ? ` – ${exit}` : ""}` : statusLabel(route);
        const details = [route.type?.trim(), schedule, routeExtraHours(route) ? `${routeExtraHours(route)} h extra` : ""].filter(Boolean).join(" · ");
        context.fillStyle = routeColor(route);
        context.font = "700 22px Arial";
        drawWrappedText(context, title, textX, y + 52, textWidth, 20);
        context.fillStyle = "#40534b";
        context.font = "600 17px Arial";
        drawWrappedText(context, details, textX, y + 84, textWidth, 18);
      } else {
        const label = customHolidays.find((item) => item.date === calendarDateString(date))?.name
          || (holiday ? holidayLabel(day) : "");
        context.fillStyle = "#53645c";
        context.font = "600 18px Arial";
        drawWrappedText(context, label, textX, y + 60, textWidth, 19);
      }
    }
  }
  return canvas;
}

function drawLandscapeAgendaCanvas() {
  const canvas = $("#agendaCanvas");
  const context = canvas.getContext("2d");
  const { width, margin, gridTop, columnGap, rowHeight, rowGap, cardWidth, height } = landscapeWeekLayout(canvas);
  const dates = visibleWeekDates();
  const locale = { es: "es-ES", en: "en-US", fr: "fr-FR", it: "it-IT", de: "de-DE" }[currentLanguage] || "es-ES";
  canvas.width = width;
  canvas.height = height;

  drawLandscapeCanvasBackground(context, width, height);

  context.fillStyle = "#17211f";
  context.beginPath();
  context.roundRect(margin, 10, width - margin * 2, 46, 12);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "700 30px Arial";
  fillUppercaseText(context, localizedUiText("Agenda semanal"), margin + 18, 41);
  const rangeStart = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(dates[0]);
  const rangeEnd = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(dates[6]);
  context.textAlign = "right";
  context.font = "600 22px Arial";
  context.fillText(`${rangeStart} – ${rangeEnd}`, width - margin - 18, 40);
  context.textAlign = "left";

  const routeCache = new Map();
  const routeForDate = (date) => {
    const key = `limasam-${date.getFullYear()}-${date.getMonth()}`;
    if (!routeCache.has(key)) {
      try {
        routeCache.set(key, JSON.parse(localStorage.getItem(key) || "{}"));
      } catch {
        routeCache.set(key, {});
      }
    }
    return routeCache.get(key)[date.getDate()];
  };

  dates.forEach((date, index) => {
    const row = index;
    const x = margin;
    const y = gridTop + row * (rowHeight + rowGap);
    const route = date.getMonth() === state.month && date.getFullYear() === state.year
      ? state.routes[date.getDate()]
      : routeForDate(date);
    const customHoliday = customHolidays.find((holiday) => holiday.date === calendarDateString(date));
    const holiday = nationalHolidays.has(`${date.getMonth() + 1}-${date.getDate()}`) || Boolean(customHoliday);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const fill = route ? "#ffffff" : holiday ? holidayColorInput.value : calendarColor(weekend ? "--weekend-color" : "--weekday-color", weekend ? "#e4f2ff" : "#ffffff");
    context.fillStyle = fill;
    context.beginPath();
    context.roundRect(x, y, cardWidth, rowHeight, 12);
    context.fill();
    context.strokeStyle = route ? "rgba(217,101,78,.68)" : "rgba(113,128,122,.42)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = route ? workedDayViewColorInput.value : "#207c62";
    context.beginPath();
    context.roundRect(x, y, 9, rowHeight, [8, 0, 0, 8]);
    context.fill();

    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
    const dayDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
    context.fillStyle = "#17211f";
    context.font = "700 22px Arial";
    context.fillText(`${weekday} ${dayDate}`, x + 20, y + Math.round(rowHeight * 0.58));
    if (route) {
      const detailX = x + 182;
      const textWidth = cardWidth - 198;
      context.fillStyle = routeColor(route);
      context.font = "700 21px Arial";
      drawWrappedText(context, routeDisplayName(route), detailX, y + 25, textWidth, 20);
      const entry = route.actualEntry || route.plannedTime || route.time || "";
      const exit = route.actualExit || route.plannedExit || route.exit || "";
      const schedule = entry ? `${entry}${exit ? ` – ${exit}` : ""}` : statusLabel(route);
      const details = [route.type?.trim(), schedule, routeExtraHours(route) ? `${routeExtraHours(route)} h` : ""].filter(Boolean).join(" · ");
      context.fillStyle = "#40534b";
      context.font = "600 16px Arial";
      drawWrappedText(context, details, detailX, y + rowHeight - 8, textWidth, 17);
    } else {
      context.fillStyle = "#71807a";
      context.font = "600 18px Arial";
      const emptyLabel = customHoliday?.name || (holiday ? holidayLabel(date.getDate()) : localizedUiText("Sin actividad programada"));
      drawWrappedText(context, emptyLabel, x + 182, y + Math.round(rowHeight * 0.58), cardWidth - 198, 18);
    }
    if (state.selected === date.getDate() && state.month === date.getMonth() && state.year === date.getFullYear()) {
      context.strokeStyle = "#f27d65";
      context.lineWidth = 4;
      context.strokeRect(x + 2, y + 2, cardWidth - 4, rowHeight - 4);
    }
  });
  return canvas;
}

// Dibuja la agenda mensual completa en el lienzo que se comparte o descarga.
function drawAgendaCanvas() {
  if (isLandscapeMobile()) return calendarView === "week" ? drawLandscapeAgendaCanvas() : drawLandscapeMonthCanvas();
  if (calendarView === "week") return drawWeeklyAgendaCanvas();
  const filledMonthView = calendarView === "filled";
  const canvas = $("#agendaCanvas");
  const context = canvas.getContext("2d");
  const agendaBackground = currentAgendaBackground();
  const width = 1600;
  const margin = 72;
  const gridTop = 470;
  const gridGap = 14;
  const cellHeight = 148;
  const firstDay = new Date(state.year, state.month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const calendarRows = Math.ceil((offset + daysInMonth) / 7);
  const height = gridTop + calendarRows * (cellHeight + gridGap) + 72;
  const cellWidth = (width - margin * 2 - gridGap * 6) / 7;
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
  fillUppercaseText(context, languageTranslations[currentLanguage]?.["Memoria laboral"] || "Memoria laboral", margin + 28, 101);
  context.fillStyle = "#ccefe1";
  context.font = "700 18px Arial";
  fillUppercaseText(context, localizedCalendarLabels[currentLanguage] || localizedCalendarLabels.es, margin + 28, 132);
  context.fillStyle = "#17211f";
  context.font = "700 58px Arial";
  fillUppercaseText(context, `${(localizedMonths[currentLanguage] || months)[state.month]} ${state.year}`, margin, 218);
  if (hasGroup) {
    context.fillStyle = "#ffffff";
    context.font = "500 20px Arial";
    const groupLabel = localizedGroupLabels[currentLanguage]?.assigned || localizedGroupLabels.es.assigned;
    fillUppercaseText(context, `${groupLabel} ${groupName}`, margin, 260);
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
    fillUppercaseText(context, day, x + cellWidth / 2, weekdayY + 20);
  });
  context.textAlign = "left";

  for (let day = 1; day <= daysInMonth; day += 1) {
    const position = offset + day - 1;
    const column = position % 7;
    const row = Math.floor(position / 7);
    const x = margin + column * (cellWidth + gridGap);
    const y = gridTop + row * (cellHeight + gridGap);
    const route = state.routes[day];
    const isWeekend = column >= 5;
    const holiday = isHoliday(day);

    if (filledMonthView) {
      const dayCircleColor = route
        ? workedDayViewColorInput.value
        : holiday
          ? holidayColorInput.value
          : isWeekend
            ? calendarColor("--weekend-color", "#e4f2ff")
            : "";
      const centerX = x + cellWidth / 2;
      const centerY = y + cellHeight / 2;
      if (dayCircleColor) {
        context.fillStyle = dayCircleColor;
        context.beginPath();
        context.arc(centerX, centerY, 38, 0, Math.PI * 2);
        context.fill();
      }
      if (state.selected === day) {
        context.strokeStyle = "#17211f";
        context.lineWidth = 3;
        context.beginPath();
        context.arc(centerX, centerY, 43, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = dayCircleColor ? canvasTextColorForFill(dayCircleColor) : "#17211f";
      context.font = "700 42px Arial";
      context.textAlign = "center";
      fillUppercaseText(context, String(day), centerX, centerY + 14);
      context.textAlign = "left";
      continue;
    }

    const cellColor = holiday ? holidayColorInput.value : (isWeekend ? calendarColor("--weekend-color", "#e4f2ff") : calendarColor("--weekday-color", "#ffffff"));
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
      context.strokeStyle = "#17211f";
      context.lineWidth = 3;
      context.stroke();
    }
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.fillStyle = canvasTextColorForFill(cellColor);
    context.font = "700 22px Arial";
    fillUppercaseText(context, String(day), x + 17, y + 29);
    if (route) {
      context.fillStyle = "#17211f";
      context.font = "700 17px Arial";
      drawWrappedText(context, `${routeDisplayName(route)} ${shiftHours(route.shift)}h`, x + 17, y + 58, cellWidth - 34, 21);
      context.font = "600 17px Arial";
      if (route.type?.trim()) fillUppercaseText(context, route.type.trim(), x + 17, y + 99, cellWidth - 34);
      const timeText = route.time ? `${route.time}${route.exit ? ` - ${route.exit}` : ""}` : statusLabel(route);
      const reminderText = reminderOffset(route.reminder);
      const timeReserve = route.alarm ? (reminderText ? 94 : 56) : 34;
      context.font = "700 17px Arial";
      fillUppercaseText(context, timeText, x + 17, y + 138, cellWidth - timeReserve);
      if (route.alarm) {
        drawAlarmBell(context, x + cellWidth - (reminderText ? 68 : 30), y + 132, "#d9654e");
        if (reminderText) {
          context.font = "700 16px Arial";
          fillUppercaseText(context, `(${reminderText})`, x + cellWidth - 50, y + 137, 42);
        }
      }
    }

  }

  const rows = Math.ceil((offset + daysInMonth) / 7);
  context.fillStyle = "#71807a";
  context.font = "500 15px Arial";
  const calendarCredit = currentLanguage === "en" ? "Calendar generated with Work Memory" : currentLanguage === "fr" ? "Calendrier généré avec Mémoire de travail" : currentLanguage === "it" ? "Calendario creato con Memoria lavorativa" : currentLanguage === "de" ? "Kalender erstellt mit Arbeitsgedächtnis" : "Calendario generado con Memoria laboral";
  fillUppercaseText(context, calendarCredit, margin, gridTop + rows * (cellHeight + gridGap) + 28);

  return canvas;
}

// Codifica los datos de agenda para incluirlos de forma compacta en un enlace.
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

// Deriva una clave criptográfica para proteger los datos incluidos en el enlace.
async function deriveSharedKey(salt) {
  const password = Uint8Array.from(atob("bWVtb3JpYWxhYm9yYWw="), (character) => character.charCodeAt(0));
  const material = await crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// Cifra la agenda antes de compartirla para evitar exponer sus datos directamente.
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

// Selecciona qué datos del mes se compartirán según las opciones marcadas.
function sharedMonthPayload() {
  const routes = Object.fromEntries(Object.entries(state.routes).map(([day, route]) => [day, {
    destination: route.destination || "",
    type: route.type || "",
    time: route.plannedTime || route.time || "",
    exit: route.plannedExit || route.exit || addHoursToTime(route.plannedTime || route.time || "", route.shift === "media" ? 4 : route.shift === "continua" ? 7 : 8),
    shift: route.shift || "completa",
    status: route.status || "trabajado",
    extraHours: routeExtraHours(route),
    alarm: route.alarm === true,
    reminder: Number(route.reminder ?? 30),
    ...(sharePunchesToggle.checked ? { actualEntry: route.actualEntry || "", actualExit: route.actualExit || "" } : {})
  }]));
  return { app: "memoria-laboral", version: 4, month: state.month, year: state.year, group: groupInput.value.trim(), theme: themeSelect.value, weekdayColor: weekdayColorInput.value, weekendColor: weekendColorInput.value, workedDayViewColor: workedDayViewColorInput.value, holidayColor: holidayColorInput.value, backgroundTheme: shareBackgroundToggle.checked ? selectedBackgroundTheme : null, background: shareBackgroundToggle.checked ? customBackgroundData[state.month] : null, routes, customHolidays: customHolidays.filter((holiday) => holiday.date.startsWith(`${state.year}-${String(state.month + 1).padStart(2, "0")}-`)) };
}

async function createSharedMonthUrl() {
  const encoded = await encryptSharedAgenda(sharedMonthPayload());
  const shareUrl = new URL(publicAppUrl);
  shareUrl.searchParams.set("import", encoded);
  return shareUrl.toString();
}

async function shareMonthAgenda() {
  const link = await createSharedMonthUrl();
  const message = `Memoria laboral · ${months[state.month]} ${state.year}\nAbre este enlace para importar la agenda del mes:\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  showToast("Enlace del mes preparado para WhatsApp");
}

async function showMonthShareQr() {
  showQrButton.disabled = true;
  try {
    const shareUrl = await createSharedMonthUrl();
    shareQrImage.src = await QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 280
    });
    shareQrDialog.showModal();
  } catch (error) {
    console.error("No se pudo generar el código QR", error);
    showToast("No se pudo generar el código QR.");
  } finally {
    showQrButton.disabled = false;
  }
}

// Valida e importa una agenda compartida, actualizando las preferencias incluidas.
async function importSharedAgenda(encodedFromApp = null) {
  const match = window.location.hash.match(/^#agenda=(.+)$/);
  const encoded = encodedFromApp || new URLSearchParams(window.location.search).get("import") || match?.[1];
  if (!encoded) return;
  try {
    const payload = await decodeSharedAgendaSecure(encoded);
    if (payload.app !== "memoria-laboral" || !Number.isInteger(payload.month) || !Number.isInteger(payload.year)) throw new Error("Enlace no válido");
    const monthName = (localizedMonths[currentLanguage] || months)[payload.month] || "mes";
    if (window.confirm(importAgendaPrompt(monthName, payload.year))) {
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
        backgroundToggle.checked = true;
        localStorage.setItem("limasam-show-background", "true");
        updateBackgroundOptions();
        sharedImage.addEventListener("load", () => drawAgendaCanvas());
      }
      if (payload.backgroundTheme && backgroundThemes.includes(payload.backgroundTheme)) {
        selectedBackgroundTheme = payload.backgroundTheme;
        backgroundThemeSelect.value = selectedBackgroundTheme;
        agendaBackgrounds = createAgendaBackgrounds(selectedBackgroundTheme);
        backgroundToggle.checked = true;
        localStorage.setItem("limasam-background-theme", selectedBackgroundTheme);
        localStorage.setItem("limasam-show-background", "true");
        updateBackgroundOptions();
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
      if (/^#[0-9a-f]{6}$/i.test(payload.workedDayViewColor || "")) {
        workedDayViewColorInput.value = payload.workedDayViewColor;
        localStorage.setItem(workedDayViewColorKey, payload.workedDayViewColor);
      }
      if (/^#[0-9a-f]{6}$/i.test(payload.holidayColor || "")) {
        holidayColorInput.value = payload.holidayColor;
        document.documentElement.style.setProperty("--holiday-color", payload.holidayColor);
        localStorage.setItem(holidayColorKey, payload.holidayColor);
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
      await refreshAndroidAlarms({ requestPermission: true });
      selectDay(1);
      showToast("Agenda mensual importada");
    }
  } catch {
    showToast("No pudimos importar la agenda. Comprueba que el enlace esté completo e inténtalo de nuevo.");
  } finally {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function listenNativeAgendaLinks() {
  if (!nativeAndroid()) return;
  const { App } = await import("@capacitor/app");
  const handleAgendaUrl = ({ url }) => {
    try {
      const parsed = new URL(url);
      const encoded = parsed.searchParams.get("data") || parsed.searchParams.get("import");
      const isCustomImport = parsed.protocol === "memoria-laboral:" && parsed.hostname === "import";
      const isWebImport = parsed.protocol === "https:" && parsed.hostname === "mvisions.github.io" && parsed.pathname.startsWith("/perfect-proyect/");
      if ((isCustomImport || isWebImport) && encoded) importSharedAgenda(encoded);
    } catch {
      showToast("No pudimos abrir la agenda. Comprueba que el enlace esté completo e inténtalo de nuevo.");
    }
  };
  await App.addListener("appUrlOpen", handleAgendaUrl);
  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) handleAgendaUrl(launchUrl);
}

// Exporta como PNG la vista actual de la agenda mensual.
async function downloadPng() {
  const canvas = drawAgendaCanvas();
  const weekDates = calendarView === "week" ? visibleWeekDates() : null;
  const fileName = weekDates
    ? `memoria-laboral-semana-${calendarDateString(weekDates[0])}-${calendarDateString(weekDates[6])}.png`
    : `memoria-laboral-${calendarView === "filled" ? "circulos-" : ""}${months[state.month].toLowerCase()}-${state.year}.png`;
  if (nativeAndroid()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share")
      ]);
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      const shareText = calendarView === "week" ? "Agenda semanal de Memoria laboral" : calendarView === "filled" ? "Agenda mensual con días marcados de Memoria laboral" : "Agenda mensual de Memoria laboral";
      await Share.share({ title: fileName, text: shareText, files: [uri], dialogTitle: "Guardar o compartir PNG" });
      showToast("Elige dónde guardar o compartir el PNG");
    } catch (error) {
      console.error("No se pudo exportar el PNG", error);
      showToast("No se pudo guardar el PNG. Inténtalo de nuevo.");
    }
    return;
  }
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("PNG descargado correctamente");
}

// Los siguientes manejadores conectan los controles con el estado y sus persistencias.
calendarViewToggle.addEventListener("click", () => {
  calendarView = availableCalendarViews[(availableCalendarViews.indexOf(calendarView) + 1) % availableCalendarViews.length];
  localStorage.setItem(calendarViewStorageKey, calendarView);
  updateCalendarViewButton();
  drawAgendaCanvas();
});
previousWeekButton.addEventListener("click", () => moveCalendarWeek(-1));
nextWeekButton.addEventListener("click", () => moveCalendarWeek(1));
previousMonthButton.addEventListener("click", () => moveCalendarMonth(-1));
nextMonthButton.addEventListener("click", () => moveCalendarMonth(1));
todayButton.addEventListener("click", () => showCalendarDate(new Date(), false));

monthSelect.addEventListener("change", () => {
  const month = Number(monthSelect.value);
  const day = Math.min(state.selected || Number(previewDaySelect.value) || 1, new Date(state.year, month + 1, 0).getDate());
  showCalendarDate(new Date(state.year, month, day), false);
});
yearInput.addEventListener("change", () => {
  const year = Number(yearInput.value);
  if (year >= 2000 && year <= 2100) {
    const day = Math.min(state.selected || Number(previewDaySelect.value) || 1, new Date(year, state.month + 1, 0).getDate());
    showCalendarDate(new Date(year, state.month, day), false);
  }
});

// Años con datos guardados más el año activo y el siguiente.
function renderRecordYearOptions() {
  const years = new Set([state.year, state.year + 1, new Date().getFullYear()]);
  Object.keys(localStorage).forEach((key) => {
    const match = key.match(/^limasam-(\d{4})-\d+$/);
    if (match) years.add(Number(match[1]));
  });
  const select = $("#recordYearSelect");
  select.innerHTML = [...years].filter((year) => year >= 2000 && year <= 2100).sort((a, b) => a - b).map((year) => `<option value="${year}">${year}</option>`).join("");
  select.value = state.year;
}

function changeRecordYear(year) {
  if (!(year >= 2000 && year <= 2100)) return;
  yearInput.value = year;
  yearInput.dispatchEvent(new Event("change"));
}
$("#recordYearSelect").addEventListener("change", (event) => changeRecordYear(Number(event.target.value)));
$("#recordYearPrev").addEventListener("click", () => changeRecordYear(state.year - 1));
$("#recordYearNext").addEventListener("click", () => changeRecordYear(state.year + 1));
$("#addHolidayButton").addEventListener("click", () => {
  const date = holidayDateInput.value;
  const name = holidayNameInput.value.trim();
  if (!date || !name) {
    showToast("Completa la fecha y el nombre del festivo para guardarlo.");
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
agendaZoomCanvas.addEventListener("click", selectCanvasDay);
agendaZoomClose.addEventListener("click", () => agendaZoomDialog.close());
backgroundToggle.addEventListener("change", () => {
  localStorage.setItem("limasam-show-background", String(backgroundToggle.checked));
  updateBackgroundOptions();
  updateShareBackgroundOption();
  drawAgendaCanvas();
});
backgroundThemeSelect.addEventListener("change", () => {
  selectedBackgroundTheme = backgroundThemeSelect.value;
  localStorage.setItem("limasam-background-theme", selectedBackgroundTheme);
  agendaBackgrounds = createAgendaBackgrounds(selectedBackgroundTheme);
  updateShareBackgroundOption();
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
workedDayViewColorInput.addEventListener("input", () => {
  localStorage.setItem(workedDayViewColorKey, workedDayViewColorInput.value);
  drawAgendaCanvas();
});
holidayColorInput.addEventListener("input", () => {
  document.documentElement.style.setProperty("--holiday-color", holidayColorInput.value);
  localStorage.setItem(holidayColorKey, holidayColorInput.value);
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
    showToast("No se cargaron las imágenes. Prueba con otros archivos e inténtalo de nuevo.");
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

function openDriveTutorial() {
  if (typeof driveTutorialDialog.showModal === "function") driveTutorialDialog.showModal();
  else connectGoogleDrive();
}

function closeDriveTutorial() {
  driveTutorialDialog.close();
}

driveButton.addEventListener("click", openDriveTutorial);
driveTutorialClose.addEventListener("click", closeDriveTutorial);
driveTutorialCancel.addEventListener("click", closeDriveTutorial);
driveTutorialContinue.addEventListener("click", () => {
  closeDriveTutorial();
  connectGoogleDrive();
});
driveTutorialDialog.addEventListener("click", (event) => {
  if (event.target === driveTutorialDialog) closeDriveTutorial();
});
syncNowButton.addEventListener("click", syncNow);
mobilePageTabs?.addEventListener("change", () => {
  setMobilePage(mobilePageTabs.activeTab?.dataset.mobilePage || "agenda");
});
mobileRouteDialogClose?.addEventListener("click", () => mobileRouteDialog.close());
mobileRouteDialog?.addEventListener("click", (event) => {
  if (event.target === mobileRouteDialog) mobileRouteDialog.close();
});
pdfButton.addEventListener("click", downloadRecordPdf);
csvButton.addEventListener("click", downloadRecordCsv);
shareRecordButton.addEventListener("click", shareRecordSummary);
googleCalendarButton.addEventListener("click", importSelectedMonthToGoogleCalendar);
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

// Valida y guarda la ruta del día, conserva las horas fichadas y programa su alarma.
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
    showToast("Añade un destino para guardar la ruta trabajada.");
    return;
  }
  if (time && !validTime(time)) {
    $("#timeInput").focus();
    showToast("Revisa la hora de entrada y usa el formato HH:MM, por ejemplo 08:30.");
    return;
  }
  if (exit && !validTime(exit)) {
    exitInput.focus();
    showToast("Revisa la hora de salida y usa el formato HH:MM, por ejemplo 17:30.");
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
  if (mobileRouteDialog.open) mobileRouteDialog.close();
});

$("#clearRememberedButton").addEventListener("click", () => {
  if (!window.confirm("¿Quieres borrar el recuerdo de la última ruta?")) return;
  localStorage.removeItem(rememberedRouteKey);
  if (state.selected) selectDay(state.selected, { useRemembered: false });
  showToast("Recuerdo borrado");
});

$("#clearButton").addEventListener("click", async () => {
  const selectedDay = state.selected;
  if (selectedDay && window.confirm("¿Quieres vaciar todos los datos de este día?")) {
    delete state.routes[selectedDay];
    markRouteDeleted(selectedDay);
    saveRoutes();
    renderCalendar();
    selectDay(selectedDay, { useRemembered: false });
    await cancelAlarm(selectedDay);
    showToast("Día vaciado");
  }
});

// Inicializa la página con los datos guardados y prepara la agenda para usarla.
$("#downloadButton").addEventListener("click", downloadPng);
$("#shareMonthButton").addEventListener("click", shareMonthAgenda);
showQrButton.addEventListener("click", showMonthShareQr);
shareQrClose.addEventListener("click", () => shareQrDialog.close());
shareQrDialog.addEventListener("click", (event) => {
  if (event.target === shareQrDialog) shareQrDialog.close();
});
importSharedAgenda();
listenNativeAgendaLinks();
renderHolidayList();
renderCalendar();
refreshAndroidAlarms();
updateShareBackgroundOption();
selectDay(1, { revealPlanner: false });
translatePage();
$("#shareButton")?.remove();
$(".agenda-preview").appendChild($(".export-actions"));
$(".export-actions").appendChild($(".share-punches-toggle"));
webWelcomeBanner.hidden = false;
syncMobileLayout();
if (driveAccessToken) {
  driveButtonLabel.textContent = "Drive conectado";
  driveLogoutButton.hidden = false;
  topbarAccountActions.classList.add("is-connected");
}
updateSyncUi();
