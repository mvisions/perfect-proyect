import { API_BASE } from "./config.mjs";
import "./visitor-admin.mjs";

const consentKey = "noe-visitor-count-consent-v1";
const visitorKey = "noe-visitor-id-v1";
const sentKey = "noe-visitor-count-sent-v1";

function madridDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function recordVisitor() {
  try {
    let visitorId = localStorage.getItem(visitorKey);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(visitorKey, visitorId);
    }
    const sent = `${visitorId}:${madridDay()}`;
    if (localStorage.getItem(sentKey) === sent) return;
    const response = await fetch(`${API_BASE}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
    localStorage.setItem(sentKey, sent);
  } catch (error) {
    console.error("No se pudo registrar el visitante único:", error);
  }
}

function showConsent() {
  const banner = document.createElement("aside");
  banner.setAttribute("aria-label", "Preferencias de recuento de visitas");
  Object.assign(banner.style, {
    position: "fixed", inset: "auto 1rem 1rem", zIndex: "1000", maxWidth: "42rem",
    marginInline: "auto", padding: "1rem", borderRadius: "0.75rem",
    background: "#fff", color: "#17231f", boxShadow: "0 4px 24px #0003",
    font: "16px/1.5 system-ui, sans-serif",
  });
  const message = document.createElement("p");
  message.textContent = "¿Aceptas guardar un identificador aleatorio en este navegador para contar visitantes únicos cada día? No guardamos tu IP.";
  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", gap: "0.75rem", flexWrap: "wrap" });
  for (const [label, consent] of [["Aceptar", "yes"], ["No aceptar", "no"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async () => {
      try {
        localStorage.setItem(consentKey, consent);
        banner.remove();
        if (consent === "yes") await recordVisitor();
      } catch (error) {
        console.error("No se pudo guardar la preferencia de recuento:", error);
      }
    });
    actions.append(button);
  }
  banner.append(message, actions);
  document.body.append(banner);
}

try {
  const consent = localStorage.getItem(consentKey);
  if (consent === "yes") void recordVisitor();
  else if (consent !== "no") showConsent();
} catch (error) {
  console.error("No se pudo leer la preferencia de recuento:", error);
}
