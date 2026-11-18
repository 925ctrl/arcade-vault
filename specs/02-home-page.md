# SPEC 02 — Página Inicio: landing del prototipo y pestaña en la nav

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-18
> **Objetivo:** Añadir una página Inicio en `/` portada desde `references/templates/home-about/home.jsx`, con su pestaña "Inicio" antes de "Biblioteca" en la nav, y mover la Biblioteca a `/library`.

## Por qué existe este spec

El prototipo nuevo (`references/templates/home-about/`) añade una landing que sirve de entrada a la plataforma. En el prototipo, el logo y la pestaña "Inicio" llevan a esa landing, y la Biblioteca es una pantalla más. Para respetarlo, la Biblioteca deja `/` y pasa a `/library`, y eso obliga a actualizar todos los enlaces que hoy apuntan a `/` con la intención de "volver a la biblioteca".

## Alcance

**Dentro:**

- Página Inicio en `/` con todas las secciones de `home.jsx`:
  - Hero con siluetas pixel flotantes, eyebrow "▸ INSERTA UNA MONEDA_", título en tres líneas, subtítulo y CTAs EXPLORAR JUEGOS / CREAR CUENTA.
  - `// 01 ¿POR QUÉ ARCADE VAULT?`: cuatro feature cards con iconos pixel SVG.
  - `// 02 JUEGOS DISPONIBLES AHORA`: rail con los 6 primeros juegos de `GAMES` y el botón VER TODOS LOS JUEGOS.
  - Franja de estadísticas.
  - `// 03 ACTIVIDAD EN VIVO`: ticker de últimas puntuaciones y top jugadores de hoy, con el enlace VER SALÓN.
  - `// 04 PRECIOS`: tarjeta de plan único y FAQ.
  - CTA final "¿LISTO PARA JUGAR?".
  - Animación `.reveal` al entrar en pantalla con el scroll.
- Biblioteca movida de `/` a `/library`, sin cambios visuales ni funcionales.
- Pestaña "Inicio" antes de "Biblioteca" en la barra de escritorio y en el panel móvil.
- Logo de la nav apuntando a `/` (Inicio).
- Actualizar los enlaces de "volver a la biblioteca" para que apunten a `/library`.
- Portar a `app/globals.css` los estilos de la home, la actividad y los precios desde `references/templates/home-about/styles.css`.
- Ajustar los textos del prototipo que no coinciden con el catálogo real.

**Fuera de alcance (para futuros specs):**

- Pestaña y página "Acerca de" (`about.jsx`).
- Datos reales en "Actividad en vivo" (mezclar `av_scores` o un backend).
- Estadísticas reales de partidas o jugadores.
- Contador de créditos funcional.
- Variantes de tema y gamepad de `styles.css` (`/* ===== Theme variants ===== */`, `/* ===== GAMEPAD ===== */`).
- Redirecciones de la antigua URL de biblioteca (no hacen falta: la biblioteca nunca tuvo una ruta propia distinta de `/`).
- Tests automatizados.

## Modelo de datos

Este feature no introduce estructuras de datos persistentes. Reutiliza `GAMES` de `lib/games.ts` (SPEC 01).

Los datos mock de la home viven como constantes locales en el componente, con nombres en inglés:

```ts
type Feature = { icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET"; title: string; desc: string; color: GameColor };
type Stat = { value: string; unit: string; sub: string };
type RecentScore = { player: string; game: string; score: number; ago: string; color: GameColor };
type TopPlayer = { rank: number; player: string; score: number };
```

Convenciones:

- `RecentScore` y `TopPlayer` se copian literalmente de `home.jsx` (NEONFOX, PX_KAI, Z3R0COOL…). Todos los juegos que nombra el ticker existen en `GAMES`.
- El primer stat muestra `` `${GAMES.length}+` `` en lugar de "12+".
- La descripción de la feature JUEGOS CLÁSICOS cita juegos del catálogo (por ejemplo "Bloque Buster, Caída, Serpentina y muchos más") en lugar de Arkanoid, Tetris y Snake.
- Las mini cards usan `game.category` (el prototipo usa `game.cat`) y enlazan a `/games/<id>`.
- Los números se formatean con `toLocaleString("es-ES")`, como en SPEC 01.

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Antes de escribir componentes se consulta la guía correspondiente en `node_modules/next/dist/docs/` y se invoca `/frontend-design` (instrucción de `CLAUDE.md`), con `home.jsx` como fuente de verdad visual.

