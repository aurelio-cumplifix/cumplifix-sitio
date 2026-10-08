/* CUMPLIFIX, S.C. — arranque: tema guardado y red de seguridad de las animaciones */
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try { var t = localStorage.getItem('cfx-tema'); if (t === 'light' || t === 'dark') d.dataset.theme = t; } catch (e) {}
  setTimeout(function () { d.classList.add('js-ready'); }, 2500);
})();
