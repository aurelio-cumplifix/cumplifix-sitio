"""Efemérides del Cumplimiento: páginas públicas generadas desde el portal.

Lee https://app.cumplifix.com/publico/efemerides.json (solo ediciones que el equipo marcó como
publicadas) y escribe:
  efemerides/index.html                 portada con la edición más reciente y el archivo
  efemerides/AAAA-MM-DD/index.html      una página por edición
  assets/img/efemerides/AAAA-MM-DD.jpg  imagen del día (JPEG ligero, también es la vista previa al compartir)
  sitemap.xml                           bloque entre <!-- efemerides --> y <!-- /efemerides -->

Si el portal no responde, no toca nada. Uso: python .github/scripts/sync_efemerides.py
"""
import html
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ORIGEN = os.environ.get("EFEMERIDES_ORIGEN", "https://app.cumplifix.com")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITIO = "https://cumplifix.com"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
FECHA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SECCIONES = [("radar", "Radar del cumplimiento", "Sistema financiero y regulación"),
             ("finanzas", "Finanzas personales", "Educación financiera"),
             ("dof", "Diario Oficial", "Publicaciones del día"),
             ("opinion", "Opinión y perspectivas", "")]
INDICADORES = [("dolar", "Dólar", "$"), ("udis", "UDIS", ""), ("tiie28", "TIIE 28 días", ""),
               ("tiie91", "TIIE 91 días", ""), ("tiie182", "TIIE 182 días", ""), ("fondeo", "TIIE de fondeo", "")]
FORMULARIO = "https://docs.google.com/forms/d/e/1FAIpQLScCgcjU_SuPwckUzqtYeDw71TXQvBY4b-7y8-2gVvBJ-ZXTwQ/viewform"
VERSION_CSS = "20261016a"

e = lambda t: html.escape(str(t or ""), quote=True)  # noqa: E731


def liga(u):
    u = str(u or "").strip()
    p = urllib.parse.urlsplit(u)
    return u if p.scheme in ("http", "https") and p.netloc else ""


def bajar(url, limite=6_000_000):
    req = urllib.request.Request(url, headers={"User-Agent": "cumplifix-sitio/efemerides"})
    with urllib.request.urlopen(req, timeout=60) as r:
        datos = r.read(limite + 1)
    if len(datos) > limite:
        raise RuntimeError("respuesta demasiado grande")
    return datos


def fecha_larga(f, con_dia=False):
    import datetime
    d = datetime.date.fromisoformat(f)
    texto = f"{d.day} de {MESES[d.month - 1]} de {d.year}"
    return (DIAS[d.weekday()].capitalize() + " " + texto) if con_dia else texto


def escribir(ruta, contenido):
    ruta = os.path.join(RAIZ, ruta)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as f:
            if f.read() == contenido:
                return False
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(contenido)
    return True


# ---------------------------------------------------------------- plantilla común

