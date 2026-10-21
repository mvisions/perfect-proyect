export function initializeTheme(announce) {
  const toggle = document.querySelector("#theme-toggle");
  function setTheme(dark) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    toggle.textContent = dark ? "Modo claro" : "Modo oscuro";
    toggle.setAttribute("aria-pressed", String(dark));
    document.querySelector('meta[name="theme-color"]').content =
      getComputedStyle(document.documentElement).getPropertyValue("--theme-color").trim();
  }
  try { setTheme(localStorage.getItem("noe-theme") === "dark"); }
  catch (error) {
    console.error("No se pudo recuperar el tema.", error);
    announce("No se pudo recuperar el tema guardado.", true);
  }
  toggle.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    setTheme(dark);
    try { localStorage.setItem("noe-theme", dark ? "dark" : "light"); }
    catch (error) {
      console.error("No se pudo guardar el tema.", error);
      announce("El tema ha cambiado, pero no se puede guardar la preferencia en este navegador.", true);
    }
  });
}
