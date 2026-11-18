# SPEC 03 — Página Acerca de con formulario de contacto vía Resend

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-18
> **Objetivo:** Añadir la página "Acerca de" en `/about`, portada desde `references/templates/home-about/about.jsx`, con su pestaña en la nav y un formulario de contacto que envía el mensaje por correo con Resend desde una Server Action.

## Por qué existe este spec

Hoy el sitio se publica como export estático en GitHub Pages (`output: "export"` en `next.config.ts` y `.github/workflows/deploy.yml`). Resend necesita una API key secreta, y esa key solo puede usarse en el servidor. Si se llamara desde el navegador, la key quedaría expuesta y Resend rechazaría la petición por CORS. Por eso este spec también saca el proyecto del export estático y lo prepara para desplegarse en Vercel, donde las Server Actions funcionan sin infraestructura adicional.

## Alcance

**Dentro:**

- Página Acerca de en `/about` con todas las secciones de `about.jsx`:
  - Hero: kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", texto de misión y tres tarjetas destacadas con iconos pixel SVG (`HEART`, `BROWSER`, `PLANT`).
  - Divisor animado de 24 píxeles.
  - Sección de contacto: kicker "▸ CONTACTO", título "CONTÁCTANOS", subtítulo, tres tips con LED y el formulario NOMBRE / CORREO ELECTRÓNICO / MENSAJE.
  - Animación `.reveal` al entrar en pantalla con el scroll.
- Envío real del formulario con una Server Action que llama a Resend.
- Estados del formulario: edición, enviando, éxito y error.
- Validación en cliente (campos vacíos → animación `shake`, como en el prototipo) y validación completa en servidor.
- Campo honeypot oculto contra bots.
- Pestaña "Acerca de Nosotros" después de "Salón de la Fama", en la barra de escritorio y en el panel móvil.
- Migración de hosting: quitar el export estático y `basePath`, y borrar el workflow de GitHub Pages.
- `.env.example` versionado con las variables necesarias.
- Mover `useReveal` de `components/home.tsx` a un hook compartido.

**Fuera de alcance (para futuros specs):**

- Dominio propio verificado en Resend y remitente personalizado.
- Rate limit por IP (necesita almacenamiento externo tipo KV).
- Plantilla HTML del correo (React Email).
- Correo de confirmación al usuario que escribe.
- Guardar los mensajes en base de datos o un panel para leerlos.
- CAPTCHA.
- Configuración de la cuenta y el proyecto de Vercel (la hace el usuario a mano).
- Tests automatizados.

## Modelo de datos

Este feature no introduce datos persistentes. Los mensajes solo viajan por correo.

Tipos de la Server Action, en `app/about/actions.ts`:

```ts
export type ContactInput = {
  name: string;    // obligatorio, 1–60 caracteres tras trim
  email: string;   // obligatorio, formato email, máx. 254 caracteres
  message: string; // obligatorio, 10–2000 caracteres tras trim
  website: string; // honeypot: debe llegar vacío
};

export type ContactResult =
  | { status: "success"; name: string }
  | { status: "error"; message: string }; // texto en español para la terminal

export async function sendContactMessage(input: ContactInput): Promise<ContactResult>;
```

Variables de entorno (solo servidor, nunca con prefijo `NEXT_PUBLIC_`):

```bash
RESEND_API_KEY=re_xxxxxxxx         # API key de Resend
CONTACT_TO_EMAIL=tu@email.com      # email dueño de la cuenta Resend
```

Correo enviado:

- `from`: constante `"Arcade Vault <onboarding@resend.dev>"`.
- `to`: `CONTACT_TO_EMAIL`.
- `replyTo`: el email que escribió el usuario.
- `subject`: `[Arcade Vault] Mensaje de <name>`.
- `text`: nombre, email y mensaje en texto plano.

Convenciones:

