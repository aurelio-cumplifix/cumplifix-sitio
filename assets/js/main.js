/* CUMPLIFIX, S.C. — interacción y movimiento del sitio */
const CONFIG = {
  whatsapp: "525571462367",
  correo: "info@cumplifix.com",
  formKey: "386f27b8-8a7b-47e9-a0c4-2b96e7cc329d", // Web3Forms, misma llave que agenda.cumplifix.com
  waTexto: "Hola, vengo de cumplifix.com y quiero platicar sobre el cumplimiento de mi institución.",
};

/* ---------- WhatsApp con mensaje prellenado y origen ---------- */
document.querySelectorAll("[data-wa]").forEach((a) => {
  const texto = `${CONFIG.waTexto} (origen: ${a.dataset.wa})`;
  a.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`;
  a.target = "_blank";
  a.rel = "noopener";
});

/* ---------- UTM: se guardan para incluirlas en el formulario ---------- */
const limpia = (v) => String(v || "").replace(/[^\w.-]/g, "").slice(0, 64);
const UTM = (() => {
  const keys = ["utm_source", "utm_medium", "utm_campaign"];
  const q = new URLSearchParams(location.search);
  const out = {};
  try {
    keys.forEach((k) => { const v = limpia(q.get(k)); if (v) sessionStorage.setItem(k, v); out[k] = limpia(sessionStorage.getItem(k)); });
  } catch (e) { keys.forEach((k) => { out[k] = limpia(q.get(k)); }); }
  return out;
})();

/* ---------- Servicio y origen preseleccionados al ir a contacto ---------- */
let origenActual = "contacto";
document.querySelectorAll('a[href="#contacto"]').forEach((a) => {
  a.addEventListener("click", () => {
    origenActual = a.dataset.origen || "contacto";
    const tema = a.dataset.tema;
    const field = document.getElementById("f-tema");
    if (tema && field) {
      field.value = tema;
      const msg = document.getElementById("f-msg");
      if (msg && !msg.value.trim()) msg.value = `Me interesa: ${tema}. `;
    }
  });
});

/* ---------- Formulario ---------- */
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.closest || !el.closest("[data-form]")) return;
  if (el.type === "checkbox") { el.setAttribute("aria-invalid", "false"); el.closest(".consent")?.classList.remove("is-invalid"); }
  else if (el.getAttribute("aria-invalid") === "true") el.setAttribute("aria-invalid", "false");
});
const form = document.querySelector("[data-form]");
if (form) {
  const status = form.querySelector(".form-status");
  const btn = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "form-status"; status.textContent = "";
    let firstBad = null;
    form.querySelectorAll("[required]").forEach((el) => {
      const bad = el.type === "checkbox" ? !el.checked : !el.value.trim() || (el.type === "email" && !/^\S+@\S+\.\S+$/.test(el.value));
      if (el.type === "checkbox") { el.closest(".consent").classList.toggle("is-invalid", bad); el.setAttribute("aria-invalid", bad ? "true" : "false"); }
      else el.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) {
      const msg = firstBad.type === "checkbox"
        ? "Para enviar, acepta el Aviso de Privacidad."
        : firstBad.type === "email" && firstBad.value.trim()
          ? "Escribe un correo válido, por ejemplo nombre@institucion.mx."
          : `Falta completar: ${firstBad.closest(".field").querySelector("label").firstChild.textContent.trim()}.`;
      setTimeout(() => { status.classList.add("err"); status.textContent = msg; }, 50);
      firstBad.focus();
      return;
    }
    if (form.botcheck.checked) return;
    const d = Object.fromEntries(new FormData(form));
    const payload = {
      access_key: CONFIG.formKey,
      subject: `[cumplifix.com][${origenActual}] ${d.tema} · ${d.institucion}`,
      from_name: "CUMPLIFIX, S.C. · cumplifix.com",
      replyto: d.correo,
      nombre: d.nombre, institucion: d.institucion, correo: d.correo, telefono: d.telefono || "—",
      tema: d.tema, mensaje: d.mensaje || "—",
      origen: origenActual, ...UTM,
      aviso_privacidad: "aceptado",
      finalidad_secundaria: d.no_publicidad ? "NO acepta publicidad (negativa)" : "Sin negativa",
      sello_temporal: new Date().toISOString(),
      botcheck: false,
    };
    btn.disabled = true; status.textContent = "Enviando…";
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch("https://api.web3forms.com/submit", {
        signal: ctl.signal,
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.message);
      clearTimeout(timer);
      form.reset();
      const temaIn = document.getElementById("f-tema");
      if (temaIn) temaIn.value = "Agenda 20 minutos";
      origenActual = "contacto";
      status.classList.add("ok");
      status.textContent = "Gracias. Recibimos tu mensaje y te contactaremos para agendar.";
    } catch (err) {
      status.classList.add("err");
      const body = encodeURIComponent(`Nombre: ${d.nombre}\nInstitución: ${d.institucion}\nTema: ${d.tema}\nTeléfono: ${d.telefono || "—"}\n\n${d.mensaje || ""}`);
      status.innerHTML = `No se pudo enviar. Escríbenos a <a href="mailto:${CONFIG.correo}?subject=${encodeURIComponent("Contacto desde cumplifix.com")}&body=${body}">${CONFIG.correo}</a>.`;
    } finally { btn.disabled = false; }
  });
}

/* ---------- Barra móvil: aparece tras el hero, se oculta en contacto ---------- */
const mbar = document.querySelector("[data-mbar]");
const contactSec = document.getElementById("contacto");
function mbarState() {
  if (!mbar) return;
  const past = window.scrollY > window.innerHeight * 0.6;
  const r = contactSec.getBoundingClientRect();
  const inContact = r.top < window.innerHeight && r.bottom > 0;
  const on = past && !inContact;
  if (mbar._on === on) return;
  mbar._on = on;
  mbar.classList.toggle("is-on", on);
  mbar.setAttribute("aria-hidden", on ? "false" : "true");
  mbar.querySelectorAll("a").forEach((a) => (a.tabIndex = on ? 0 : -1));
}
window.addEventListener("scroll", mbarState, { passive: true });

/* ---------- Menú en celular ---------- */
const menuBtn = document.querySelector("[data-menu]");
if (menuBtn) {
  const navEl = menuBtn.closest(".nav");
  const setMenu = (open) => {
    navEl.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  };
  menuBtn.addEventListener("click", () => setMenu(!navEl.classList.contains("is-open")));
  navEl.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navEl.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
  });
}

/* ---------- Franja de sectores: pausa ---------- */
const sectors = document.querySelector(".sectors");
const mToggle = document.querySelector("[data-marquee-toggle]");
if (sectors && mToggle) {
  mToggle.addEventListener("click", () => {
    const paused = sectors.classList.toggle("is-paused");
    mToggle.setAttribute("aria-pressed", paused ? "true" : "false");
    mToggle.textContent = paused ? "Reanudar" : "Pausar";
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => sectors.classList.toggle("is-off", !en.isIntersecting)).observe(sectors);
  }
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const nav = document.querySelector("[data-nav]");

let navTick = false;
function navState(darkZones) {
  if (navTick) return;
  navTick = true;
  requestAnimationFrame(() => { navTick = false; navApply(darkZones); });
}
function navApply(darkZones) {
  const y = window.scrollY;
  nav.classList.toggle("is-scrolled", y > 8);
  const probe = nav.offsetHeight / 2;
  const dark = darkZones.some((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= probe && r.bottom >= probe;
  });
  nav.classList.toggle("is-dark", dark);
}

function init() {
  const darkZones = [...document.querySelectorAll(".stage, .after, .contact, .scard.t-ink, .scard.t-royal, .pui-card, .jueves")];
  const update = () => navState(darkZones);
  window.addEventListener("scroll", update, { passive: true });
  update();
  mbarState();

  if (reduceMotion || !window.gsap || !window.ScrollTrigger) {
    document.documentElement.classList.add("js-ready");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* Desplazamiento suave, sincronizado con ScrollTrigger */
  if (window.Lenis) {
    const lenis = new Lenis({ lerp: 0.11 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      {
        const id = a.getAttribute("href") || "";
        if (!id.startsWith("#") || id.length < 2) return;
        const target = document.getElementById(id.slice(1));
        if (!target) return;
        e.preventDefault();
        const focusTarget = id === "#contacto" ? document.getElementById("f-nombre") : target;
        lenis.scrollTo(target, { offset: -8, duration: 1.4, onComplete: () => {
          if (!focusTarget.hasAttribute("tabindex") && !/^(INPUT|A|BUTTON|SELECT|TEXTAREA)$/.test(focusTarget.tagName)) focusTarget.setAttribute("tabindex", "-1");
          focusTarget.focus({ preventScroll: true });
        } });
        history.pushState(null, "", id);
      }
    });
  }

  /* ---------- Entrada del hero ---------- */
  const ease = "expo.out";
  document.documentElement.classList.add("js-ready");

  /* ---------- Escenario: el panel crece a pantalla completa ---------- */
  const panel = document.querySelector("[data-panel]");
  const seal = document.querySelector("[data-seal]");
  const coin = document.querySelector("[data-coin]");
  const wrap = document.querySelector(".statement-wrap");
  const statement = document.querySelector("[data-statement]");

  // Divide la declaración en palabras, conservando el <em>
  const words = [];
  [...statement.childNodes].forEach((node) => {
    const isEm = node.nodeType === 1;
    const text = node.textContent;
    const frag = document.createDocumentFragment();
    const holder = isEm ? document.createElement("em") : frag;
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { holder.appendChild(document.createTextNode(part)); return; }
      const s = document.createElement("span");
      s.className = "w";
      s.textContent = part;
      holder.appendChild(s);
      words.push(s);
    });
    if (isEm) frag.appendChild(holder);
    statement.replaceChild(frag, node);
  });

  gsap.set(seal, { xPercent: -50, yPercent: -50, x: 0, y: 0, left: "50%", top: "50%" });
  gsap.set(words, { opacity: 0.16 });

  const mm = gsap.matchMedia();
  mm.add({ small: "(max-width: 700px)", large: "(min-width: 701px)" }, (ctx) => {
    const { small } = ctx.conditions;
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: ".stage", start: "top top", end: "bottom bottom", scrub: 0.6 },
    });
    tl.fromTo(panel,
        { clipPath: "inset(6vh 5vw 0vh 5vw round 28px)" },
        { clipPath: "inset(0vh 0vw 0vh 0vw round 0px)", duration: 0.3 })
      .fromTo(seal, { scale: 0.86 }, { scale: 1.04, duration: 0.3 }, 0)
      .fromTo(coin, { rotationY: -25, rotationX: 14 }, { rotationY: 360, rotationX: 0, duration: 0.3, ease: "power1.inOut" }, 0)
      .to(seal, { y: small ? "-33vh" : "-34vh", scale: small ? 0.26 : 0.2, duration: 0.18, ease: "power2.inOut" }, 0.32)
      .to(coin, { rotationY: 720, duration: 0.18, ease: "power2.inOut" }, 0.32)
      .fromTo(wrap, { opacity: 0, y: "14vh" }, { opacity: 1, y: small ? "7vh" : "6vh", duration: 0.16, ease: "power2.out" }, 0.38)
      .to(words, { opacity: 1, stagger: 0.012, duration: 0.05 }, 0.5)
      .to({}, { duration: 0.08 });
    return () => tl.kill();
  });

  /* ---------- Revelados al hacer scroll ---------- */
  // Titulares: la entrada con desenfoque. Lo demás: un fundido discreto.
  const rising = gsap.utils.toArray("main [data-rise]").filter((el) => !el.closest(".hero"));
  const isHeading = (el) => /^H[1-3]$/.test(el.tagName);
  ScrollTrigger.batch(rising.filter(isHeading), {
    start: "top 88%", once: true,
    onEnter: (els) => gsap.from(els, { y: 40, opacity: 0, filter: "blur(10px)", duration: 1.2, ease, stagger: 0.08 }),
  });
  ScrollTrigger.batch(rising.filter((el) => !isHeading(el)), {
    start: "top 92%", once: true,
    onEnter: (els) => gsap.from(els, { y: 14, opacity: 0, duration: 0.8, ease: "power2.out", stagger: 0.05 }),
  });


  /* Franja cinética: se desliza con el scroll */
  const krow = document.querySelector("[data-kinetic]");
  if (krow) {
    gsap.fromTo(krow, { x: () => window.innerWidth * 0.1 }, {
      x: () => -(krow.scrollWidth - window.innerWidth * 0.9), ease: "none",
      scrollTrigger: { trigger: ".after", start: "top bottom", end: "bottom top", scrub: 0.4, invalidateOnRefresh: true },
    });
  }

  /* Tarjetas apiladas: la de atrás se reduce cuando llega la siguiente */
  mm.add("(min-width: 861px)", () => {
    const cards = gsap.utils.toArray("[data-scard]");
    cards.slice(0, -1).forEach((card, i) => {
      gsap.to(card, {
        scale: 0.9 + i * 0.012, ease: "none",
        scrollTrigger: { trigger: cards[i + 1], start: "top bottom", end: "top 20%", scrub: true },
      });
    });
  });

  /* Botones magnéticos (solo con mouse) */
  if (window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".btn").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.18, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4, ease: "power3.out" });
      });
      b.addEventListener("pointerleave", () => gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" }));
    });
  }

  /* Cifras que cuentan */
  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = +el.dataset.count;
    el.style.minWidth = el.textContent.length + "ch";
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: () => gsap.to(o, { v: end, duration: 1.8, ease: "expo.out", onUpdate: () => (el.textContent = Math.round(o.v)) }),
    });
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

/* ---------- Fondo vivo del hero (WebGL, sin librerías) ---------- */
(function heroGradient() {
  const canvas = document.querySelector("[data-gradient]");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) return; // queda el degradado CSS
  const vs = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const fs = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec2 m;uniform float k;
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float sn(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);
vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
vec3 m0=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m0=m0*m0;m0=m0*m0;
vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;
m0*=1.79284291400159-.85373472095314*(a0*a0+h*h);
vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m0,g);}
void main(){
  vec2 uv=gl_FragCoord.xy/r; vec2 p=uv; p.x*=r.x/r.y;
  float tt=t*.045;
  float n1=sn(p*.85+vec2(tt,-tt*.7)+m*.25);
  float n2=sn(p*1.3+vec2(-tt*.8,tt*.5)+5.2);
  float n3=sn(p*.6+vec2(tt*.4,tt*.9)+11.7-m*.15);
  vec2 c=(uv-vec2(.5,.5))*vec2(1.15,1.7);
  float edge=smoothstep(.22,.85,length(c));
  vec3 col=mix(vec3(.984,.984,.992),vec3(.024,.039,.094),k);
  col=mix(col,mix(vec3(.80,.92,1.),vec3(.05,.14,.33),k),smoothstep(-.35,.6,n1)*.8);
  col=mix(col,mix(vec3(.80,.84,.98),vec3(.07,.10,.30),k),smoothstep(-.2,.7,n2)*.65);
  col=mix(col,vec3(.22,.71,1.),smoothstep(.15,.9,n3)*mix(.8,.55,k)*edge);
  col=mix(col,vec3(.11,.27,.86),smoothstep(.3,1.,n1*.6+n3*.6)*.7*edge);
  gl_FragColor=vec4(col,1.);
}`;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, "r"), uT = gl.getUniformLocation(prog, "t"), uM = gl.getUniformLocation(prog, "m"), uK = gl.getUniformLocation(prog, "k");
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };

  const scale = 0.5; // se dibuja a media resolución: es un degradado, no lo nota el ojo
  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.tx = e.clientX / window.innerWidth - 0.5;
    mouse.ty = 0.5 - e.clientY / window.innerHeight;
  }, { passive: true });

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = true, raf = 0;
  const t0 = performance.now();
  function frame(now) {
    resize();
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, still ? 12 : (now - t0) / 1000 + 12);
    gl.uniform2f(uM, mouse.x, mouse.y);
    gl.uniform1f(uK, isDark() ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!still && visible) raf = requestAnimationFrame(frame);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !still) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    }).observe(canvas);
  }
  window.addEventListener("resize", () => { if (still) frame(performance.now()); });
  document.addEventListener("cfx:tema", () => { if (still) frame(performance.now()); });
  frame(performance.now());
  canvas.classList.add("is-on");
})();

