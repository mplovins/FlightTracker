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
 * Actualizar: sustituye el código > Implementar > Gestionar implementaciones >
 * lápiz > Versión: Nueva versión > Implementar (la dirección /exec no cambia).
 *
 * Opcional, tráfico mundial con cuenta gratuita de OpenSky (más consultas al día):
 * Configuración del proyecto (engranaje) > Propiedades del script >
 *   OPENSKY_CLIENT_ID y OPENSKY_CLIENT_SECRET
 *
 * Uso (desde la app):  .../exec?p=callsign/IBE3166   ?p=hex/3443c5   ?p=reg/EC-MXV
 *   ?p=point/40.4/-3.6/100   ?p=multi/40.4,-3.6,250;41.3,2.1,200   ?p=world   ?p=track/3443c5   ?p=debug
 */

const VERSION = 5;

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

const OPENSKY_STATES = "https://opensky-network.org/api/states/all";
const OPENSKY_TRACK = "https://opensky-network.org/api/tracks/all";
const OPENSKY_TOKEN = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const WORLD_TTL = 30; // segundos que se reutiliza la foto mundial (ahorra cupo de OpenSky)

// Solo los campos que usa la app (respuestas más ligeras para el móvil)
const FIELDS = ["hex", "flight", "r", "t", "desc", "alt_baro", "alt_geom", "gs", "track", "true_heading", "mag_heading",
  "baro_rate", "geom_rate", "squawk", "emergency", "lat", "lon", "seen", "seen_pos", "type", "rssi", "mach"];

const ID = /^[A-Za-z0-9-]{1,12}$/;
const NUM = /^-?\d{1,3}(\.\d{1,6})?$/;

function doGet(e) {
  const path = String((e && e.parameter && e.parameter.p) || (e && e.pathInfo) || "");
  const [kind, ...args] = path.split("/").filter(String);
  if (!kind) return out({ ok: true, service: "skyline-proxy", platform: "google-apps-script", version: VERSION, features: ["world", "multi", "track"] });

  if (kind === "debug") {
    const results = SOURCES.map(s => query(s, "point", ["40.4", "-3.6", "50"]));
    const creds = openskyCredentials();
    return out({
      version: VERSION,
      platform: "google-apps-script",
      opensky: creds ? "cuenta configurada" : "anónimo (cupo diario reducido)",
      sources: results.map(r => ({ src: r.src, ms: r.ms, ok: !!r.ac, aircraft: r.ac ? r.ac.length : undefined, error: r.error })),
    });
  }

  if (kind === "world") return outRaw(world());
  if (kind === "multi") return out(multi(args[0]));
  if (kind === "track") return out(track(args[0]));

  const valid =
    (["callsign", "hex", "reg"].includes(kind) && args.length === 1 && ID.test(args[0])) ||
    (kind === "point" && args.length === 3 && args.every(x => NUM.test(x)) && validPoint(args));
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
    return parseAdsb(source.name, r, started);
  } catch (err) {
    return { src: source.name, error: String((err && err.message) || err), ms: Date.now() - started };
  }
}

function parseAdsb(name, r, started) {
  const code = r.getResponseCode();
  if (code !== 200) return { src: name, error: "HTTP " + code, ms: Date.now() - started };
  try {
    const d = JSON.parse(r.getContentText());
    const ac = d.ac || d.aircraft;
    if (!Array.isArray(ac)) return { src: name, error: "respuesta no válida", ms: Date.now() - started };
    return { src: name, ac: ac, now: d.now, ms: Date.now() - started };
  } catch (err) {
    return { src: name, error: "respuesta no válida", ms: Date.now() - started };
  }
}

