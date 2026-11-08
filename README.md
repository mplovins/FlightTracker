# Skyline · Seguimiento de vuelos en tiempo real

App web de un solo archivo (`index.html`) para seguir vuelos sobre el mapa, sin anuncios ni registro.

## Cómo usarla

1. Abre `index.html` en el navegador (doble clic) o publícala con GitHub Pages.
2. Escribe el código de vuelo: IATA (`IB3166`, `VY1234`, `FR8KQ`), ICAO (`IBE3166`) o la matrícula (`EC-MXV`).
3. Pulsa cualquier avión del mapa (tráfico cercano) para seguirlo.

Atajos: `/` para buscar, `Esc` para cerrar. Puedes compartir un vuelo con el enlace `index.html#IB3166`.

## Configuración inicial (una sola vez)

Los servidores públicos de posiciones ADS-B no permiten consultas directas desde una página web (CORS), así que la app usa un pequeño servidor intermedio gratuito en Cloudflare Workers (`worker.js`).

1. Crea una cuenta gratis en https://dash.cloudflare.com/sign-up
2. Workers & Pages > Create > Start with Hello World > nombre `skyline` > Deploy.
3. Edit code > borra todo y pega el contenido de `worker.js` (la app tiene un botón "Copiar código") > Deploy.
4. Copia la dirección (`https://skyline.tunombre.workers.dev`) y pégala en la app, en Ajustes (icono del engranaje).

También se puede pasar en el enlace: `https://mplovins.github.io/FlightTracker/?proxy=https://skyline.tunombre.workers.dev`

## Qué muestra

- Posición en directo, rumbo y estela del recorrido (actualización cada 5 s).
- Origen, destino, ruta ortodrómica, progreso, distancia recorrida y restante, hora estimada de llegada.
- Altitud, velocidad, velocidad vertical, squawk (avisa de emergencias 7500/7600/7700).
- Avión: modelo, matrícula, operador, país y foto cuando está disponible.
- Favoritos y búsquedas recientes, unidades métricas o aeronáuticas, mapa oscuro, claro, callejero o satélite.

## Fuentes de datos (gratuitas, sin clave)

- Posiciones ADS-B: [adsb.lol](https://adsb.lol), [adsb.fi](https://adsb.fi) y [airplanes.live](https://airplanes.live), consultadas a través del Worker, que pasa a la siguiente fuente si una falla.
- Rutas, aerolíneas y aviones: [adsbdb.com](https://www.adsbdb.com).
- Mapas: Esri (sin clave).

La cobertura depende de la red comunitaria de receptores: sobre océanos o zonas remotas el vuelo puede desaparecer temporalmente.