/* ---------- Modo claro / oscuro ---------- */
(function themeToggle() {
  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;
  const root = document.documentElement;
  const current = () => root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const label = () => btn.setAttribute("aria-label", current() === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  label();
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("cfx-tema", next); } catch (e) {}
    label();
    document.dispatchEvent(new Event("cfx:tema"));
  });
})();

/* ---------- Datos editables: Academia, Noticias y Jueves CUMPLIFIX ---------- */
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pend = (t) => esc(t).replace(/\[PENDIENTE[^\]]*\]/g, (m) => `<span class="is-pend">${m}</span>`);
const safeUrl = (u, img) => { u = String(u || "").trim(); return /^https:\/\//i.test(u) || (img && /^assets\//.test(u)) ? u : ""; };
const waLink = (msg) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
const fmtFecha = (iso, opts) => new Date(iso.length === 10 ? iso + "T12:00:00-06:00" : iso)
  .toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", ...opts });
const getJSON = (url) => fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

/* Vigencia: hora del centro de México (UTC-6, sin horario de verano desde 2022) */
const mx = (fecha, hora = "00:00") => new Date(`${fecha}T${String(hora).padStart(5, "0")}:00-06:00`);
const parseHasta = (v) => { const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?$/.exec(String(v || "").trim()); if (!m) return null; const d = mx(m[1], m[2] || "23:59"); return isNaN(d) ? null : d; };
const primeraHora = (txt) => { const m = /(\d{1,2}):(\d{2})/.exec(String(txt || "")); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null; };
const vigente = (hasta) => Date.now() < hasta.getTime();
const proximoCheck = []; // revisa cada minuto lo que vence mientras la página está abierta
setInterval(() => proximoCheck.forEach((fn) => fn()), 60000);

(function academia() {
  const list = document.querySelector("[data-courses]");
  if (!list) return;
  const vacio = `<li class="course course-empty">Pronto publicaremos nuevas fechas. <a href="${waLink("Hola, quiero saber de los próximos cursos de la Academia CUMPLIFIX, S.C.")}" target="_blank" rel="noopener">Avísame por WhatsApp</a>.</li>`;
  getJSON("data/academia.json").then(({ cursos = [] }) => {
    const items = cursos.filter((c) => c.publicar !== false && !c.pendiente && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)).map((c) => {
      const h = primeraHora(c.horario);
      return { ...c, hasta: parseHasta(c.visibleHasta) || (h ? mx(c.fecha, h) : mx(c.fecha, "23:59")) };
    }).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pintar = () => {
      const prox = items.filter((c) => vigente(c.hasta));
      if (!prox.length) { list.innerHTML = vacio; return; }
      list.innerHTML = prox.map((c) => {
        const href = safeUrl(c.inscripcion) || waLink(`Hola, quiero inscribirme al curso: ${c.titulo} (${c.fecha}).`);
        return `<li class="course">
          <p class="course-date"><b>${fmtFecha(c.fecha, { day: "numeric" })}</b><span>${fmtFecha(c.fecha, { month: "short" }).replace(".", "")}</span></p>
          <div><h3>${pend(c.titulo)}</h3><p class="course-meta">${pend(c.horario)} · ${pend(c.modalidad)}</p></div>
          <p class="course-price">${pend(c.precio)}</p>
          <a class="btn btn-sm" href="${esc(href)}" target="_blank" rel="noopener">Inscríbete</a>
        </li>`;
      }).join("");
    };
    pintar();
    let n = items.filter((c) => vigente(c.hasta)).length;
    proximoCheck.push(() => { const m = items.filter((c) => vigente(c.hasta)).length; if (m !== n) { n = m; pintar(); } });
  }).catch(() => { list.innerHTML = `<li class="course course-empty">Consulta los próximos cursos por <a href="${waLink("Hola, quiero saber de los próximos cursos de la Academia CUMPLIFIX, S.C.")}" target="_blank" rel="noopener">WhatsApp</a>.</li>`; });
})();

