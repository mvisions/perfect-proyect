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
}

function selectDay(day) {
  state.selected = day;
  calendarGrid.querySelectorAll("button").forEach((button) => button.classList.remove("is-selected"));
  const selectedButton = [...calendarGrid.querySelectorAll("button")]
    .find((button) => button.querySelector(".day-number")?.textContent === String(day));
  selectedButton?.classList.add("is-selected");

  const route = state.routes[day] || { destination: "", time: "", alarm: true };
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
        title: "limasam · Recordatorio de ruta",
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

function downloadPng() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const width = 1600;
  const height = 1120;
  const margin = 72;
  const gridTop = 310;
  const cellWidth = (width - margin * 2) / 7;
  const cellHeight = 108;
  canvas.width = width;
  canvas.height = height;

  context.fillStyle = "#f5f7f3";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#17211f";
  context.fillRect(0, 0, width, 17);
  context.fillStyle = "#f27d65";
  context.fillRect(margin, 64, 9, 112);
  context.fillStyle = "#17211f";
  context.font = "700 44px Arial";
  context.fillText("limasam", margin + 28, 101);
  context.fillStyle = "#207c62";
  context.font = "700 15px Arial";
  context.fillText("CALENDARIO DE RUTAS", margin + 28, 132);
  context.fillStyle = "#17211f";
  context.font = "700 58px Arial";
  context.fillText(`${months[state.month]} ${state.year}`, margin, 218);
  context.fillStyle = "#71807a";
  context.font = "500 20px Arial";
  context.fillText(groupInput.value.trim() ? `Grupo ${groupInput.value.trim()}` : "Grupo sin asignar", margin, 260);
  context.fillStyle = "#f27d65";
  context.fillRect(width - margin - 9, 64, 9, 112);

  const weekdays = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
  context.fillStyle = "#9aa8a2";
  context.font = "700 15px Arial";
  weekdays.forEach((day, index) => context.fillText(day, margin + index * cellWidth + 12, gridTop - 24));

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const position = offset + day - 1;
    const column = position % 7;
    const row = Math.floor(position / 7);
    const x = margin + column * cellWidth;
    const y = gridTop + row * cellHeight;
    const route = state.routes[day];

    context.strokeStyle = "#e2e9e3";
    context.lineWidth = 2;
    context.strokeRect(x + 4, y, cellWidth - 8, cellHeight - 8);
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
  context.fillText("Calendario generado con limasam", margin, gridTop + rows * cellHeight + 28);

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
  saveRoutes();
  renderCalendar();
  selectDay(selectedDay);
  await scheduleAlarm(selectedDay, state.routes[selectedDay]);
  showToast("Ruta guardada");
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