def pagina(titulo, descripcion, canonica, og_imagen, cuerpo, ld_json):
    return f"""<!doctype html>
<html lang="es-MX">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(titulo)}</title>
  <meta name="description" content="{e(descripcion)}">
  <meta property="og:site_name" content="CUMPLIFIX, S.C.">
  <meta property="og:title" content="{e(titulo)}">
  <meta property="og:description" content="{e(descripcion)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{e(canonica)}">
  <meta property="og:image" content="{e(og_imagen)}">
  <meta property="og:locale" content="es_MX">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#FBFBFD" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#060A18" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="{e(canonica)}">
  <link rel="icon" type="image/png" href="/assets/img/logo-128.png">
  <link rel="apple-touch-icon" href="/assets/img/logo-128.png">
  <script type="application/ld+json">{json.dumps(ld_json, ensure_ascii=False).replace("</", "<\\/")}</script>
  <script src="/assets/js/boot.js?v=20261008b"></script>
  <script src="/assets/js/legal.js?v=20261008c" defer></script>
  <link rel="preload" href="/assets/fonts/raleway-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/css/main.css?v=20261016c">
  <link rel="stylesheet" href="/assets/css/efemerides.css?v={VERSION_CSS}">
</head>
<body class="svc-page ef-page">
  <a class="skip" href="#contenido">Saltar al contenido</a>
  <header class="nav is-scrolled">
    <div class="nav-inner">
      <a class="brand" href="/" aria-label="CUMPLIFIX, S.C., inicio"><img src="/assets/img/logo-128.png" alt="" width="32" height="32"><span>CUMPLIFIX, S.C.</span></a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Abrir menú" data-menu><span></span></button>
      <nav class="nav-links" id="nav-links" aria-label="Principal">
        <a href="/#servicios">Servicios</a>
        <a href="/efemerides/">Efemérides</a>
        <a href="/#eventos">Eventos</a>
        <a href="/#equipo">Nosotros</a>
        <a href="/#preguntas">Preguntas</a>
      </nav>
      <button class="theme-btn" type="button" data-theme-toggle aria-label="Cambiar a modo oscuro"><span aria-hidden="true"></span></button>
      <a class="btn btn-sm" href="/#contacto">Agenda 20 min</a>
    </div>
  </header>

  <main id="contenido">
{cuerpo}
    <section class="contact sp-cta" aria-labelledby="ef-cta">
      <div class="sp-wrap sp-narrow">
        <h2 id="ef-cta" class="contact-title">Recibe las Efemérides cada mañana</h2>
        <p class="contact-sub">Gratis, en tu WhatsApp o tu correo: lo más importante del sistema financiero, los vencimientos ante la CONDUSEF y la lectura de nuestro equipo.</p>
        <div class="sp-ctas">
          <a class="btn btn-light" href="{e(FORMULARIO)}" target="_blank" rel="noopener">Quiero recibirlas</a>
          <a class="btn btn-ghost-dark" href="https://wa.me/525571462367?text=Hola%2C%20quiero%20recibir%20las%20Efem%C3%A9rides%20del%20Cumplimiento." target="_blank" rel="noopener">Escríbenos por WhatsApp</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="foot">
    <div class="foot-inner">
      <div class="foot-brand">
        <img src="/assets/img/logo-128.png" alt="" width="40" height="40">
        <div><b>CUMPLIFIX, S.C.</b><span>Cumple tus metas, nosotros tu cumplimiento</span></div>
      </div>
      <ul class="foot-links">
        <li><a href="/">Inicio</a></li>
        <li><a href="mailto:info@cumplifix.com">info@cumplifix.com</a></li>
        <li><a href="tel:+525571462367">55 7146 2367</a></li>
        <li><a href="/aviso-de-privacidad.html">Aviso de Privacidad</a></li>
      </ul>
      <p class="foot-legal">© 2026 CUMPLIFIX, S.C. · Firma de consultoría en cumplimiento normativo. No desarrolla software ni presta servicios de tecnología. CUMPLIFIX, S.C. no forma parte ni actúa en nombre de la CONDUSEF, la CNBV, el Banco de México ni otra autoridad.</p>
    </div>
  </footer>
</body>
</html>
"""


def organizacion():
    return {"@type": "Organization", "@id": f"{SITIO}/#organizacion", "name": "CUMPLIFIX, S.C.",
            "logo": {"@type": "ImageObject", "url": f"{SITIO}/assets/img/logo-1000.png"}}


# ---------------------------------------------------------------- piezas de una edición

def nota_html(n):
    url = liga(n.get("url"))
    titulo = f'<a href="{e(url)}" target="_blank" rel="noopener nofollow">{e(n.get("titulo"))}</a>' if url else e(n.get("titulo"))
    lectura = f'<p class="ef-lectura"><b>Lectura CUMPLIFIX, S.C.:</b> {e(n["lectura"])}</p>' if n.get("lectura") else ""
    etiqueta = f'<span class="ef-tag">{e(n.get("etiqueta"))}</span>' if n.get("etiqueta") else ""
    return f"""<li class="ef-nota">
            <div class="ef-meta">{etiqueta}<span>{e(n.get("medio"))}</span></div>
            <h3>{titulo}</h3>{lectura}
          </li>"""


