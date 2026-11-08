# Skyline · Seguimiento de vuelos en tiempo real

App web de un solo archivo (`index.html`) para seguir vuelos sobre el mapa, sin anuncios ni registro.

## Cómo usarla

1. Abre `index.html` en el navegador (doble clic) o publícala con GitHub Pages.
2. Escribe el código de vuelo: IATA (`IB3166`, `VY1234`, `FR8KQ`), ICAO (`IBE3166`) o la matrícula (`EC-MXV`).
3. Pulsa cualquier avión del mapa (tráfico cercano) para seguirlo.

Atajos: `/` para buscar, `Esc` para cerrar. Puedes compartir un vuelo con el enlace `index.html#IB3166`.

## Configuración inicial (una sola vez)

Los servidores públicos de posiciones ADS-B no permiten consultas directas desde una página web (CORS), así que la app usa un pequeño servidor intermedio. Se monta gratis en **Google Apps Script** (`google-apps-script.js`), porque en España los operadores bloquean direcciones de Cloudflare durante los partidos de LaLiga y Google no se ve afectado.

1. En la app, abre Ajustes (engranaje) y pulsa **Copiar código**.
2. Entra en https://script.google.com, pulsa **Nuevo proyecto**, borra las 3 líneas que trae y pega el código. Guarda.
3. **Implementar** > **Nueva implementación** > tipo **Aplicación web** > Quién tiene acceso: **Cualquier usuario** > **Implementar**.
4. Autoriza el acceso (si aparece "Google no ha verificado esta aplicación": Configuración avanzada > Ir a … (no seguro) > Permitir).
5. Copia la **URL de la aplicación web** (termina en `/exec`) y pégala en Ajustes.

Para no tener que configurarlo en cada dispositivo, pon esa URL en `GOOGLE_SERVER_DEFAULT` dentro de `index.html`.

`worker.js` (Cloudflare Workers) se mantiene como servidor de reserva: la app lo usa si el de Google falla.

## Qué muestra

- Posición en directo, rumbo y estela del recorrido (actualización cada 5 s).
- Origen, destino, ruta ortodrómica, progreso, distancia recorrida y restante, hora estimada de llegada.
- Altitud, velocidad, velocidad vertical, squawk (avisa de emergencias 7500/7600/7700).
- Avión: modelo, matrícula, operador, país y foto cuando está disponible.
- Favoritos y búsquedas recientes, unidades métricas o aeronáuticas, mapa oscuro, claro, callejero o satélite.

## Fuentes de datos (gratuitas, sin clave)

- Posiciones ADS-B: [adsb.lol](https://adsb.lol) y [adsb.fi](https://adsb.fi), consultadas a través del servidor intermedio, que pasa a la siguiente fuente si una falla.
- Rutas, aerolíneas y aviones: [adsbdb.com](https://www.adsbdb.com).
- Mapas: Esri (sin clave).

La cobertura depende de la red comunitaria de receptores: sobre océanos o zonas remotas el vuelo puede desaparecer temporalmente.
