const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const state = {
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  selected: null,
  routes: {}
};

const $ = (selector) => document.querySelector(selector);
const monthSelect = $("#monthSelect");
const yearInput = $("#yearInput");
const groupInput = $("#groupNumber");
const calendarGrid = $("#calendarGrid");
const alarmInput = $("#alarmInput");
const backgroundToggle = $("#backgroundToggle");
const backgroundFiles = $("#backgroundFiles");
const backgroundOptions = $("#backgroundOptions");
const solidBackground = $("#solidBackground");
const backgroundColorInput = $("#backgroundColorInput");
const backgroundReset = $("#backgroundReset");
const customBackgroundKey = "limasam-custom-backgrounds";
backgroundToggle.checked = localStorage.getItem("limasam-show-background") !== "false";
backgroundColorInput.value = localStorage.getItem("limasam-background-color") || "#f5f7f3";

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
    time: route.time
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
}

function dateLabel(day) {
  return `${day} de ${months[state.month].toLowerCase()} de ${state.year}`;
}

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[character]));
}

function renderCalendar() {
  loadRoutes();
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
    button.setAttribute("aria-label", `${dateLabel(day)}${route ? `, ${route.destination} a las ${route.time}` : ""}`);
    const dayOfWeek = new Date(state.year, state.month, day).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      button.classList.add("is-weekend");
    }
    if (route) {
      button.classList.add("has-route");
    }

    if (today.getDate() === day && today.getMonth() === state.month && today.getFullYear() === state.year) {
      button.classList.add("is-today");
    }
    if (state.selected === day) {
      button.classList.add("is-selected");
    }

    button.innerHTML = `<span class="day-number">${day}</span>`;
    if (route) {
      button.innerHTML += `<span class="route-dot" aria-hidden="true"></span><span class="route-preview">${escapeHtml(route.destination)}</span><span class="route-time">${route.time || "Sin hora"}</span>`;
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
  drawAgendaCanvas();
}

function selectDay(day) {
  state.selected = day;
  calendarGrid.querySelectorAll("button").forEach((button) => button.classList.remove("is-selected"));
  const selectedButton = [...calendarGrid.querySelectorAll("button")]
    .find((button) => button.querySelector(".day-number")?.textContent === String(day));
  selectedButton?.classList.add("is-selected");

  const route = state.routes[day] || loadRememberedRoute() || { destination: "", time: "", alarm: true };
  $("#selectedDayBadge").textContent = day;
  $("#editorTitle").textContent = `Día ${day}`;
  $("#routeDate").textContent = dateLabel(day);
  $("#destinationInput").value = route.destination;
  $("#timeInput").value = route.time;
  alarmInput.checked = route.alarm !== false;
  $("#routeForm").hidden = false;
  $("#emptyState").hidden = true;
  $("#editorHint").hidden = true;
  $("#destinationInput").focus();
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
  if (!nativeAndroid() || !route.alarm || !route.time) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") {
      showToast("Permiso de alarmas no concedido");
      return;
    }
    const [hour, minute] = route.time.split(":").map(Number);
    const at = new Date(state.year, state.month, day, hour, minute);
    if (at <= new Date()) {
      showToast("La hora elegida ya ha pasado");
      return;
    }
    const id = state.year * 10000 + (state.month + 1) * 100 + day;
    await LocalNotifications.cancel({ notifications: [{ id }] });
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: "Agenda de trabajos y actividades · Recordatorio de ruta",
        body: `${route.destination} · entrada a las ${route.time}`,
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
  context.fillText("Agenda de trabajos y actividades", margin + 28, 101);
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

    context.fillStyle = isWeekend ? "rgba(67,151,218,.78)" : "rgba(255,255,255,.84)";
    context.beginPath();
    context.roundRect(x, y, cellWidth, cellHeight, 10);
    context.shadowColor = "rgba(23,33,31,.22)";
    context.shadowBlur = 10;
    context.shadowOffsetY = 5;
    context.fill();
    context.strokeStyle = isWeekend ? "rgba(36,108,174,.82)" : "#e2e9e3";
    context.lineWidth = 2;
    context.stroke();
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.fillStyle = "#17211f";
    context.font = "700 17px Arial";
    context.fillText(String(day), x + 17, y + 29);

    if (route) {
      context.fillStyle = "#207c62";
      context.font = "700 16px Arial";
      drawWrappedText(context, route.destination, x + 17, y + 59, cellWidth - 34, 21);
      context.fillStyle = "#71807a";
      context.font = "500 14px Arial";
      context.fillText(route.time || "Sin hora", x + 17, y + 93);
      context.fillStyle = "#f27d65";
      context.beginPath();
      context.arc(x + cellWidth - 21, y + 20, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  const rows = Math.ceil((offset + daysInMonth) / 7);
  context.fillStyle = "#71807a";
  context.font = "500 15px Arial";
  context.fillText("Calendario generado con Agenda de trabajos y actividades", margin, gridTop + rows * (cellHeight + gridGap) + 28);

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

monthSelect.addEventListener("change", () => {
  state.month = Number(monthSelect.value);
  renderCalendar();
});
yearInput.addEventListener("change", () => {
  const year = Number(yearInput.value);
  if (year >= 2000 && year <= 2100) {
    state.year = year;
    renderCalendar();
  }
});
groupInput.addEventListener("input", renderCalendar);
backgroundToggle.addEventListener("change", () => {
  localStorage.setItem("limasam-show-background", String(backgroundToggle.checked));
  updateBackgroundOptions();
  drawAgendaCanvas();
});
backgroundColorInput.addEventListener("input", () => {
  localStorage.setItem("limasam-background-color", backgroundColorInput.value);
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

$("#routeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedDay = state.selected;
  const destination = $("#destinationInput").value.trim();
  const time = $("#timeInput").value;
  if (!destination) {
    $("#destinationInput").focus();
    showToast("Escribe un destino para guardar la ruta");
    return;
  }
  state.routes[selectedDay] = { destination, time, alarm: alarmInput.checked };
  saveRememberedRoute(state.routes[selectedDay]);
  saveRoutes();
  renderCalendar();
  selectDay(selectedDay);
  await scheduleAlarm(selectedDay, state.routes[selectedDay]);
  showToast("Ruta guardada");
});

$("#clearRememberedButton").addEventListener("click", () => {
  localStorage.removeItem(rememberedRouteKey);
  $("#destinationInput").value = "";
  $("#timeInput").value = "";
  showToast("Recuerdo borrado");
});

$("#clearButton").addEventListener("click", async () => {
  const selectedDay = state.selected;
  if (selectedDay) {
    delete state.routes[selectedDay];
    saveRoutes();
    renderCalendar();
    selectDay(selectedDay);
    await cancelAlarm(selectedDay);
    showToast("Día vaciado");
  }
});

$("#downloadButton").addEventListener("click", downloadPng);
renderCalendar();
