# SPEC 01 — MVP visual: pantallas del prototipo en Next.js

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-11-12
> **Objetivo:** Portar a Next.js App Router las cinco pantallas del prototipo de `references/templates/` (biblioteca, detalle, reproductor, auth y salón de la fama) con navegación real y persistencia mock en localStorage, sin implementar ningún juego.

## Por qué existe este spec

`app/` sigue siendo el scaffold de `create-next-app`. El diseño ya existe como prototipo standalone (React 18 UMD + Babel en el navegador) y sus estilos ya están portados en `app/globals.css`. Este spec convierte ese prototipo en la base real de la aplicación, para que los juegos y el backend lleguen después sobre pantallas ya hechas.

## Alcance

**Dentro:**

- Navbar (escritorio y panel móvil) y footer comunes en `app/layout.tsx`.
- Biblioteca en `/`: hero, buscador por nombre, chips de categoría, grid de tarjetas con efecto tilt y estado "NO HAY RESULTADOS".
- Detalle en `/games/[id]`: portada, tags, descripción, franja de estadísticas, botones JUGAR AHORA / VOLVER AL VAULT y tabla de mejores puntuaciones mock.
- Reproductor en `/games/[id]/play`: HUD, pantalla CRT con la arena CSS animada, puntuación simulada que sube sola, subida de nivel, PAUSA/REANUDAR, FIN, SALIR y modal "FIN DEL JUEGO" con guardar puntuación y jugar de nuevo.
- Auth en `/auth`: pestañas INICIAR SESIÓN / CREAR CUENTA, formulario sin validación, JUGAR COMO INVITADO y botones sociales decorativos.
- Salón de la fama en `/hall-of-fame`: pestañas por juego, podio, tabla de ranking mock y fila "TU MEJOR MARCA" calculada desde `av_scores`.
- Página 404 con estética neón (`app/not-found.tsx`) para ids de juego inexistentes y rutas desconocidas.
- Persistencia mock: usuario en `localStorage["av_user"]` y puntuaciones en `localStorage["av_scores"]`.
- Metadata por página (`title`) en español.

**Fuera de alcance (para futuros specs):**

- Cualquier juego jugable (canvas, input de teclado o táctil, lógica de juego).
- Backend, base de datos, API routes o Server Actions.
- Autenticación real, OAuth con Google/GitHub y validación del formulario.
- Insertar las puntuaciones guardadas en los rankings mock o reordenarlos.
- Menú desplegable de usuario y página de cuenta.
- Contador de créditos funcional (se muestra fijo "CRÉDITOS · 03").
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

Datos estáticos en `lib/games.ts`, copiados de `references/templates/data.jsx` con nombres en inglés:

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;          // "bloque-buster", "caida", ... (los 8 del prototipo)
  title: string;       // "BLOQUE BUSTER"
  short: string;       // descripción corta de la tarjeta
  long: string;        // descripción larga del detalle
  category: GameCategory;
  cover: string;       // clase CSS: "cover-bricks", "cover-tetro", ...
  color: GameColor;    // color del botón JUGAR
  best: number;        // mejor puntuación global mock
  plays: string;       // "12.4K"
};

export const GAMES: Game[];
export const CATEGORIES = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
export function getGame(id: string): Game | undefined;

export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/2026"
export function seededScores(seed: number, count?: number): ScoreRow[]; // misma fórmula que el prototipo
```

Persistencia mock en `lib/storage.ts`:

```ts
// localStorage["av_user"]  → JSON de StoredUser, o ausente si no hay sesión
export type StoredUser = { name: string }; // mayúsculas, máx. 10 caracteres