1. Mover la biblioteca: crear `app/library/page.tsx` con el contenido actual de `app/page.tsx` (`<Library />`, título "Biblioteca · Arcade Vault"). Dejar `app/page.tsx` renderizando temporalmente la biblioteca para no romper `/`.
2. Actualizar la navegación a la biblioteca: en `components/nav.tsx` el enlace "Biblioteca" apunta a `/library` y queda activo en `/library` y `/games/*`. Cambiar a `/library` los enlaces de `components/game-player.tsx` (VOLVER AL VAULT), `components/hall-of-fame.tsx` (VOLVER A LA BIBLIOTECA), `app/games/[id]/page.tsx` (VOLVER AL VAULT) y `app/not-found.tsx`.
3. Portar a `app/globals.css` los bloques `HOME PAGE` (líneas 930–1070), `ACTIVITY` (1621–1671) y `PRICING` (1672–1734) de `references/templates/home-about/styles.css`. Comprobar que `.hero-eyebrow .blink` y las keyframes que usan esos bloques quedan definidos.
4. Crear `components/home.tsx` (client, por `useReveal` con `IntersectionObserver`) con el hero y las siluetas flotantes (`FloatingSilhouettes`). Sustituir `app/page.tsx` por la página Inicio con `metadata.title` "Inicio · Arcade Vault".
5. Añadir las secciones `// 01` (feature cards con `FeatureIcon`) y `// 02` (rail de mini cards con `next/link`).
6. Añadir la franja de estadísticas y la sección `// 03` (ticker y top jugadores; VER SALÓN → `/hall-of-fame`).
7. Añadir la sección `// 04` (precios y FAQ) y el CTA final. Destinos de los botones: EXPLORAR JUEGOS, VER TODOS LOS JUEGOS e INSERTAR MONEDA → `/library`; CREAR CUENTA y EMPEZAR GRATIS → `/auth`.
8. Añadir la pestaña "Inicio" antes de "Biblioteca" en la barra y en el panel móvil de `components/nav.tsx`, activa solo en `/`. El logo apunta a `/`.
9. Pasar los `style={{}}` inline de `home.jsx` a utilidades Tailwind con los tokens de `@theme`, salvo los `transitionDelay` y anchos calculados por índice.

## Criterios de aceptación

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La consola del navegador no muestra errores ni avisos de hidratación en `/` ni en `/library`.
- [x] `/` muestra la página Inicio con las siete secciones (hero, 01, 02, stats, 03, 04, CTA final). A 1440 px y a 375 px se ve igual que la pantalla Inicio de `references/templates/home-about/arcade-vault-standalone.html`.
- [x] Las secciones con `.reveal` aparecen ocultas y se animan a visibles al entrar en pantalla con el scroll.
- [x] La nav muestra, en este orden: Inicio, Biblioteca, Salón de la Fama, tanto en escritorio como en el panel móvil.
- [x] "Inicio" está activo solo en `/`. "Biblioteca" está activo en `/library`, `/games/<id>` y `/games/<id>/play`. Ninguno de los dos está activo en `/hall-of-fame` ni en `/auth`.
- [x] Clicar el logo navega a `/`.
- [x] `/library` muestra la biblioteca con el mismo buscador, chips y tarjetas que antes tenía `/`.
- [x] EXPLORAR JUEGOS, VER TODOS LOS JUEGOS e INSERTAR MONEDA navegan a `/library`. CREAR CUENTA y EMPEZAR GRATIS navegan a `/auth`. VER SALÓN navega a `/hall-of-fame`.
- [x] El rail muestra exactamente 6 mini cards (los 6 primeros de `GAMES`) y clicar una navega a `/games/<id>`.
- [x] El primer stat muestra "8+" (igual a `GAMES.length`) y ningún texto de la home menciona Arkanoid, Tetris ni Snake.
- [x] VOLVER AL VAULT (detalle y modal del reproductor), VOLVER A LA BIBLIOTECA (salón) y el enlace de la 404 navegan a `/library`.
- [x] Con el build de producción (`basePath` `/arcade-vault`), `/arcade-vault/` muestra Inicio y `/arcade-vault/library/` muestra la biblioteca.

## Decisiones

- **Sí:** Inicio en `/` y Biblioteca en `/library`. La landing es la entrada natural y el logo lleva a ella, como en el prototipo.
- **No:** Inicio en `/home` dejando la biblioteca en `/`. Sería un cambio menor, pero la landing no sería la página de entrada.
- **Sí:** portar todas las secciones de `home.jsx`, incluida PRECIOS. El usuario quiere la página con los diseños del prototipo.
- **Sí:** "Actividad en vivo" con el mock literal del prototipo. Es coherente con los rankings mock de SPEC 01.
- **No:** mezclar `av_scores` en el ticker. Necesita lógica cliente y pertenece al spec de puntuaciones reales.
- **Sí:** ajustar los textos que contradicen el catálogo (`GAMES.length` en el stat, juegos reales en la feature). Evita prometer juegos que no existen.
- **Sí:** CREAR CUENTA y EMPEZAR GRATIS van a `/auth`, que ya cubre las dos pestañas (SPEC 01).
- **Sí:** el login (`components/auth-form.tsx`) sigue navegando a `/`, que ahora es Inicio. **No:** cambiarlo a `/library`. Lo ajusta un spec de auth si hace falta.
- **Sí:** estilos portados a `app/globals.css` como en SPEC 01. **No:** CSS Modules ni reescritura completa en Tailwind.
- **No:** pestaña "Acerca de" ni las variantes de tema y gamepad del nuevo `styles.css`. El usuario pidió solo Inicio.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Enlaces que siguen apuntando a `/` pensando en la biblioteca | El paso 2 enumera todos los `href="/"` actuales (encontrados con `grep`). El criterio de aceptación de los enlaces de vuelta lo verifica. |
| `.reveal` deja secciones invisibles si el observer no llega a ejecutarse (SSR o JS desactivado) | Se acepta igual que en el prototipo. El hook corre en `useEffect` y desconecta el observer al desmontar. |
| Estilos del nuevo `styles.css` que pisan los ya portados en `globals.css` | Solo se copian los bloques HOME, ACTIVITY y PRICING, no el archivo completo. |
| `min-height: calc(100vh - 60px)` del hero choca con la altura real de la nav | Verificar en el criterio visual a 1440 px y 375 px. Ajustar al alto real de `.av-nav` si difiere. |

## Lo que **no** está en este spec

- Página y pestaña "Acerca de".
- Actividad, estadísticas o rankings con datos reales.
- Créditos funcionales.
- Temas y gamepad del nuevo prototipo.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
