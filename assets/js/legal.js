/* Páginas legales: menú en celular y modo claro/oscuro (sin animaciones) */
(function () {
  var menuBtn = document.querySelector("[data-menu]");
  if (menuBtn) {
    var navEl = menuBtn.closest(".nav");
    var setMenu = function (open) {
      navEl.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    };
    menuBtn.addEventListener("click", function () { setMenu(!navEl.classList.contains("is-open")); });
    navEl.querySelectorAll(".nav-links a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navEl.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
    });
  }
  var btn = document.querySelector("[data-theme-toggle]");
  if (btn) {
    var root = document.documentElement;
    var current = function () { return root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); };
    var label = function () { btn.setAttribute("aria-label", current() === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"); };
    label();
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("cfx-tema", next); } catch (e) {}
      label();
    });
  }
})();