def medidas(f):
    """Ancho y alto reales de la imagen publicada (la cuadrada mide 1080 × 1080)."""
    try:
        from PIL import Image
        with Image.open(os.path.join(RAIZ, f"assets/img/efemerides/{f}.jpg")) as im:
            return im.size
    except Exception:
        return (1080, 1350)


def fila_agenda(i):
    detalle = f"<span>{e(i.get('detalle'))}</span>" if i.get("detalle") else ""
    return f'<li><span class="ef-cuando">{e(i.get("cuando"))}</span><b>{e(i.get("titulo"))}</b>{detalle}</li>'


def edicion_html(ed, anterior, siguiente):
    f = ed["fecha"]
    partes = []
    img = f"/assets/img/efemerides/{f}.jpg" if os.path.exists(os.path.join(RAIZ, f"assets/img/efemerides/{f}.jpg")) else ""
    dia = next((n for n in ed.get("notas", []) if n.get("nota_del_dia")), None)

    partes.append(f"""    <section class="sp-hero ef-hero" aria-labelledby="ef-title">
      <div class="sp-wrap ef-hero-grid">
        <div>
          <nav class="sp-crumbs" aria-label="Ruta de navegación"><a href="/">Inicio</a> <span aria-hidden="true">/</span> <a href="/efemerides/">Efemérides</a> <span aria-hidden="true">/</span> <span aria-current="page">{e(fecha_larga(f))}</span></nav>
          <h1 id="ef-title" class="sp-title">Efemérides del Cumplimiento <span>{e(fecha_larga(f, True))}</span></h1>
          <p class="sp-sub">Lo más importante del sistema financiero mexicano, los vencimientos ante la CONDUSEF y la lectura del equipo de CUMPLIFIX, S.C.</p>
        </div>
        {f'<figure class="ef-imagen"><img src="{e(img)}" alt="Imagen de las Efemérides del Cumplimiento del {e(fecha_larga(f))}" width="{medidas(f)[0]}" height="{medidas(f)[1]}"></figure>' if img else ""}
      </div>
    </section>""")

    destacados = []
    if dia:
        destacados.append(f"""<article class="ef-card ef-dia"><h2>Nota del día</h2>
          <p class="ef-card-titulo"><a href="{e(liga(dia.get("url")))}" target="_blank" rel="noopener nofollow">{e(dia.get("titulo"))}</a></p>
          {f'<p class="ef-lectura"><b>Lectura CUMPLIFIX, S.C.:</b> {e(dia["lectura"])}</p>' if dia.get("lectura") else ""}
          <p class="ef-fuente">{e(dia.get("medio"))}</p></article>""")
    ev = ed.get("evento")
    if ev:
        destacados.append(f"""<article class="ef-card ef-evento"><h2>Hoy · {e(ev.get("organizador")) or "Evento"}</h2>
          <p class="ef-card-titulo">{e(ev.get("titulo"))}</p>{f'<p>{e(ev.get("bajada"))}</p>' if ev.get("bajada") else ""}
          <p class="ef-fuente">{e(ev.get("fecha_texto"))}{" · " + e(ev.get("hora")) if ev.get("hora") else ""}{" · " + e(ev.get("expositor")) if ev.get("expositor") else ""}</p>
          {f'<a class="btn btn-sm" href="{e(liga(ev.get("liga")))}" target="_blank" rel="noopener">Regístrate</a>' if liga(ev.get("liga")) else ""}</article>""")
    al = ed.get("alerta")
    if al:
        destacados.append(f"""<article class="ef-card ef-alerta"><h2>Alerta regulatoria{" · " + e(al.get("autoridad")) if al.get("autoridad") else ""}</h2>
          <p class="ef-card-titulo">{e(al.get("titulo"))}</p><p class="ef-texto">{e(al.get("texto"))}</p></article>""")
    if destacados:
        partes.append(f"""    <section class="sp-sec ef-sec" aria-label="Lo destacado">
      <div class="sp-wrap ef-destacados">{"".join(destacados)}</div>
    </section>""")

    ag = ed.get("agenda")
    if ag and (ag.get("items") or ag.get("inhabiles")):
        filas = "".join(fila_agenda(i) for i in ag.get("items", []) if i.get("titulo"))
        partes.append(f"""    <section class="sp-sec sp-alt ef-sec" aria-labelledby="ef-agenda">
      <div class="sp-wrap sp-narrow">
        <h2 id="ef-agenda" class="sp-h2">Agenda regulatoria</h2>
        <p class="sp-lead">Próximos vencimientos ante la CONDUSEF según la Disposición en Materia de Registros.</p>
        <ul class="ef-agenda">{filas}</ul>
        {f'<p class="sp-note">{e(ag.get("inhabiles"))}</p>' if ag.get("inhabiles") else ""}
        <p class="sp-note">Consulta tu calendario completo en <a href="https://agenda.cumplifix.com/">agenda.cumplifix.com</a>.</p>
      </div>
    </section>""")

    resto = [n for n in ed.get("notas", []) if not n.get("nota_del_dia")]
    for clave, nombre, sub in SECCIONES:
        notas = [n for n in resto if n.get("seccion") == clave]
        if not notas:
            continue
        partes.append(f"""    <section class="sp-sec ef-sec" aria-labelledby="ef-{clave}">
      <div class="sp-wrap sp-narrow">
        <h2 id="ef-{clave}" class="sp-h2">{e(nombre)}</h2>{f'<p class="sp-lead">{e(sub)}</p>' if sub else ""}
        <ul class="ef-notas">
          {"".join(nota_html(n) for n in notas)}
        </ul>
      </div>
    </section>""")

    ind = ed.get("indicadores") or {}
    celdas = "".join(f'<div><dt>{e(nombre)}</dt><dd>{e((pre if not str(ind[k]).startswith(pre) else "") + str(ind[k]))}</dd></div>'
                     for k, nombre, pre in INDICADORES if str(ind.get(k) or "").strip())
    if celdas:
        partes.append(f"""    <section class="sp-sec sp-alt ef-sec" aria-labelledby="ef-ind">
      <div class="sp-wrap sp-narrow">
        <h2 id="ef-ind" class="sp-h2">Indicadores financieros</h2>
        <dl class="ef-indicadores">{celdas}</dl>
        <p class="sp-note">Fuente: <a href="https://dof.gob.mx/">Diario Oficial de la Federación</a>{", " + e(ind.get("fecha")) if ind.get("fecha") else ""}.</p>
      </div>
    </section>""")

    hi = ed.get("historia")
    if hi:
        import datetime
        d = datetime.date.fromisoformat(f)
        cuando = f"{d.day} de {MESES[d.month - 1]}" + (f" de {e(hi.get('anio'))}" if hi.get("anio") else "")
        partes.append(f"""    <section class="sp-sec ef-sec" aria-labelledby="ef-hist">
      <div class="sp-wrap sp-narrow">
        <h2 id="ef-hist" class="sp-h2">Un día como hoy</h2>
        <p class="sp-lead"><b>{cuando}.</b> {e(hi.get("texto"))}</p>
        {f'<p class="sp-note"><a href="{e(liga(hi.get("fuente")))}" target="_blank" rel="noopener">Fuente</a></p>' if liga(hi.get("fuente")) else ""}
      </div>
    </section>""")

    nav = []
    if anterior:
        nav.append(f'<a href="/efemerides/{anterior}/">← {e(fecha_larga(anterior))}</a>')
    nav.append('<a href="/efemerides/">Todas las ediciones</a>')
    if siguiente:
        nav.append(f'<a href="/efemerides/{siguiente}/">{e(fecha_larga(siguiente))} →</a>')
    partes.append(f"""    <section class="sp-sec ef-sec ef-pie" aria-label="Otras ediciones">
      <div class="sp-wrap sp-narrow">
        <nav class="ef-nav">{"".join(nav)}</nav>
        <p class="sp-note">Los titulares enlazan a los medios que publicaron cada nota. La Lectura es la opinión del equipo de CUMPLIFIX, S.C., es información general y no constituye asesoría legal para un caso concreto.</p>
      </div>
    </section>""")

    titulo = f"Efemérides del Cumplimiento · {fecha_larga(f)}"
    primeros = "; ".join(n.get("titulo", "") for n in ed.get("notas", [])[:3])
    descripcion = (f"Lo más importante del sistema financiero el {fecha_larga(f)}: {primeros}")[:300]
    canonica = f"{SITIO}/efemerides/{f}/"
    og = f"{SITIO}{img}" if img else f"{SITIO}/assets/img/og-cumplifix.jpg"
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "headline": titulo, "description": descripcion, "inLanguage": "es-MX",
         "datePublished": f, "dateModified": f, "author": organizacion(), "publisher": organizacion(),
         "mainEntityOfPage": canonica, "image": og},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": f"{SITIO}/"},
            {"@type": "ListItem", "position": 2, "name": "Efemérides", "item": f"{SITIO}/efemerides/"},
            {"@type": "ListItem", "position": 3, "name": fecha_larga(f), "item": canonica}]}]}
    return pagina(titulo, descripcion, canonica, og, "\n".join(partes), ld)


