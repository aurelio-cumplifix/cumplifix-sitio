"""Sincroniza la hoja «Contenido cumplifix.com» con data/*.json.

Lee las pestañas Eventos, Noticias y Cursos como CSV (la hoja debe estar compartida
como «Cualquier persona con el enlace: Lector»). El ID de la hoja llega por la variable
de entorno SHEET_ID (secreto del repositorio), para que no quede en el código público.

Reglas de seguridad:
- Si una pestaña no se puede leer, o no tiene ninguna fila real, su JSON no se toca.
- Solo se aceptan ligas https y fechas/horas válidas; lo demás se descarta con aviso.
- La columna «Notas internas» nunca se copia al sitio.
- Las imágenes de Drive se descargan al repositorio (assets/img/eventos/), porque la
  política de seguridad del sitio no permite cargar imágenes de otros dominios.

Para probar sin internet: SHEET_CSV_DIR=carpeta con Eventos.csv, Noticias.csv, Cursos.csv.
"""
import csv
import hashlib
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
IMG_DIR = os.path.join(ROOT, "assets", "img", "eventos")
UA = {"User-Agent": "cumplifix-sync/1.0"}


def aviso(msg):
    print(f"::warning::{msg}")


def leer_pestana(nombre):
    carpeta = os.environ.get("SHEET_CSV_DIR")
    if carpeta:
        ruta = os.path.join(carpeta, f"{nombre}.csv")
        return open(ruta, encoding="utf-8").read() if os.path.exists(ruta) else None
    sheet_id = os.environ.get("SHEET_ID", "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,}", sheet_id):
        aviso("Falta el secreto SHEET_ID o no es válido.")
        return None
    url = (f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?"
           + urllib.parse.urlencode({"tqx": "out:csv", "sheet": nombre, "headers": "1"}))
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            tipo = r.headers.get("Content-Type", "")
            texto = r.read().decode("utf-8")
    except Exception as e:  # red, permisos, etc.
        aviso(f"No se pudo leer la pestaña {nombre}: {e}")
        return None
    if "csv" not in tipo and texto.lstrip().startswith("<"):
        aviso(f"La pestaña {nombre} no es pública (¿la hoja está compartida con «Cualquier persona con el enlace»?).")
        return None
    return texto


def filas(texto):
    rows = list(csv.reader(io.StringIO(texto)))
    out = []
    for row in rows[1:]:  # la fila 1 son encabezados
        row = [c.strip() for c in row] + [""] * 12
        if not any(row[:9]):
            continue
        if row[0].lower().startswith("sí / no") or row[1].upper() == "AAAA-MM-DD":
            continue  # fila de ejemplo
        out.append(row)
    return out


def si(valor):
    return valor.strip().lower() in {"sí", "si", "s", "x", "true", "verdadero", "1", "yes"}


def fecha(valor):
    v = valor.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        datetime.strptime(v, "%Y-%m-%d")
        return v
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", v)  # formato es-MX: día/mes/año
    if m:
        d, mth, y = map(int, m.groups())
        return datetime(y, mth, d).strftime("%Y-%m-%d")
    raise ValueError(f"fecha no válida: {valor!r}")


def hora(valor, opcional=False):
    v = valor.strip().lower().replace(".", "").replace(" ", "")
    if not v and opcional:
        return ""
    m = re.fullmatch(r"(\d{1,2}):(\d{2})(?::\d{2})?(am|pm)?", v)
    if not m:
        raise ValueError(f"hora no válida: {valor!r}")
    h, mi, ap = int(m.group(1)), int(m.group(2)), m.group(3)
    if ap == "pm" and h < 12:
        h += 12
    if ap == "am" and h == 12:
        h = 0
    if h > 23 or mi > 59:
        raise ValueError(f"hora no válida: {valor!r}")
    return f"{h:02d}:{mi:02d}"


def liga(valor):
    v = valor.strip()
    if not v:
        return ""
    p = urllib.parse.urlparse(v)
    if p.scheme != "https" or not p.netloc:
        raise ValueError(f"la liga debe empezar con https://: {valor!r}")
    return v


def texto(valor, maximo):
    v = re.sub(r"\s+", " ", valor).strip()
    return v[:maximo]


