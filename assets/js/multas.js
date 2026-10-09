/* Guía de multas: calculadora orientativa UMA → pesos */
(function () {
  var box = document.querySelector("[data-calc]");
  if (!box) return;
  var sel = box.querySelector("[data-uma]");
  var num = box.querySelector("[data-umas]");
  var out = box.querySelector("[data-out]");
  var fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
  var calc = function () {
    var u = Math.max(0, Math.min(150000, parseInt(num.value, 10) || 0));
    out.textContent = fmt.format(Math.round(u * parseFloat(sel.value) * 100) / 100);
  };
  sel.addEventListener("change", calc);
  num.addEventListener("input", calc);
  box.querySelectorAll("[data-preset]").forEach(function (b) {
    b.addEventListener("click", function () { num.value = b.getAttribute("data-preset"); calc(); });
  });
  calc();
})();