/* ---------- Varias zonas a la vez (tráfico de la parte del mapa que ves) ---------- */
// Formato compacto por avión: [hex, indicativo, lat, lon, altitud ft (-1 = en tierra), vel. kt, rumbo,
//                              vel. vertical ft/min, segundos desde la posición, squawk, tipo, matrícula]
function multi(spec) {
  const pts = String(spec || "").split(";").map(x => x.split(","))
    .filter(p => p.length === 3 && p.every(v => NUM.test(v)) && validPoint(p))
    .slice(0, 8);
  if (!pts.length) return { error: "bad request" };
  const started = Date.now();
  const opts = { muteHttpExceptions: true, followRedirects: true, headers: { Accept: "application/json" } };
  const rows = {};
  const add = list => {
    for (const a of list) if (a.hex && a.lat != null && a.lon != null && !rows[a.hex]) rows[a.hex] = compactAdsb(a);
  };
  let failed = [];
  try {
    const res = UrlFetchApp.fetchAll(pts.map(p => Object.assign({ url: SOURCES[0].url("point", p) }, opts)));
    res.forEach((r, i) => { const q = parseAdsb(SOURCES[0].name, r, started); if (q.ac) add(q.ac); else failed.push(pts[i]); });
  } catch (err) {
    failed = pts;
  }
  // Las zonas que fallen se piden a la segunda fuente (de una en una: admite 1 consulta por segundo)
  failed.slice(0, 3).forEach((p, i) => {
    if (i) Utilities.sleep(1100);
    const q = query(SOURCES[1], "point", p);
    if (q.ac) add(q.ac);
  });
  const a = Object.keys(rows).map(k => rows[k]);
  return { t: Math.round(Date.now() / 1000), src: "adsb", n: a.length, failed: failed.length, ms: Date.now() - started, a: a };
}

function compactAdsb(a) {
  const alt = a.alt_baro === "ground" ? -1 : typeof a.alt_baro === "number" ? a.alt_baro : typeof a.alt_geom === "number" ? a.alt_geom : null;
  return [a.hex, (a.flight || "").trim(), round4(a.lat), round4(a.lon), alt, rnd(a.gs), rnd(a.track != null ? a.track : a.true_heading),
    rnd(a.baro_rate != null ? a.baro_rate : a.geom_rate), rnd(a.seen_pos != null ? a.seen_pos : a.seen), a.squawk || "", a.t || "", a.r || ""];
}

/* ---------- Foto mundial de OpenSky Network ---------- */
// Mismo formato compacto; la columna 9 es la hora de la posición (segundos UNIX) en vez de "segundos desde".
function world() {
  const cache = CacheService.getScriptCache();
  const hit = cacheGetBig(cache, "world");
  if (hit) return hit;
  const started = Date.now();
  let token = null;
  try { token = openskyToken(); } catch (err) { token = null; }
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  let r;
  try {
    r = UrlFetchApp.fetch(OPENSKY_STATES, { muteHttpExceptions: true, headers: headers });
  } catch (err) {
    return JSON.stringify({ error: "opensky: " + String((err && err.message) || err) });
  }
  const code = r.getResponseCode();
  const h = r.getHeaders() || {};
  const left = h["x-rate-limit-remaining"] || h["X-Rate-Limit-Remaining"] || null;
  if (code === 401 && token) cache.remove("os_token");
  if (code !== 200) return JSON.stringify({ error: "opensky HTTP " + code + (code === 429 ? " (cupo diario agotado)" : ""), auth: !!token, left: left });
  let d;
  try { d = JSON.parse(r.getContentText()); } catch (err) { return JSON.stringify({ error: "opensky: respuesta no válida" }); }
  const a = [];
  for (const s of d.states || []) {
    if (s[5] == null || s[6] == null) continue;
    const altM = s[7] != null ? s[7] : s[13];
    a.push([s[0], (s[1] || "").trim(), round4(s[6]), round4(s[5]), s[8] ? -1 : altM != null ? Math.round(altM * 3.28084) : null,
      s[9] != null ? Math.round(s[9] * 1.94384) : null, rnd(s[10]), s[11] != null ? Math.round(s[11] * 196.85) : null,
      s[3] || s[4] || d.time, s[14] || ""]);
  }
  const json = JSON.stringify({ t: d.time, src: "opensky", auth: !!token, left: left, n: a.length, ms: Date.now() - started, a: a });
  try { cachePutBig(cache, "world", json, WORLD_TTL); } catch (err) { /* sin caché: no pasa nada */ }
  return json;
}

