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
 */

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
  {
    name: "airplanes.live",
    url: (k, a) => ({
      callsign: `https://api.airplanes.live/v2/callsign/${a[0]}`,
      hex: `https://api.airplanes.live/v2/hex/${a[0]}`,
      reg: `https://api.airplanes.live/v2/reg/${a[0]}`,
      point: `https://api.airplanes.live/v2/point/${a[0]}/${a[1]}/${a[2]}`,
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

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405);

    const [kind, ...args] = new URL(request.url).pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (!kind) return json({ ok: true, service: "skyline-proxy" });

    const valid =
      (["callsign", "hex", "reg"].includes(kind) && args.length === 1 && ID.test(args[0])) ||
      (kind === "point" && args.length === 3 && args.every(x => NUM.test(x)) && +args[2] > 0 && +args[2] <= 250);
    if (!valid) return json({ error: "bad request" }, 400);

    let empty = null;
    for (const s of SOURCES) {
      try {
        const r = await fetch(s.url(kind, args), {
          headers: { Accept: "application/json", "User-Agent": "Skyline flight tracker (personal, non-commercial)" },
        });
        if (!r.ok) continue;
        const d = await r.json();
        const ac = d.ac || d.aircraft;
        if (!Array.isArray(ac)) continue;
        // Para búsquedas concretas, si una fuente no lo ve, probamos la siguiente
        if (!ac.length && kind !== "point") { empty = empty || { ac: [], src: s.name }; continue; }
        return json({ ac, src: s.name, now: d.now });
      } catch (e) {
        // probamos la siguiente fuente
      }
    }
    return empty ? json(empty) : json({ error: "no source available" }, 502);
  },
};
