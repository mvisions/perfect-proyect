const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

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
const installButton = $("#installButton");
const offlineStatus = $("#offlineStatus");
const previewDaySelect = $("#previewDaySelect");
const agendaCanvas = $("#agendaCanvas");
const routeManager = $("#routeManager");
const recordButton = $("#recordButton");
const recordCard = $("#recordCard");
const customBackgroundKey = "limasam-custom-backgrounds";
let driveAccessToken = null;
let driveFileId = localStorage.getItem("limasam-drive-file-id");
let driveSyncTimer = null;
let driveChangesPending = false;
let deferredInstallPrompt = null;
backgroundToggle.checked = localStorage.getItem("limasam-show-background") !== "false";
backgroundColorInput.value = localStorage.getItem("limasam-background-color") || "#f5f7f3";
weekdayColorInput.value = localStorage.getItem("limasam-weekday-color") || "#ffffff";
weekendColorInput.value = localStorage.getItem("limasam-weekend-color") || "#e4f2ff";
const savedTheme = localStorage.getItem("limasam-theme") || (localStorage.getItem("limasam-dark-mode") === "true" ? "dark" : "light");
themeSelect.value = savedTheme;
document.body.classList.toggle("dark-mode", savedTheme === "dark");
document.body.classList.toggle("night-mode", savedTheme === "night");
document.documentElement.style.setProperty("--weekday-color", weekdayColorInput.value);
document.documentElement.style.setProperty("--weekend-color", weekendColorInput.value);

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
    reminder: Number(route.reminder || 0),
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
    if (key?.match(/^limasam-\d{4}-\d+$/)) routes[key] = JSON.parse(localStorage.getItem(key));
  }
  return { version: 1, updatedAt: new Date().toISOString(), routes, customHolidays };
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
  Object.keys(localStorage).filter((key) => key.match(/^limasam-\d{4}-\d+$/)).forEach((key) => localStorage.removeItem(key));
  Object.entries(payload.routes || {}).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  if (Array.isArray(payload.customHolidays)) {
    customHolidays.splice(0, customHolidays.length, ...payload.customHolidays);
    localStorage.setItem(customHolidayKey, JSON.stringify(customHolidays));
  }
  renderHolidayList();
  renderCalendar();
  markDriveSynced();
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
  return `${day} de ${months[state.month].toLowerCase()} de ${state.year}`;
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
  return dayStatuses[route?.status] || dayStatuses.trabajado;
}

function routeDisplayName(route) {
  return route.destination || statusLabel(route);
}

function validTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function addHoursToTime(value, hours) {
  if (!validTime(value)) return "";
  const [hour, minute] = value.split(":").map(Number);
  const totalMinutes = (hour * 60 + minute + hours * 60) % (24 * 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function autoFillExit() {
  const hours = shiftInput.value === "media" ? 4 : shiftInput.value === "continua" ? 7 : 8;
  const entry = $("#timeInput").value;
  if (validTime(entry) && exitInput.dataset.manual !== "true") {
    exitInput.value = addHoursToTime(entry, hours);
    exitInput.dataset.manual = "false";
  }
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
  $("#recordRows").innerHTML = records.length
    ? records.map((record) => `<tr><td>${String(record.day).padStart(2, "0")}/${String(record.month + 1).padStart(2, "0")}/${state.year}</td><td><span class="status-pill status-${record.status || "trabajado"}">${escapeHtml(statusLabel(record))}</span></td><td>${escapeHtml(routeDisplayName(record))}</td><td>${escapeHtml(record.time ? `${record.time}${record.exit ? ` - ${record.exit}` : ""}` : "Sin horario")}</td><td>${routeExtraHours(record)} h</td></tr>`).join("")
    : "<tr><td class=\"record-empty\" colspan=\"5\">Todavía no hay registros para este año</td></tr>";
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
  const rows = [["Fecha", "Estado", "Destino", "Horario", "Horas extra"], ...records.map((record) => [
    `${String(record.day).padStart(2, "0")}/${String(record.month + 1).padStart(2, "0")}/${state.year}`,
    statusLabel(record),
    routeDisplayName(record),
    record.time ? `${record.time}${record.exit ? ` - ${record.exit}` : ""}` : "Sin horario",
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
  const rows = records.map((record) => `<tr><td>${String(record.day).padStart(2, "0")}/${String(record.month + 1).padStart(2, "0")}/${state.year}</td><td>${escapeHtml(statusLabel(record))}</td><td>${escapeHtml(routeDisplayName(record))}</td><td>${escapeHtml(record.time ? `${record.time}${record.exit ? ` - ${record.exit}` : ""}` : "Sin horario")}</td><td>${routeExtraHours(record)} h</td></tr>`).join("");
  printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Expediente ${state.year}</title><style>body{font-family:Arial,sans-serif;color:#17211f;padding:32px}h1{font-size:24px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #d9e2dc;text-align:left}th{font-size:11px;text-transform:uppercase;color:#60736a}@media print{body{padding:0}}</style></head><body><h1>Expediente de ${state.year}</h1><p>Memoria laboral</p><table><thead><tr><th>Fecha</th><th>Estado</th><th>Destino</th><th>Horario</th><th>Horas extra</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin registros</td></tr>'}</tbody></table></body></html>`);
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
  $("#calendarTitle").textContent = `${months[state.month]} ${state.year}`;
  $("#stampMonth").textContent = months[state.month].toUpperCase();
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

  const route = state.routes[day] || loadRememberedRoute() || { destination: "", time: "", type: "", reminder: 0, status: "trabajado", shift: "completa", exit: "", alarm: true };
  $("#selectedDayBadge").textContent = day;
  $("#editorTitle").textContent = `Día ${day}`;
  $("#routeDate").textContent = dateLabel(day);
  $("#destinationInput").value = route.destination;
  $("#typeInput").value = route.type || "";
  $("#timeInput").value = route.time;
  shiftInput.value = route.shift || "completa";
  exitInput.value = route.exit || "";
  exitInput.dataset.manual = route.exitManual === true ? "true" : "false";
  autoFillExit();
  updateExtraHoursUi(route);
  reminderInput.value = String(route.reminder || 0);
  statusInput.value = route.status || "trabajado";
  alarmInput.checked = route.alarm !== false;
  $("#routeForm").hidden = false;
  $("#emptyState").hidden = true;
  $("#editorHint").hidden = true;
  $("#destinationInput").focus();
  drawAgendaCanvas();
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
  context.font = "700 15px Arial";
  context.fillText("CALENDARIO DE RUTAS", margin + 28, 132);
  context.fillStyle = "#17211f";
  context.font = "700 58px Arial";
  context.fillText(`${months[state.month]} ${state.year}`, margin, 218);
  if (hasGroup) {
    context.fillStyle = "#ffffff";
    context.font = "500 20px Arial";
    context.fillText(`Grupo ${groupName}`, margin, 260);
  }

  const weekdays = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
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

    const cellColor = isWeekend ? calendarColor("--weekend-color", "#e4f2ff") : calendarColor("--weekday-color", "#ffffff");
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
    context.fillStyle = "#17211f";
    context.font = "700 17px Arial";
    context.fillText(String(day), x + 17, y + 29);

    if (route) {
      context.fillStyle = routeColor(route);
      context.font = "700 16px Arial";
      drawWrappedText(context, routeDisplayName(route), x + 17, y + 59, cellWidth - 34, 21);
      context.fillStyle = "#71807a";
      context.font = "500 14px Arial";
      context.fillText(route.time ? `${route.time}${route.exit ? ` - ${route.exit}` : ""}` : statusLabel(route), x + 17, y + 93);
      context.fillStyle = "#f27d65";
      context.beginPath();
      context.arc(x + cellWidth - 21, y + 20, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  const rows = Math.ceil((offset + daysInMonth) / 7);
  context.fillStyle = "#71807a";
  context.font = "500 15px Arial";
  context.fillText("Calendario generado con Memoria laboral", margin, gridTop + rows * (cellHeight + gridGap) + 28);

  return canvas;
}

function downloadPng() {
  const canvas = drawAgendaCanvas();
  const link = document.createElement("a");
  link.download = `limasam-${months[state.month].toLowerCase()}-${state.year}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("PNG descargado correctamente");
}

async function shareAgenda() {
  const canvas = drawAgendaCanvas();
  const fileName = `limasam-${months[state.month].toLowerCase()}-${state.year}.png`;
  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("No se pudo crear la imagen");
    const file = new File([blob], fileName, { type: "image/png" });
    const shareData = {
      title: "Memoria laboral",
      text: `Agenda de ${months[state.month].toLowerCase()} de ${state.year}`,
      files: [file]
    };
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share(shareData);
      showToast("Agenda lista para compartir");
      return;
    }
    const link = document.createElement("a");
    link.download = fileName;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    window.open(`https://wa.me/?text=${encodeURIComponent(`Agenda de ${months[state.month].toLowerCase()} de ${state.year}. Adjunta el PNG descargado.`)}`, "_blank", "noopener");
    showToast("PNG descargado. Adjunta la imagen en WhatsApp");
  } catch (error) {
    if (error.name !== "AbortError") showToast("No se pudo compartir la agenda");
  }
}

monthSelect.addEventListener("change", () => {
  state.month = Number(monthSelect.value);
  state.selected = null;
  renderPreviewDayOptions();
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
$("#timeInput").addEventListener("input", autoFillExit);
shiftInput.addEventListener("change", () => {
  exitInput.dataset.manual = "false";
  autoFillExit();
});
exitInput.addEventListener("input", () => {
  exitInput.dataset.manual = "true";
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
extraHoursMinus.addEventListener("click", () => changeExtraHours(-1));
extraHoursPlus.addEventListener("click", () => changeExtraHours(1));

$("#routeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedDay = state.selected;
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
  state.routes[selectedDay] = {
    destination,
    time,
    type: $("#typeInput").value,
    shift: shiftInput.value,
    exit,
    exitManual: exitInput.dataset.manual === "true",
    extraHours: Number(extraHoursValue.textContent) || 0,
    reminder: Number(reminderInput.value),
    status,
    alarm: alarmInput.checked
  };
  saveRememberedRoute(state.routes[selectedDay]);
  saveRoutes();
  renderCalendar();
  selectDay(selectedDay);
  await scheduleAlarm(selectedDay, state.routes[selectedDay]);
  showToast("Ruta guardada");
});

$("#clearRememberedButton").addEventListener("click", () => {
  if (!window.confirm("¿Quieres borrar el recuerdo de la última ruta?")) return;
  localStorage.removeItem(rememberedRouteKey);
  $("#destinationInput").value = "";
  $("#timeInput").value = "";
  shiftInput.value = "completa";
  exitInput.value = "";
  exitInput.dataset.manual = "false";
  showToast("Recuerdo borrado");
});

$("#clearButton").addEventListener("click", async () => {
  const selectedDay = state.selected;
  if (selectedDay && window.confirm("¿Quieres vaciar todos los datos de este día?")) {
    delete state.routes[selectedDay];
    saveRoutes();
    renderCalendar();
    selectDay(selectedDay);
    await cancelAlarm(selectedDay);
    showToast("Día vaciado");
  }
});

$("#downloadButton").addEventListener("click", downloadPng);
$("#shareButton").addEventListener("click", shareAgenda);
renderHolidayList();
renderCalendar();
selectDay(1);
updateSyncUi();