(function noticias() {
  const list = document.querySelector("[data-news]");
  if (!list) return;
  getJSON("data/noticias.json").then(({ notas = [] }) => {
    const top = notas.filter((n) => n.publicar !== false && !n.pendiente && /^\d{4}-\d{2}-\d{2}$/.test(n.fecha || "") && (!parseHasta(n.visibleHasta) || vigente(parseHasta(n.visibleHasta))))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);
    if (!top.length) { list.closest("section").hidden = true; return; }
    list.innerHTML = top.map((n) => `<li class="news-item">
      <p class="news-meta">${fmtFecha(n.fecha, { day: "numeric", month: "short", year: "numeric" })} · ${pend(n.fuente)}</p>
      <h3>${pend(n.titulo)}</h3>
      <p>${pend(n.resumen)}</p>
      ${safeUrl(n.liga) ? `<a href="${esc(safeUrl(n.liga))}" target="_blank" rel="noopener">Leer más</a>` : ""}
    </li>`).join("");
  }).catch(() => { list.closest("section").hidden = true; });
})();

(function eventos() {
  const card = document.querySelector("[data-jueves]");
  const more = document.querySelector("[data-events-more]");
  const joinBtn = document.querySelector("[data-jueves-link]");
  const pop = document.querySelector("[data-jpop]");
  const cuandoDe = (d) => {
    const t = d.toLocaleString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
    return t.charAt(0).toUpperCase() + t.slice(1) + " (centro de México)";
  };
  getJSON("data/eventos.json").then(({ eventos: lista = [] }) => {
    const items = lista.filter((e) => e.publicar !== false && /^\d{4}-\d{2}-\d{2}$/.test(e.fecha)).map((e) => {
      const hora = primeraHora(e.hora) || "09:00";
      const inicio = mx(e.fecha, hora);
      return { ...e, hora, liga: safeUrl(e.liga), imagen: safeUrl(e.imagen, true), inicio, hasta: parseHasta(e.visibleHasta) || new Date(inicio.getTime() + 30 * 60000), id: `${e.fecha} ${e.hora} ${e.tema}` };
    }).filter((e) => !isNaN(e.inicio)).sort((a, b) => a.inicio - b.inicio);

    const pintar = () => {
      const prox = items.filter((e) => vigente(e.hasta));
      const p = prox[0];
      if (joinBtn) { joinBtn.hidden = !(p && p.liga); if (p && p.liga) joinBtn.href = p.liga; }
      if (card) {
        const html = p
          ? `${p.imagen ? `<div class="jn-img"><img src="${esc(p.imagen)}" alt="" loading="lazy"></div>` : ""}
            <p class="jn-when">${esc(p.organizador || "Próximo evento")} · ${esc(cuandoDe(p.inicio))}</p>
            <h3 class="jn-topic">${esc(p.tema)}</h3>
            ${p.expositor ? `<p class="jn-by">${esc(p.expositor)}</p>` : ""}
            ${p.evento ? `<p class="jn-ev">${esc(p.evento)}</p>` : ""}`
          : `<p class="jn-when">Próximo evento</p><h3 class="jn-topic">Pronto anunciaremos la siguiente sesión.</h3>
            <p class="jn-by"><a href="${waLink("Hola, quiero que me avisen del próximo evento de CUMPLIFIX, S.C.")}" target="_blank" rel="noopener">Avísame por WhatsApp</a></p>`;
        if (card.dataset.html !== html) { card.innerHTML = html; card.dataset.html = html; }
      }
      if (more) {
        const mh = prox.slice(1, 4).map((e) => `<li>
          <span class="em-when">${esc(((t) => t.charAt(0).toUpperCase() + t.slice(1))(fmtFecha(e.fecha, { weekday: "long", day: "numeric", month: "long" })))} · ${esc(e.hora || "")} h · ${esc(e.organizador || "")}</span>
          <span class="em-topic">${e.liga ? `<a href="${esc(e.liga)}" target="_blank" rel="noopener">${esc(e.tema)}</a>` : esc(e.tema)}</span>
        </li>`).join("");
        if (more.dataset.html !== mh) { more.innerHTML = mh; more.dataset.html = mh; }
      }
      // Aviso emergente: el evento más cercano, desde el día anterior a las 00:00 hasta su vigencia
      if (!pop) return;
      const ahora = Date.now();
      const enVentana = prox.find((e) => {
        const ymd = new Date(e.inicio.getTime() - 30 * 3600000).toISOString().slice(0, 10); // el día anterior en CDMX (UTC-6)
        return e.liga && ahora >= mx(ymd).getTime();
      });
      let cerrado = false;
      try { cerrado = enVentana && sessionStorage.getItem("cfx-jpop") === enVentana.id; } catch (err) {}
      if (!enVentana || cerrado) { pop.hidden = true; return; }
      if (pop.dataset.id === enVentana.id) return;
      pop.dataset.id = enVentana.id;
      pop.querySelector("[data-jpop-when]").textContent = cuandoDe(enVentana.inicio);
      pop.querySelector("[data-jpop-title]").textContent = enVentana.organizador === "ANIFE" ? "Jueves CUMPLIFIX, S.C. con ANIFE" : (enVentana.organizador ? `Evento con ${enVentana.organizador}` : "Próximo evento");
      pop.querySelector("[data-jpop-topic]").textContent = enVentana.tema;
      pop.querySelector("[data-jpop-by]").textContent = enVentana.expositor || "";
      pop.querySelector("[data-jpop-link]").href = enVentana.liga;
      const im = pop.querySelector("[data-jpop-img]");
      if (enVentana.imagen) { im.innerHTML = `<img src="${esc(enVentana.imagen)}" alt="">`; im.hidden = false; } else { im.hidden = true; }
      setTimeout(() => { pop.hidden = false; }, 2500);
    };
    pintar();
    proximoCheck.push(pintar);

    if (pop) {
      pop.querySelector("[data-jpop-close]").addEventListener("click", () => {
        pop.hidden = true;
        try { sessionStorage.setItem("cfx-jpop", pop.dataset.id || ""); } catch (e) {}
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) pop.querySelector("[data-jpop-close]").click(); });
    }
  }).catch(() => {});
})();