def indice_html(ediciones):
    ultima = ediciones[0]
    f = ultima["fecha"]
    img = f"/assets/img/efemerides/{f}.jpg" if os.path.exists(os.path.join(RAIZ, f"assets/img/efemerides/{f}.jpg")) else ""
    titulares = "".join(f'<li><span class="ef-tag">{e(n.get("etiqueta"))}</span> {e(n.get("titulo"))}</li>'
                        for n in ultima.get("notas", [])[:6])
    meses = {}
    for ed in ediciones:
        meses.setdefault(ed["fecha"][:7], []).append(ed)
    archivo = []
    for clave, lista in meses.items():
        a, m = clave.split("-")
        items = "".join(f'<li><a href="/efemerides/{x["fecha"]}/">{e(fecha_larga(x["fecha"], True))}</a>'
                        f'<span>{e((x.get("notas") or [{}])[0].get("titulo", ""))}</span></li>' for x in lista)
        archivo.append(f'<h3 class="ef-mes">{MESES[int(m) - 1].capitalize()} {a}</h3><ul class="ef-archivo">{items}</ul>')
    cuerpo = f"""    <section class="sp-hero ef-hero" aria-labelledby="ef-title">
      <div class="sp-wrap ef-hero-grid">
        <div>
          <nav class="sp-crumbs" aria-label="Ruta de navegación"><a href="/">Inicio</a> <span aria-hidden="true">/</span> <span aria-current="page">Efemérides</span></nav>
          <h1 id="ef-title" class="sp-title">Efemérides del Cumplimiento <span>El sistema financiero mexicano, cada mañana.</span></h1>
          <p class="sp-sub">Noticias de la CONDUSEF, la CNBV, el Banco de México y el sector; vencimientos regulatorios e indicadores del día, con la lectura del equipo de CUMPLIFIX, S.C.</p>
        </div>
        {f'<figure class="ef-imagen"><a href="/efemerides/{f}/"><img src="{e(img)}" alt="Imagen de las Efemérides del {e(fecha_larga(f))}" width="{medidas(f)[0]}" height="{medidas(f)[1]}"></a></figure>' if img else ""}
      </div>
    </section>
    <section class="sp-sec ef-sec" aria-labelledby="ef-hoy">
      <div class="sp-wrap sp-narrow">
        <h2 id="ef-hoy" class="sp-h2">Edición más reciente</h2>
        <p class="sp-lead">{e(fecha_larga(f, True))}</p>
        <ul class="ef-titulares">{titulares}</ul>
        <p><a class="btn" href="/efemerides/{f}/">Leer la edición completa</a></p>
      </div>
    </section>
    <section class="sp-sec sp-alt ef-sec" aria-labelledby="ef-archivo">
      <div class="sp-wrap sp-narrow">
        <h2 id="ef-archivo" class="sp-h2">Ediciones anteriores</h2>
        {"".join(archivo)}
      </div>
    </section>"""
    canonica = f"{SITIO}/efemerides/"
    og = f"{SITIO}{img}" if img else f"{SITIO}/assets/img/og-cumplifix.jpg"
    descripcion = "Boletín diario de CUMPLIFIX, S.C.: noticias del sistema financiero mexicano, vencimientos ante la CONDUSEF, indicadores y la lectura de nuestro equipo."
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Efemérides del Cumplimiento",
          "description": descripcion, "url": canonica, "inLanguage": "es-MX", "publisher": organizacion()}
    return pagina("Efemérides del Cumplimiento · CUMPLIFIX, S.C.", descripcion, canonica, og, cuerpo, ld)


