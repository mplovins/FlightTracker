# Skyline · Seguimiento de vuelos en tiempo real

App web (`index.html`) para ver el tráfico aéreo de todo el mundo y seguir vuelos sobre el mapa, sin anuncios.

## Cómo usarla

1. Ábrela en https://mplovins.github.io/FlightTracker/ (en el iPhone o iPad: Compartir > Añadir a pantalla de inicio).
2. Mueve y acerca el mapa: con el zoom alejado ves los aviones de todo el mundo, y cuanto más te acercas, más aviones aparecen (con su indicativo a partir de zoom 9).
3. Toca cualquier avión o aeropuerto, o escribe en el buscador: número de vuelo (`IB3166`, `UX6097`), indicativo (`IBE3166`, `RYR8KQ`), matrícula (`EC-MXV`), código de aeropuerto (`MAD`, `LEMD`) o su nombre (`Barajas`). Mientras escribes aparecen sugerencias.

Atajos: `/` para buscar, `Esc` para cerrar. Puedes compartir un vuelo o un aeropuerto con el enlace `…/FlightTracker/#IB3166` o `…/FlightTracker/#MAD`.

**Vuelos con otro indicativo.** Muchas aerolíneas (Air Europa, Ryanair, Vueling…) vuelan con un indicativo de control aéreo distinto del número de vuelo (por ejemplo UX6097 puede volar como `AEA29LN`). Skyline lo empareja así:

1. Con la clave de AeroDataBox: los horarios dan el indicativo real y el transpondedor del avión, también cuando está en la puerta.
2. Sin clave: busca aviones de la misma aerolínea sobre la ruta del vuelo y confirma que su ruta coincide. Si hay varios, elige el más probable y ofrece los demás en el panel.

## Qué muestra

- **Mapa de tráfico**: todos los aviones en vuelo, coloreados por altitud y repartidos según el zoom, que se mueven de forma continua entre actualizaciones.
- **Mapa de tráfico**: siluetas según el tipo de avión (reactor, gran fuselaje, turbohélice, helicóptero) y emergencias (7500/7600/7700) en rojo con aviso.
- **Vuelo seguido**: posición cada 5 s, trayectoria completa desde el despegue coloreada por altitud, ruta, progreso, distancia recorrida y restante, hora estimada de llegada.
- **Perfil del vuelo**: gráficos de altitud y velocidad con cursor y tabla de datos.
- **Aeropuertos**: en el mapa según el zoom, con panel propio (aviones en la zona y paneles de salidas y llegadas de las próximas 6 horas, con hora, retraso, puerta, cinta y estado).
- **Capas y filtros**: radar de lluvia, aeropuertos, y filtros por aerolínea, tipo de avión, altitud y aviones en tierra.
- **Horarios**: horas programadas, estimadas y reales de salida y llegada, despegue y aterrizaje, retraso, terminal, puerta, mostrador de facturación, cinta de equipaje y estado (embarcando, puerta cerrada, retrasado, cancelado, desviado…).
- **Datos en vivo**: altitud, velocidad, velocidad vertical, rumbo y squawk (avisa de emergencias 7500/7600/7700).
- **Avión y aerolínea**: modelo, variante, matrícula, operador, país y foto cuando existe.
- Favoritos, búsquedas recientes, unidades métricas o aeronáuticas y mapa oscuro, claro, callejero o satélite.

## Configuración (una sola vez, en Ajustes)

**1. Servidor de datos (Google Apps Script, gratis).** Los servidores ADS-B no permiten consultas directas desde una web, así que la app usa un pequeño servidor tuyo (`google-apps-script.js`). Va en Google porque en España los operadores bloquean direcciones de Cloudflare durante los partidos de LaLiga.

- Primera vez: Ajustes > Copiar código > script.google.com > New project > pegar > Deploy > New deployment > Web app > Who has access: Anyone > Deploy > autorizar > copiar la Web app URL (`/exec`) en Ajustes.
- Actualizar a una versión nueva: Copiar código > en el proyecto, borrar `Code.gs` y crear un archivo `Code` nuevo con el código > Deploy > Manage deployments > lápiz > Version: New version > Deploy. La dirección no cambia.

La versión 4 del servidor añade el tráfico mundial y la 5 la trayectoria completa desde el despegue. Si tienes una anterior, la app lo avisa en Ajustes.

**2. Horarios, puertas y retrasos (AeroDataBox, opcional y gratis).** Crea una cuenta en [RapidAPI](https://rapidapi.com/aedbx-aedbx/api/aerodatabox/pricing), suscríbete al plan Basic (0 $, 400 unidades al mes, unas 200 consultas de vuelo) y pega tu clave `X-RapidAPI-Key` en Ajustes. La clave se guarda solo en tu dispositivo y la app reutiliza cada consulta 10 minutos.

**3. Tráfico mundial con más cupo (OpenSky, opcional).** Sin cuenta funciona con un cupo diario limitado. Con una cuenta gratuita de OpenSky, añade `OPENSKY_CLIENT_ID` y `OPENSKY_CLIENT_SECRET` en Project Settings > Script Properties de tu proyecto de Google.

**4. Otros dispositivos.** Ajustes > Enviar configuración genera un enlace que deja el iPhone configurado igual (va en el `#` de la dirección, no pasa por ningún servidor).

`worker.js` (Cloudflare Workers) se mantiene como servidor de reserva para las posiciones.

## Fuentes de datos

- Tráfico mundial: [OpenSky Network](https://opensky-network.org).
- Tráfico detallado por zonas y vuelo seguido: [adsb.lol](https://adsb.lol) (ODbL) y [adsb.fi](https://adsb.fi).
- Rutas, aerolíneas y aviones: [adsbdb.com](https://www.adsbdb.com).
- Horarios, puertas y estado: [AeroDataBox](https://aerodatabox.com).
- Aeropuertos: [OurAirports](https://ourairports.com) (dominio público, `airports.json`).
- Radar de lluvia: [RainViewer](https://www.rainviewer.com).
- Mapas: Esri.

La cobertura depende de las redes comunitarias de receptores: sobre océanos o zonas remotas un vuelo puede desaparecer temporalmente, y los horarios en tiempo real dependen de cada aeropuerto.
