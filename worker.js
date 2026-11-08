/*
 * Skyline · servidor intermedio para Cloudflare Workers (gratis)
 *
 * Los servidores públicos de datos ADS-B no permiten que una página web los
 * consulte directamente desde el navegador (CORS). Este pequeño Worker hace la
 * consulta por ti y devuelve los datos a la app.
 *
 * Instalación: Cloudflare > Workers & Pages > Create > Start with Hello World >
 * Deploy > Edit code > pega este archivo entero > Deploy.
 *
 * Rutas que entiende:
 *   /callsign/IBE3166   /hex/3443c5   /reg/EC-MXV   /point/40.4/-3.6/100
 *   /debug   (diagnóstico: qué fuentes responden y cuánto tardan)
 */

const VERSION = 2;
const TIMEOUT_MS = 6000;

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const ID = /^[A-Za-z0-9-]{1,12}$/;
const NUM = /^-?\d{1,3}(\.\d{1,6})?$/;

// Consulta una fuente con límite de tiempo. Nunca lanza errores: devuelve el resultado o el motivo del fallo.
async function query(source, kind, args) {
  const started = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(source.url(kind, args), {
      signal: ctl.signal,
      headers: { Accept: "application/json", "User-Agent": "Skyline flight tracker (personal, non-commercial)" },
    });
    if (!r.ok) return { src: source.name, error: `HTTP ${r.status}`, ms: Date.now() - started };
    const d = await r.json();
    const ac = d.ac || d.aircraft;
    if (!Array.isArray(ac)) return { src: source.name, error: "respuesta no válida", ms: Date.now() - started };
    return { src: source.name, ac, now: d.now, ms: Date.now() - started };
  } catch (e) {
    return { src: source.name, error: e.name === "AbortError" ? "tiempo agotado" : String(e.message || e), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

// Lanza todas las fuentes a la vez y responde con la primera que traiga datos útiles
function fastest(kind, args) {
  const good = r => r.ac && (kind === "point" || r.ac.length > 0);
  return new Promise(resolve => {
    const all = [];
    let pending = SOURCES.length;
    SOURCES.forEach((s, i) =>
      query(s, kind, args).then(r => {
        all[i] = r;
        if (good(r)) resolve({ win: r, all });
        if (--pending === 0) resolve({ win: null, all });
      })
    );
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405);

    const [kind, ...args] = new URL(request.url).pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (!kind) return json({ ok: true, service: "skyline-proxy", version: VERSION });

    if (kind === "debug") {
      const results = await Promise.all(SOURCES.map(s => query(s, "point", ["40.4", "-3.6", "50"])));
      return json({
        version: VERSION,
        colo: request.cf && request.cf.colo,
        sources: results.map(r => ({ src: r.src, ms: r.ms, ok: !!r.ac, aircraft: r.ac ? r.ac.length : undefined, error: r.error })),
      });
    }

    const valid =
      (["callsign", "hex", "reg"].includes(kind) && args.length === 1 && ID.test(args[0])) ||
      (kind === "point" && args.length === 3 && args.every(x => NUM.test(x)) && +args[2] > 0 && +args[2] <= 250);
    if (!valid) return json({ error: "bad request" }, 400);

    const { win, all } = await fastest(kind, args);
    if (win) return json({ ac: win.ac, src: win.src, now: win.now });
    const empty = all.find(r => r && r.ac);
    if (empty) return json({ ac: [], src: empty.src });
    return json({ error: "no source available", sources: all.map(r => ({ src: r.src, error: r.error, ms: r.ms })) }, 502);
  },
};
