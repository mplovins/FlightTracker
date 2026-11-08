/**
 * Skyline · servidor de datos en Google Apps Script (gratis)
 *
 * Por qué Google: en España los operadores bloquean direcciones de Cloudflare
 * durante los partidos de LaLiga, y eso dejaba sin datos a la app. Las
 * direcciones de Google no se ven afectadas.
 *
 * Instalación: script.google.com > Nuevo proyecto > pega este archivo >
 * Implementar > Nueva implementación > Aplicación web > Ejecutar como: Yo >
 * Quién tiene acceso: Cualquier usuario > Implementar > Autorizar.
 *
 * Uso (desde la app):  .../exec?p=callsign/IBE3166   ?p=hex/3443c5
 *                      ?p=reg/EC-MXV   ?p=point/40.4/-3.6/100   ?p=debug
 */

const VERSION = 3;

const SOURCES = [
  {
    name: "adsb.lol",
    url: (k, a) => ({
      callsign: `https://api.adsb.lol/v2/callsign/${a[0]}`,
      hex: `https://api.adsb.lol/v2/hex/${a[0]}`,
      reg: `https://api.adsb.lol/v2/reg/${a[0]}`,
      point: `https://api.adsb.lol/v2/point/${a[0]}/${a[1]}/${a[2]}`,
    })[k],
  },
  {
    name: "adsb.fi",
    url: (k, a) => ({
      callsign: `https://opendata.adsb.fi/api/v2/callsign/${a[0]}`,
      hex: `https://opendata.adsb.fi/api/v2/hex/${a[0]}`,
      reg: `https://opendata.adsb.fi/api/v2/registration/${a[0]}`,
      point: `https://opendata.adsb.fi/api/v2/lat/${a[0]}/lon/${a[1]}/dist/${a[2]}`,
    })[k],
  },
];

// Solo los campos que usa la app (respuestas más ligeras para el móvil)
const FIELDS = ["hex", "flight", "r", "t", "desc", "alt_baro", "alt_geom", "gs", "track", "true_heading", "mag_heading",
  "baro_rate", "geom_rate", "squawk", "emergency", "lat", "lon", "seen", "seen_pos", "type", "rssi", "mach"];

const ID = /^[A-Za-z0-9-]{1,12}$/;
const NUM = /^-?\d{1,3}(\.\d{1,6})?$/;

function doGet(e) {
  const path = String((e && e.parameter && e.parameter.p) || (e && e.pathInfo) || "");
  const [kind, ...args] = path.split("/").filter(String);
  if (!kind) return out({ ok: true, service: "skyline-proxy", platform: "google-apps-script", version: VERSION });

  if (kind === "debug") {
    const results = SOURCES.map(s => query(s, "point", ["40.4", "-3.6", "50"]));
    return out({
      version: VERSION,
      platform: "google-apps-script",
      sources: results.map(r => ({ src: r.src, ms: r.ms, ok: !!r.ac, aircraft: r.ac ? r.ac.length : undefined, error: r.error })),
    });
  }

  const valid =
    (["callsign", "hex", "reg"].includes(kind) && args.length === 1 && ID.test(args[0])) ||
    (kind === "point" && args.length === 3 && args.every(x => NUM.test(x)) && +args[2] > 0 && +args[2] <= 250);
  if (!valid) return out({ error: "bad request" });

  const tried = [];
  let empty = null;
  for (const s of SOURCES) {
    const r = query(s, kind, args);
    if (r.ac) {
      // En búsquedas concretas, si una fuente no lo ve, probamos la siguiente
      if (r.ac.length || kind === "point") return out({ ac: r.ac.map(slim), src: r.src, now: r.now });
      empty = empty || r;
    }
    tried.push({ src: r.src, error: r.error, ms: r.ms });
  }
  if (empty) return out({ ac: [], src: empty.src });
  return out({ error: "no source available", sources: tried });
}

function query(source, kind, args) {
  const started = Date.now();
  try {
    const r = UrlFetchApp.fetch(source.url(kind, args), {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { Accept: "application/json" },
    });
    const code = r.getResponseCode();
    if (code !== 200) return { src: source.name, error: "HTTP " + code, ms: Date.now() - started };
    const d = JSON.parse(r.getContentText());
    const ac = d.ac || d.aircraft;
    if (!Array.isArray(ac)) return { src: source.name, error: "respuesta no válida", ms: Date.now() - started };
    return { src: source.name, ac: ac, now: d.now, ms: Date.now() - started };
  } catch (err) {
    return { src: source.name, error: String((err && err.message) || err), ms: Date.now() - started };
  }
}

function slim(a) {
  const o = {};
  for (const f of FIELDS) if (a[f] !== undefined) o[f] = a[f];
  return o;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
