import { initializeTheme } from "./theme.mjs";

initializeTheme(message => { document.querySelector("#notice").textContent = message; });