/* ---------- Trayectoria completa del vuelo actual (OpenSky) ---------- */
// Puntos: [hora UNIX, lat, lon, altitud ft, rumbo, en tierra 0/1]
function track(hex) {
  hex = String(hex || "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) return { error: "bad request" };
  const cache = CacheService.getScriptCache(), key = "trk:" + hex;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  let token = null;
  try { token = openskyToken(); } catch (err) { token = null; }
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  let r;
  try {
    r = UrlFetchApp.fetch(OPENSKY_TRACK + "?icao24=" + hex + "&time=0", { muteHttpExceptions: true, headers: headers });
  } catch (err) {
    return { error: "opensky: " + String((err && err.message) || err) };
  }
  const code = r.getResponseCode();
  if (code === 404) return { hex: hex, path: [] };
  if (code !== 200) return { error: "opensky HTTP " + code + (code === 429 ? " (cupo diario agotado)" : "") };
  let d;
  try { d = JSON.parse(r.getContentText()); } catch (err) { return { error: "opensky: respuesta no válida" }; }
  const path = (d.path || []).filter(p => p[1] != null && p[2] != null)
    .map(p => [p[0], round4(p[1]), round4(p[2]), p[3] != null ? Math.round(p[3] * 3.28084) : null, rnd(p[4]), p[5] ? 1 : 0]);
  const res = { hex: hex, cs: String(d.callsign || "").trim(), start: d.startTime, end: d.endTime, path: path };
  try { cache.put(key, JSON.stringify(res), 120); } catch (err) { /* demasiado grande para la caché */ }
  return res;
}

function openskyCredentials() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty("OPENSKY_CLIENT_ID"), secret = p.getProperty("OPENSKY_CLIENT_SECRET");
  return id && secret ? { id: id.trim(), secret: secret.trim() } : null;
}

function openskyToken() {
  const creds = openskyCredentials();
  if (!creds) return null;
  const cache = CacheService.getScriptCache();
  const cached = cache.get("os_token");
  if (cached) return cached;
  const r = UrlFetchApp.fetch(OPENSKY_TOKEN, {
    method: "post",
    muteHttpExceptions: true,
    payload: { grant_type: "client_credentials", client_id: creds.id, client_secret: creds.secret },
  });
  if (r.getResponseCode() !== 200) return null;
  const tok = JSON.parse(r.getContentText());
  if (!tok.access_token) return null;
  cache.put("os_token", tok.access_token, Math.max(60, Math.min(21600, (tok.expires_in || 1800) - 120)));
  return tok.access_token;
}

/* ---------- Utilidades ---------- */
function cachePutBig(cache, key, str, ttl) {
  const size = 90000, n = Math.ceil(str.length / size), obj = {};
  for (let i = 0; i < n; i++) obj[key + ":" + i] = str.slice(i * size, (i + 1) * size);
  obj[key + ":n"] = String(n);
  cache.putAll(obj, ttl);
}

function cacheGetBig(cache, key) {
  const n = Number(cache.get(key + ":n"));
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + ":" + i);
  const got = cache.getAll(keys);
  if (keys.some(k => got[k] == null)) return null;
  return keys.map(k => got[k]).join("");
}

function validPoint(p) {
  return Math.abs(+p[0]) <= 90 && Math.abs(+p[1]) <= 180 && +p[2] > 0 && +p[2] <= 250;
}

function round4(x) { return x == null ? null : Math.round(x * 10000) / 10000; }
function rnd(x) { return x == null ? null : Math.round(x); }

function slim(a) {
  const o = {};
  for (const f of FIELDS) if (a[f] !== undefined) o[f] = a[f];
  return o;
}

function out(obj) {
  return outRaw(JSON.stringify(obj));
}

function outRaw(str) {
  return ContentService.createTextOutput(str).setMimeType(ContentService.MimeType.JSON);
}