# ---------------------------------------------------------------- imágenes y sitemap

def guardar_imagen(ed):
    """Descarga el PNG publicado y lo guarda como JPEG ligero (≈200 KB)."""
    if not ed.get("imagen"):
        return False
    destino = os.path.join(RAIZ, f"assets/img/efemerides/{ed['fecha']}.jpg")
    try:
        from PIL import Image
        png = bajar(urllib.parse.urljoin(ORIGEN, ed["imagen"]))
        if not png.startswith(b"\x89PNG\r\n\x1a\n"):
            return False
        im = Image.open(io.BytesIO(png)).convert("RGB")
        im.thumbnail((1080, 1350))
        salida = io.BytesIO()
        im.save(salida, "JPEG", quality=84, optimize=True, progressive=True)
        datos = salida.getvalue()
    except Exception as err:  # sin imagen la página se publica igual
        print(f"Imagen {ed['fecha']}: {err}", file=sys.stderr)
        return False
    if os.path.exists(destino) and open(destino, "rb").read() == datos:
        return False
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "wb") as f:
        f.write(datos)
    return True


def actualizar_sitemap(ediciones):
    ruta = os.path.join(RAIZ, "sitemap.xml")
    with open(ruta, encoding="utf-8") as f:
        texto = f.read()
    bloque = "  <!-- efemerides -->\n" + f"  <url><loc>{SITIO}/efemerides/</loc><lastmod>{ediciones[0]['fecha']}</lastmod></url>\n" + "".join(
        f"  <url><loc>{SITIO}/efemerides/{ed['fecha']}/</loc><lastmod>{ed['fecha']}</lastmod></url>\n" for ed in ediciones
    ) + "  <!-- /efemerides -->\n"
    if "<!-- efemerides -->" in texto:
        texto = re.sub(r"  <!-- efemerides -->\n.*?  <!-- /efemerides -->\n", lambda _: bloque, texto, flags=re.S)
    else:
        texto = texto.replace("</urlset>", bloque + "</urlset>")
    return escribir("sitemap.xml", texto)