- Si `website` llega con contenido, la acción devuelve `success` sin enviar nada. El bot no sabe que fue descartado.
- Si falta alguna variable de entorno o Resend devuelve `error`, la acción registra el detalle con `console.error` en el servidor y devuelve un `error` genérico: "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO.".
- Si la validación del servidor falla, el `message` del `error` dice qué campo falla (por ejemplo "EL MENSAJE DEBE TENER ENTRE 10 Y 2000 CARACTERES.").
- La API key nunca llega al bundle del cliente.

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Antes de escribir código se consulta en `node_modules/next/dist/docs/` la guía de Server Actions / `"use server"` y la de `next.config`. Antes de los componentes se invoca `/frontend-design` (instrucción de `CLAUDE.md`), con `about.jsx` como fuente de verdad visual.

1. Migrar el hosting: en `next.config.ts` quitar `output: "export"`, `basePath`, `assetPrefix` y la constante `isProd`. Mantener `trailingSlash: true`, `images.unoptimized` y el resto. Borrar `.github/workflows/deploy.yml`. Comprobar que `npm run build` pasa.
2. Extraer `useReveal` de `components/home.tsx` a `lib/use-reveal.ts` y usarlo desde la home. La home se ve y anima igual.
3. Portar a `app/globals.css` el bloque `ABOUT PAGE` (líneas 1071–1150) de `references/templates/home-about/styles.css`. No duplicar `.field`, `.kicker` ni `.reveal`, que ya existen.
4. Crear `components/about.tsx` (client) con el hero, `HighlightIcon` y el divisor. Crear `app/about/page.tsx` con `metadata.title` "Acerca de · Arcade Vault".
5. Añadir la sección de contacto con el formulario controlado y la validación cliente de campos vacíos con `shake`. Todavía sin envío.
6. Añadir la pestaña "Acerca de Nosotros" en `components/nav.tsx`, después de "Salón de la Fama", en la barra y en el panel móvil, activa solo en `/about`.
7. Instalar `resend`. Crear `.env.example` con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` vacías, y añadir `!.env.example` a `.gitignore`.
8. Crear `app/about/actions.ts` con `"use server"` y `sendContactMessage`: honeypot, validación, lectura de variables de entorno y llamada a `resend.emails.send`.
9. Conectar el formulario: el `onSubmit` llama a la acción dentro de `useTransition`. Mientras `isPending`, el botón está deshabilitado y muestra "ENVIANDO…".
10. Estado éxito: la terminal del prototipo, con "GRACIAS, <NOMBRE>." y el botón ENVIAR OTRO MENSAJE, que vacía el formulario.
11. Estado error: la misma terminal con las líneas `[OK]` hasta la que falla, una línea `[ERR] <message>` en magenta y un botón REINTENTAR que vuelve al formulario con lo escrito intacto.
12. Añadir el honeypot `website`: input fuera de pantalla con `aria-hidden`, `tabIndex={-1}` y `autoComplete="off"`.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `next.config.ts` no contiene `output: "export"`, `basePath` ni `assetPrefix`, y `.github/workflows/deploy.yml` no existe.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/about`.
- [ ] `/about` muestra hero, tres tarjetas destacadas, divisor y sección de contacto. A 1440 px y a 375 px se ve igual que la pantalla Acerca de de `references/templates/home-about/arcade-vault-standalone.html`.
- [ ] La nav muestra, en este orden: Inicio, Biblioteca, Salón de la Fama, Acerca de Nosotros, en escritorio y en el panel móvil.
- [ ] "Acerca de Nosotros" está activo solo en `/about`.
- [ ] La home sigue animando sus secciones `.reveal` tras mover `useReveal`.
- [ ] Enviar con algún campo vacío hace `shake` al formulario y no llama a la acción.
- [ ] Mientras se envía, el botón dice "ENVIANDO…" y no se puede pulsar dos veces.
- [ ] Con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` válidas, enviar el formulario hace llegar un correo a `CONTACT_TO_EMAIL` con el asunto `[Arcade Vault] Mensaje de <nombre>` y reply-to igual al email escrito.
- [ ] Tras un envío correcto se ve la terminal de éxito con el nombre en mayúsculas. ENVIAR OTRO MENSAJE muestra el formulario vacío.
- [ ] Un mensaje de menos de 10 caracteres devuelve la terminal de error con el motivo y no envía correo.
- [ ] Con `RESEND_API_KEY` vacía, el envío muestra la terminal de error genérica y el servidor registra el motivo.
- [ ] REINTENTAR vuelve al formulario con nombre, email y mensaje intactos.
- [ ] Rellenar el honeypot (desde DevTools) muestra éxito y no llega ningún correo.
- [ ] El texto `RESEND_API_KEY` y el valor de la key no aparecen en ningún archivo de `.next/static/`.
- [ ] `.env.example` está versionado y ningún `.env.local` lo está.

## Decisiones

- **Sí:** migrar a Vercel dentro de este spec. Sin servidor, el envío no puede funcionar en producción.
- **No:** mantener GitHub Pages con una función serverless aparte. Serían dos despliegues y habría que configurar CORS.
- **No:** llamar a Resend desde el navegador. Expone la API key y Resend lo bloquea por CORS.
- **Sí:** borrar `deploy.yml`. **No:** dejarlo desactivado. El historial de git lo conserva si hay que volver atrás.
- **Sí:** mantener `trailingSlash: true`. Evita cambiar las URLs y la normalización de `pathname` en la nav sigue valiendo.
- **Sí:** Server Action. **No:** Route Handler `/api/contact`. No hay otro cliente que consuma el endpoint, y la acción mantiene validación y envío juntos.
- **Sí:** llamar a la acción desde `onSubmit` con `useTransition`. **No:** `<form action>` con `useActionState`. React resetea el formulario tras la acción, y REINTENTAR necesita conservar lo escrito.
- **Sí:** SDK `resend` con texto plano. **No:** React Email ni fetch sin SDK. Basta con el texto, y el SDK ya trae tipos.
- **Sí:** `onboarding@resend.dev` como remitente y `CONTACT_TO_EMAIL` como destinatario. Funciona sin verificar dominio. Resend solo entrega al dueño de la cuenta, y en este caso basta.
- **Sí:** validación en servidor más honeypot. **No:** rate limit por IP. En serverless necesita almacenamiento externo, así que va en otro spec si el spam aparece.
- **Sí:** estado de error en la misma terminal con `[ERR]` y REINTENTAR. Mantiene la estética del prototipo, que solo definía el éxito.
- **Sí:** extraer `useReveal` a `lib/use-reveal.ts`. Lo usan la home y la about, y no se duplica.
- **Sí:** SPEC 02 pierde vigencia en su criterio sobre `basePath` `/arcade-vault`. Ese criterio ya no aplica tras este spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La URL pública cambia de `925ctrl.github.io/arcade-vault/` a un dominio de Vercel | Se asume. El usuario configura el proyecto en Vercel. GitHub Pages deja de actualizarse al borrar el workflow. |
| Variables de entorno no configuradas en Vercel | La acción devuelve el error genérico y lo registra en el servidor. Un criterio de aceptación lo verifica. |
| `onboarding@resend.dev` solo entrega al email dueño de la cuenta Resend | `CONTACT_TO_EMAIL` debe ser ese email. Usar otro destinatario requiere el spec de dominio verificado. |
| Spam sin rate limit | El honeypot frena bots simples. El límite de Resend acota el daño. Si aparece abuso, se hace el spec de rate limit. |
| Importar `resend` desde un componente cliente filtra código de servidor | Solo `app/about/actions.ts` (`"use server"`) importa `resend`. El criterio sobre `.next/static/` lo verifica. |

## Lo que **no** está en este spec

- Dominio propio y remitente personalizado.
- Rate limit, CAPTCHA o almacenamiento de mensajes.
- Plantilla HTML y correo de confirmación al usuario.
- Configuración de la cuenta de Vercel.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
