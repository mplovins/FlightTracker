# Skyline · Seguimiento de vuelos en tiempo real

App web de un solo archivo (`index.html`) para seguir vuelos sobre el mapa, sin anuncios ni registro.

## Cómo usarla

1. Abre `index.html` en el navegador (doble clic) o publícala con GitHub Pages.
2. Escribe el código de vuelo: IATA (`IB3166`, `VY1234`, `FR8KQ`), ICAO (`IBE3166`) o la matrícula (`EC-MXV`).
3. Pulsa cualquier avión del mapa (tráfico cercano) para seguirlo.

Atajos: `/` para buscar, `Esc` para cerrar. Puedes compartir un vuelo con el enlace `index.html#IB3166`.

## Qué muestra

- Posición en directo, rumbo y estela del recorrido (actualización cada 5 s).
- Origen, destino, ruta ortodrómica, progreso, distancia recorrida y restante, hora estimada de llegada.
- Altitud, velocidad, velocidad vertical, squawk (avisa de emergencias 7500/7600/7700).
- Avión: modelo, matrícula, operador, país y foto cuando está disponible.
- Favoritos y búsquedas recientes, unidades métricas o aeronáuticas, mapa oscuro, claro, callejero o satélite.

## Fuentes de datos (gratuitas, sin clave)

- Posiciones ADS-B: [airplanes.live](https://airplanes.live), [adsb.lol](https://adsb.lol) y [adsb.fi](https://adsb.fi) (con conmutación automática si uno falla).
- Rutas, aerolíneas y aviones: [adsbdb.com](https://www.adsbdb.com).
- Mapas: CARTO / OpenStreetMap y Esri.

La cobertura depende de la red comunitaria de receptores: sobre océanos o zonas remotas el vuelo puede desaparecer temporalmente.