// localStorage["av_scores"] → JSON de SavedScore[] (se añade al final, nunca se borra)
export type SavedScore = { game: string; score: number; name: string; at: number }; // at = Date.now()
```

Convenciones:

- Las semillas de los rankings son las del prototipo: detalle `id.length * 17 + 3` con 10 filas, salón `id.length * 23 + 7` con 12 filas.
- Los números se formatean siempre con `toLocaleString("es-ES")`.
- "Tu mejor marca" = máximo `score` de `av_scores` con `game === id` (de cualquier nombre). Su rango = número de filas mock con puntuación mayor + 1. Su fecha = `at` formateado `DD/MM/AAAA`.
- Toda lectura de localStorage va envuelta en `try/catch`; un JSON corrupto se trata como ausente.

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Antes de escribir componentes se consulta la guía correspondiente en `node_modules/next/dist/docs/` y se invoca `/frontend-design` (instrucción de `CLAUDE.md`), respetando el prototipo como fuente de verdad visual.

1. Crear `lib/games.ts` con los tipos, `GAMES`, `CATEGORIES`, `getGame` y `seededScores`.
2. Crear `lib/storage.ts` con lectura/escritura segura de `av_user` y `av_scores`.
3. Crear `components/user-provider.tsx` (client): contexto con `user`, `signIn(user)`, `signOut()`, sincronizado con `av_user` sin errores de hidratación (el primer render del servidor y del cliente es "sin sesión").
4. Crear `components/nav.tsx` (client, con `next/link` y `usePathname` para el enlace activo) y `components/footer.tsx`. Integrarlos con el provider en `app/layout.tsx` dentro de `<main className="av-main">`.
5. Sustituir `app/page.tsx` por la biblioteca: `components/game-card.tsx` (tilt con ref) y `components/library.tsx` (client, buscador y chips). Las tarjetas enlazan a `/games/[id]`.
6. Crear `app/not-found.tsx` con la estética neón y enlace a `/`.
7. Crear `app/games/[id]/page.tsx` (server) con `generateStaticParams` desde `GAMES`, `notFound()` si el id no existe y `components/leaderboard.tsx`.
8. Crear `app/games/[id]/play/page.tsx` (server, valida id y llama a `notFound()`) que renderiza `components/game-player.tsx` (client) con HUD, CRT, arena, pausa y simulación de puntuación.
9. Añadir a `game-player.tsx` el modal "FIN DEL JUEGO": input de iniciales (mayúsculas, máx. 10, por defecto el nombre del usuario o "INVITADO"), guardar en `av_scores`, mensaje "▸ PUNTUACIÓN GUARDADA_", JUGAR DE NUEVO y VOLVER AL VAULT.
10. Crear `app/auth/page.tsx` con `components/auth-form.tsx` (client): pestañas, campo correo solo en CREAR CUENTA, envío que guarda `{ name }` (vacío → "PLAYER1") y navega a `/`, JUGAR COMO INVITADO que cierra sesión y navega a `/`.
11. Crear `app/hall-of-fame/page.tsx` con `components/hall-of-fame.tsx` (client): pestañas por juego en estado local, podio, tabla animada y fila "TU MEJOR MARCA" desde `av_scores` solo si hay sesión y existe marca para ese juego.
12. Añadir `metadata.title` a cada página y pasar los `style={{}}` inline restantes del prototipo a utilidades Tailwind con los tokens de `@theme`.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en ninguna ruta.
- [ ] `/`, `/games/caida`, `/games/caida/play`, `/auth` y `/hall-of-fame` se ven igual que las pantallas equivalentes de `references/templates/Arcade Vault.html` a 1440 px y a 375 px.
- [ ] En `/`, escribir "ser" deja solo SERPENTINA; elegir el chip SHOOTER deja solo INVASORES y ROCAS; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Clicar una tarjeta o su botón JUGAR navega a `/games/<id>`.
- [ ] El enlace "Biblioteca" de la nav aparece activo en `/`, `/games/<id>` y `/games/<id>/play`; "Salón de la Fama" aparece activo en `/hall-of-fame`.
- [ ] Bajo 840 px se oculta la barra de enlaces, aparece el botón ≡ y el panel lateral abre y cierra (también al pulsar el fondo).
- [ ] `/games/no-existe` y `/games/no-existe/play` muestran la página 404 neón con enlace a la biblioteca.
- [ ] En el reproductor la puntuación sube sola; PAUSA la detiene y muestra "EN PAUSA"; REANUDAR la continúa.
- [ ] FIN abre el modal con la puntuación final; GUARDAR PUNTUACIÓN añade una entrada `{ game, score, name, at }` a `localStorage["av_scores"]` y muestra "▸ PUNTUACIÓN GUARDADA_".
- [ ] JUGAR DE NUEVO reinicia puntuación a 0, vidas a 3 y nivel a 01; SALIR vuelve a `/games/<id>`.
- [ ] En `/auth`, enviar con usuario "neonfox" guarda `{"name":"NEONFOX"}` en `av_user`, navega a `/` y la nav muestra "NEONFOX ▾".
- [ ] Clicar "NEONFOX ▾" borra `av_user` y la nav vuelve a mostrar "Iniciar Sesión".
- [ ] La sesión se conserva al recargar la página.
- [ ] En `/hall-of-fame` cada pestaña cambia podio y tabla; la fila "TU MEJOR MARCA" aparece solo con sesión iniciada y una puntuación guardada para ese juego, y muestra la mayor de ellas.
- [ ] Con `av_user` o `av_scores` corruptos en localStorage la app carga sin errores y actúa como si no existieran.
- [ ] `app/page.tsx` ya no contiene nada del starter de Next.js.

## Decisiones

- **Sí:** rutas reales del App Router (`/`, `/games/[id]`, `/games/[id]/play`, `/auth`, `/hall-of-fame`). URLs compartibles, botón atrás nativo y prefetch.
- **No:** routing por hash como el prototipo. Pierde las ventajas de Next sin aportar nada.
- **Sí:** nombres de rutas, archivos e identificadores en inglés; textos de UI en español (convención de `CLAUDE.md`).
- **Sí:** localStorage mock con las claves del prototipo (`av_user`, `av_scores`). Permite demostrar el flujo completo sin backend.
- **No:** persistir solo el usuario o nada. Dejaría el modal de guardar y "tu mejor marca" vacíos de sentido.
- **Sí:** simulación del prototipo en el reproductor (puntuación automática, pausa, fin, modal). Es la única forma de enseñar el HUD y el modal sin un juego.
- **Sí:** reutilizar las clases ya portadas en `app/globals.css`; Tailwind solo para sustituir los estilos inline. Menor riesgo de diferencias visuales.
- **No:** reescribir todo en Tailwind ni pasar a CSS Modules. Más trabajo sin beneficio visible en el MVP.
- **Sí:** rankings mock con `seededScores` y la fila "tu mejor marca" calculada desde `av_scores`. Datos deterministas y una conexión real con lo que guarda el usuario.
- **No:** mezclar `av_scores` en los rankings ni reordenarlos. Pertenece al spec de puntuaciones reales.
- **Sí:** 404 con estilo neón mediante `notFound()`. Un id inválido es un error visible, no una redirección silenciosa.
- **Sí:** formulario de auth sin validación, como el prototipo. La autenticación real irá en su propio spec.
- **Sí:** clicar el nombre de usuario cierra sesión, como el prototipo. **No:** desplegable de usuario, es un componente nuevo fuera del prototipo.
- **Sí:** estado de la pestaña del salón de la fama en memoria del componente, como el prototipo. **No:** reflejarlo en la URL en este spec.
- **Sí:** el layout mantiene `.av-bg`, `.av-noise` y `#root` ya existentes en `app/layout.tsx`.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Errores de hidratación al leer localStorage en el primer render | El provider arranca siempre "sin sesión" y lee localStorage tras montar; ningún server component accede a `window`. |
| `cacheComponents` exige delimitar con `<Suspense>` lo que use APIs dinámicas | Las páginas son estáticas (`generateStaticParams`); el estado del usuario vive solo en client components. Revisar la guía en `node_modules/next/dist/docs/` antes del paso 4. |
| Diferencias de `toLocaleString("es-ES")` entre Node y navegador | Usar siempre el locale explícito; verificar en el criterio de "sin avisos de hidratación". |
| `seededScores` usa una fórmula pseudoaleatoria que cambiaría los rankings si se toca | Copiarla literalmente del prototipo, con las mismas semillas. |
| JSON corrupto en localStorage | Todas las lecturas en `try/catch`, cubierto por un criterio de aceptación. |

## Lo que **no** está en este spec

- Juegos jugables.
- Backend, API o base de datos.
- Autenticación real, OAuth y validación de formularios.
- Rankings que incluyan las puntuaciones guardadas.
- Menú desplegable de usuario, página de cuenta y créditos funcionales.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