def main():
    try:
        datos = json.loads(bajar(f"{ORIGEN}/publico/efemerides.json"))
    except Exception as err:
        print(f"No se pudo leer el portal ({err}); no se cambia nada.")
        return 0
    ediciones = sorted((x for x in datos.get("ediciones", []) if FECHA_RE.match(str(x.get("fecha", "")))),
                       key=lambda x: x["fecha"], reverse=True)
    if not ediciones:
        print("No hay ediciones publicadas; no se cambia nada.")
        return 0
    cambios = 0
    for ed in ediciones:
        cambios += guardar_imagen(ed)
    fechas = [x["fecha"] for x in ediciones]
    for i, ed in enumerate(ediciones):
        anterior = fechas[i + 1] if i + 1 < len(fechas) else None
        siguiente = fechas[i - 1] if i > 0 else None
        cambios += escribir(f"efemerides/{ed['fecha']}/index.html", edicion_html(ed, anterior, siguiente))
    cambios += escribir("efemerides/index.html", indice_html(ediciones))
    cambios += actualizar_sitemap(ediciones)
    # Ediciones que el equipo quitó del sitio: se borran sus páginas e imágenes
    carpeta = os.path.join(RAIZ, "efemerides")
    for nombre in os.listdir(carpeta):
        if FECHA_RE.match(nombre) and nombre not in fechas:
            import shutil
            shutil.rmtree(os.path.join(carpeta, nombre))
            img = os.path.join(RAIZ, f"assets/img/efemerides/{nombre}.jpg")
            if os.path.exists(img):
                os.remove(img)
            cambios += 1
    print(f"{len(ediciones)} ediciones publicadas; {cambios} archivos cambiados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