def imagen_drive(valor):
    """Descarga un flyer compartido en Drive y regresa su ruta local, o "" si no se puede."""
    v = valor.strip()
    if not v:
        return ""
    m = re.search(r"/d/([A-Za-z0-9_-]{20,})", v) or re.search(r"[?&]id=([A-Za-z0-9_-]{20,})", v)
    if not m:
        aviso(f"Imagen ignorada (no es una liga de Drive): {v}")
        return ""
    file_id = m.group(1)
    for ext in ("jpg", "png", "webp"):
        existente = os.path.join(IMG_DIR, f"{file_id[:16]}.{ext}")
        if os.path.exists(existente):
            return f"assets/img/eventos/{file_id[:16]}.{ext}"
    if os.environ.get("SHEET_CSV_DIR"):
        return ""
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            datos = r.read(4_000_001)
    except Exception as e:
        aviso(f"No se pudo descargar la imagen {file_id}: {e}")
        return ""
    if len(datos) > 4_000_000:
        aviso(f"Imagen {file_id} mayor a 4 MB: ignorada.")
        return ""
    if datos[:3] == b"\xff\xd8\xff":
        ext = "jpg"
    elif datos[:8] == b"\x89PNG\r\n\x1a\n":
        ext = "png"
    elif datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        ext = "webp"
    else:
        aviso(f"Imagen {file_id}: no es JPG, PNG ni WEBP (¿está compartida con «Cualquier persona con el enlace»?).")
        return ""
    os.makedirs(IMG_DIR, exist_ok=True)
    nombre = f"{file_id[:16]}.{ext}"
    with open(os.path.join(IMG_DIR, nombre), "wb") as f:
        f.write(datos)
    return f"assets/img/eventos/{nombre}"


def eventos(rows):
    out = []
    for r in rows:
        try:
            out.append({
                "publicar": si(r[0]),
                "fecha": fecha(r[1]),
                "hora": hora(r[2]),
                "organizador": texto(r[3], 60),
                "evento": texto(r[4], 160),
                "tema": texto(r[5], 240),
                "expositor": texto(r[6], 200),
                "liga": liga(r[7]),
                "imagen": imagen_drive(r[8]),
                "visibleHasta": "",
            })  # r[9] = Notas internas: no se publica
        except ValueError as e:
            aviso(f"Eventos: fila omitida ({e}).")
    return out


def noticias(rows):
    out = []
    for r in rows:
        try:
            out.append({
                "publicar": si(r[0]),
                "fecha": fecha(r[1]),
                "fuente": texto(r[2], 60),
                "titulo": texto(r[3], 160),
                "resumen": texto(r[4], 320),
                "liga": liga(r[5]),
                "visibleHasta": "",
            })
        except ValueError as e:
            aviso(f"Noticias: fila omitida ({e}).")
    out.sort(key=lambda n: n["fecha"], reverse=True)
    return out


def cursos(rows):
    out = []
    for r in rows:
        try:
            out.append({
                "publicar": si(r[0]),
                "fecha": fecha(r[1]),
                "horario": texto(r[2], 60),
                "modalidad": texto(r[3], 80),
                "titulo": texto(r[4], 160),
                "precio": texto(r[5], 60),
                "inscripcion": liga(r[6]),
                "visibleHasta": "",
            })
        except ValueError as e:
            aviso(f"Cursos: fila omitida ({e}).")
    return out


PESTANAS = [
    ("Eventos", "eventos.json", "eventos", eventos),
    ("Noticias", "noticias.json", "notas", noticias),
    ("Cursos", "academia.json", "cursos", cursos),
]


def main():
    cambios = 0
    for pestana, archivo, llave, convertir in PESTANAS:
        crudo = leer_pestana(pestana)
        if crudo is None:
            continue
        rows = filas(crudo)
        if not rows:
            print(f"{pestana}: sin filas reales; {archivo} se queda como está.")
            continue
        items = convertir(rows)
        if not items:
            aviso(f"{pestana}: ninguna fila válida; {archivo} se queda como está.")
            continue
        ruta = os.path.join(DATA, archivo)
        actual = json.load(open(ruta, encoding="utf-8"))
        if llave == "eventos":
            # Si la hoja no trae flyer, conserva el que ya se había subido al sitio para ese evento.
            previas = {(e.get("fecha"), e.get("hora"), e.get("organizador")): e.get("imagen", "") for e in actual.get("eventos", [])}
            for e in items:
                if not e["imagen"]:
                    e["imagen"] = previas.get((e["fecha"], e["hora"], e["organizador"]), "")
        nuevo = {"_instrucciones": actual.get("_instrucciones", ""), llave: items}
        if nuevo != actual:
            with open(ruta, "w", encoding="utf-8") as f:
                json.dump(nuevo, f, ensure_ascii=False, indent=2)
                f.write("\n")
            cambios += 1
            print(f"{pestana}: {len(items)} filas → {archivo} actualizado.")
        else:
            print(f"{pestana}: sin cambios.")
    print(f"Listo. Archivos actualizados: {cambios}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
