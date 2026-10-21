const section = document.querySelector(".teacher-notes");
const ticker = section.querySelector(".teacher-notes-ticker");
const track = section.querySelector(".teacher-notes-track");
const toggle = section.querySelector("#teacher-notes-toggle");
const details = section.querySelector("details");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const group = document.createElement("div");
group.className = "teacher-notes-group";

for (const note of section.querySelectorAll(".teacher-notes-list li")) {
  const item = document.createElement("span");
  const heading = note.querySelector("h3");
  const title = document.createElement("strong");
  title.textContent = `${heading.textContent}: `;
  item.append(title, [...note.querySelectorAll("p")].map(p => p.textContent).join(" "));
  group.append(item);
}
track.append(group, group.cloneNode(true));

function setMotionPreference() {
  ticker.hidden = reducedMotion.matches;
  toggle.hidden = reducedMotion.matches;
  if (reducedMotion.matches) details.open = true;
}

setMotionPreference();
reducedMotion.addEventListener("change", setMotionPreference);

const observer = new ResizeObserver(() => {
  if (group.offsetWidth) {
    track.style.setProperty("--notes-duration", `${group.offsetWidth / 40}s`);
  }
});
observer.observe(group);

toggle.addEventListener("click", () => {
  const paused = section.classList.toggle("is-paused");
  toggle.textContent = paused ? "Reanudar movimiento" : "Pausar movimiento";
});
