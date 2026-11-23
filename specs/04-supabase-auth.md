# SPEC 04 — Supabase: base del proyecto y autenticación con email y contraseña

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 03
> **Fecha:** 2026-11-23
> **Objetivo:** Conectar la app al proyecto Supabase `jrhvfquesnwvveiyqksl` con `@supabase/ssr` y sustituir el usuario mock de `localStorage` (`av_user`) por registro, login y logout reales con email y contraseña, con un `username` público guardado en `public.profiles`.

## Por qué existe este spec

Hoy `/auth` no autentica nada: `components/auth-form.tsx` guarda el texto del campo "Usuario" en `localStorage` (`av_user`) y cualquiera puede ser cualquiera. Las puntuaciones reales (SPEC 05) necesitan un usuario verificado al que atribuirlas. Por eso este spec monta primero la base de Supabase (cliente, variables, sesión por cookies, migraciones versionadas y tipos) y el auth. Las puntuaciones siguen en `localStorage` hasta el siguiente spec.

El proyecto remoto está vacío: no hay tablas en `public` ni usuarios en `auth.users`.

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Variables públicas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.example`.
- Clientes de Supabase en `lib/supabase/`: servidor (cookies de `next/headers`) y proxy.
- `proxy.ts` en la raíz, que refresca la sesión en cada petición.
- Migración versionada en `supabase/migrations/` con la tabla `public.profiles`, RLS y el trigger que crea el perfil al registrarse. Se aplica al remoto con el MCP `apply_migration`.
- Tipos generados en `lib/supabase/database.types.ts`.
- Server Actions `signUp`, `signIn` y `signOut` en `app/auth/actions.ts`, con validación en servidor.
- `/auth` funcional:
  - Pestaña INICIAR SESIÓN: correo electrónico y contraseña.
  - Pestaña CREAR CUENTA: usuario, correo electrónico y contraseña.
  - Estados de edición, enviando y error.
- JUGAR COMO INVITADO cierra la sesión, si la hay, y va a `/library`.
- Botones GOOGLE y GITHUB visibles pero deshabilitados, con la etiqueta "PRÓXIMAMENTE".
- `UserProvider` alimentado desde el servidor: el layout lee el usuario y su perfil y se los pasa al provider.
- `useUser()` expone `{ username }` en lugar de `{ name }`. Se adaptan `nav`, `game-player` y `hall-of-fame`.
- Se elimina `av_user` de `lib/storage.ts`.

**Fuera de alcance (para futuros specs):**

- Puntuaciones en Supabase y Salón de la Fama real (SPEC 05). `av_scores` sigue en `localStorage`.
- OAuth con Google y GitHub.
- Confirmación de email, recuperación de contraseña y cambio de email.
- SMTP propio (por ejemplo Resend) para los correos de Auth.
- Edición del perfil (cambiar username, avatar).
- Rutas protegidas. Todo sigue siendo jugable como invitado.
- Stack local de Supabase con Docker (`supabase start`).
- Migrar los `av_user` existentes en navegadores. Se ignoran.
- Rate limit propio. Se confía en el de Supabase Auth.
- Tests automatizados.

## Modelo de datos

### Base de datos

Migración `supabase/migrations/<timestamp>_create_profiles.sql`:

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Los usernames son públicos (aparecerán en rankings).
create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Sin políticas de insert/update/delete: solo el trigger escribe.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Convenciones:

- El username se guarda siempre en mayúsculas, así que `unique` ya lo hace único sin distinguir mayúsculas.
- Si el trigger falla (username repetido o inválido), Postgres revierte el insert en `auth.users`: no quedan usuarios sin perfil.
- `revoke execute on function public.handle_new_user() from anon, authenticated, public` para que no se pueda invocar por RPC.

### Variables de entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=https://jrhvfquesnwvveiyqksl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
SUPABASE_DB_PASSWORD=   # ya existía; solo para tooling, la app no la lee
```

Ninguna clave secreta (`service_role` / `sb_secret_`) entra en la app.

### Tipos de la app

`app/auth/actions.ts`:

```ts
export type SignUpInput = { username: string; email: string; password: string };
export type SignInInput = { email: string; password: string };

export type AuthResult =
  | { status: "success" } // la acción redirige a /library
  | { status: "error"; message: string }; // texto en español, en mayúsculas

export async function signUp(input: SignUpInput): Promise<AuthResult>;
export async function signIn(input: SignInInput): Promise<AuthResult>;
export async function signOut(): Promise<void>; // redirige a /library
```

`components/user-provider.tsx`:

```ts
export type SessionUser = { id: string; username: string };

type UserContextValue = {
  user: SessionUser | null;
};
```

Reglas de validación (servidor, repetidas en el cliente como pista):

- `username`: tras `trim().toUpperCase()`, debe cumplir `^[A-Z0-9_]{3,10}$`. Error: "EL USUARIO DEBE TENER 3–10 CARACTERES: LETRAS, NÚMEROS O _.".
- `email`: formato email, máximo 254 caracteres. Error: "CORREO ELECTRÓNICO NO VÁLIDO.".
- `password`: entre 6 (mínimo por defecto de Supabase) y 72 caracteres. Error: "LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES.".

Mapeo de errores de Supabase a mensajes:

| Caso                                                                                         | Mensaje                                                                               |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Username ya existe (comprobación previa en `profiles` o violación de `unique` en el trigger) | "ESE USUARIO YA ESTÁ EN USO."                                                         |
| Email ya registrado                                                                          | "YA EXISTE UNA CUENTA CON ESE CORREO."                                                |
| Credenciales inválidas en login                                                              | "CORREO O CONTRASEÑA INCORRECTOS."                                                    |
| Rate limit de Supabase                                                                       | "DEMASIADOS INTENTOS. ESPERA UN MOMENTO."                                             |
| Cualquier otro (incluidas variables de entorno ausentes)                                     | "NO SE PUDO CONECTAR CON EL VAULT. INTÉNTALO DE NUEVO." + `console.error` en servidor |

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Antes de escribir código se consultan en `node_modules/next/dist/docs/` las guías de `proxy.md`, `cookies` y Server Actions, y la guía de Supabase SSR para Next.js con el MCP `search_docs`. Antes de tocar `auth-form.tsx` se invoca `/frontend-design` (instrucción de `CLAUDE.md`), con `references/templates/` como fuente de verdad visual.

1. **Configuración manual en el dashboard** (la hace el usuario, el MCP no lo permite): en Authentication → Sign In / Providers → Email, desactivar "Confirm email". Copiar la URL y la publishable key en `.env.local` (también se pueden leer con el MCP `get_project_url` / `get_publishable_keys`).
2. Instalar `@supabase/supabase-js` y `@supabase/ssr`. Añadir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.example`.
3. Crear `supabase/migrations/<timestamp>_create_profiles.sql` con el SQL del modelo de datos y aplicarlo al remoto con el MCP `apply_migration` (mismo nombre). Ejecutar `get_advisors` (security) y corregir lo que reporte.
4. Generar los tipos con el MCP `generate_typescript_types` y guardarlos en `lib/supabase/database.types.ts`.
5. Crear `lib/supabase/server.ts` (`createClient()` async con `createServerClient<Database>` y `cookies()` de `next/headers`) y `lib/supabase/proxy.ts` (`updateSession(request)`, que refresca la sesión con `getClaims()`). Crear `proxy.ts` en la raíz que llama a `updateSession`, con un `matcher` que excluye `_next/static`, `_next/image`, el favicon y las imágenes.
6. Crear `app/auth/actions.ts` (`"use server"`) con `signUp`, `signIn` y `signOut`: validación, comprobación previa de username en `profiles`, llamada a `supabase.auth.signUp({ email, password, options: { data: { username } } })` / `signInWithPassword` / `signOut`, mapeo de errores y `redirect("/library")` en el éxito.
7. Crear en `lib/supabase/` una función `getSessionUser(): Promise<SessionUser | null>`, que lee `getClaims()` y la fila de `profiles`. El layout la llama dentro de un `<Suspense>` (por `cacheComponents`) y pasa el resultado a `<UserProvider user={...}>`. `UserProvider` deja de usar `useSyncExternalStore` y `localStorage`.
8. Adaptar los consumidores a `user.username`:
   - `components/nav.tsx`: el botón muestra `USERNAME ▾` y su clic llama a la acción `signOut`.
   - `components/game-player.tsx`: el nombre por defecto es `user?.username ?? "INVITADO"`.
   - `components/hall-of-fame.tsx`: muestra `user.username`.
   - Borrar de `lib/storage.ts` `USER_KEY`, `StoredUser`, `parseUser`, `getUserSnapshot`, `subscribeUser` y `writeUser`.
9. Reescribir `components/auth-form.tsx`:
   - INICIAR SESIÓN pide correo electrónico y contraseña. CREAR CUENTA pide usuario, correo electrónico y contraseña.
   - Inputs controlados. El envío llama a la acción dentro de `useTransition`. Mientras `isPending`, el botón está deshabilitado y muestra "CONECTANDO…".
   - Un error se muestra bajo el formulario en magenta, con el prefijo `[ERR]`, y los campos conservan lo escrito.
   - JUGAR COMO INVITADO llama a `signOut`.
   - GOOGLE y GITHUB quedan `disabled`, con "PRÓXIMAMENTE".
10. En `app/auth/page.tsx`, si `getSessionUser()` devuelve un usuario, `redirect("/library")`.

## Criterios de aceptación

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La consola del navegador no muestra errores ni avisos de hidratación en `/`, `/library`, `/auth` y `/hall-of-fame`.
- [x] `supabase/migrations/` contiene la migración de `profiles`, y `list_migrations` del MCP la muestra aplicada en el remoto.
- [x] `public.profiles` tiene RLS activado y `get_advisors` (security) no reporta avisos sobre `profiles` ni `handle_new_user`.
- [x] `lib/supabase/database.types.ts` existe y contiene la tabla `profiles`. `createServerClient` la usa como genérico.
- [x] Crear una cuenta con usuario `px_kai`, un email nuevo y una contraseña de 6 o más caracteres redirige a `/library`, y la nav muestra `PX_KAI ▾`.
- [x] Tras crear la cuenta, `auth.users` tiene el usuario y `public.profiles` una fila con `username = 'PX_KAI'` y el mismo `id`.
- [x] Recargar la página mantiene la sesión: la nav sigue mostrando `PX_KAI ▾` sin parpadear a "Iniciar Sesión".
- [x] Crear otra cuenta con usuario `Px_Kai` muestra "ESE USUARIO YA ESTÁ EN USO.", no crea ninguna fila en `auth.users` y conserva lo escrito.
- [x] Crear una cuenta con un email ya registrado muestra "YA EXISTE UNA CUENTA CON ESE CORREO.".
- [x] Los usuarios `ab`, `ABCDEFGHIJK` y `pé` son rechazados con el mensaje de formato de usuario, sin llamar a Supabase.
- [x] Una contraseña de 5 caracteres es rechazada con el mensaje de contraseña.
- [x] Iniciar sesión con email y contraseña correctos redirige a `/library` con la nav mostrando el username.
- [x] Iniciar sesión con una contraseña incorrecta muestra "CORREO O CONTRASEÑA INCORRECTOS." y conserva el email escrito.
- [x] Mientras se envía, el botón dice "CONECTANDO…" y no se puede pulsar dos veces.
- [x] Clicar `USERNAME ▾` en la nav cierra la sesión, redirige a `/library`, y tras recargar la nav muestra "Iniciar Sesión".
- [x] JUGAR COMO INVITADO, con o sin sesión, termina en `/library` sin sesión.
- [x] Entrar en `/auth` con sesión iniciada redirige a `/library`.
- [x] GOOGLE y GITHUB aparecen deshabilitados con "PRÓXIMAMENTE".
- [x] Con sesión iniciada, guardar una puntuación en el reproductor propone el username por defecto, y el Salón de la Fama muestra el récord con ese username.
- [x] Sin sesión, el reproductor propone "INVITADO" y todas las rutas siguen accesibles.
- [x] Con `NEXT_PUBLIC_SUPABASE_URL` vacía, el login muestra el error genérico y el servidor registra el motivo.
- [x] Ningún archivo del repo ni de `.next/static/` contiene una clave `service_role` o `sb_secret_`, y `lib/storage.ts` no contiene `av_user`.

## Decisiones

- **Sí:** este spec cubre base y auth. **No:** incluir las puntuaciones. Serían tres áreas (infra, auth y datos de juego), y las puntuaciones necesitan su propio diseño de RLS y anti-trampas (SPEC 05).
- **Sí:** email y contraseña. **No:** OAuth ni magic link ahora. OAuth requiere apps en Google y GitHub, y el magic link cambia el diseño del prototipo.
- **Sí:** login con email y `username` solo en el registro. **No:** login por username, que necesita una RPC email-por-username y facilita enumerar cuentas.
- **Sí:** confirmación de email desactivada. **No:** confirmación obligatoria. El SMTP por defecto de Supabase permite muy pocos correos por hora y no hay dominio propio. Se reconsidera junto con el SMTP propio.
- **Sí:** el perfil se crea con un trigger en `auth.users`. **No:** un insert desde la Server Action. El trigger es atómico, y la acción podría dejar usuarios sin perfil.
- **Sí:** comprobación previa del username en la acción, además del `unique`. Da un mensaje claro en el caso normal, y el `unique` cubre la carrera.
- **Sí:** username en mayúsculas `^[A-Z0-9_]{3,10}$`. Mantiene la estética de los rankings y el `slice(0, 10)` actual, y simplifica la unicidad.
- **Sí:** migraciones `.sql` versionadas en `supabase/migrations/` y aplicadas con el MCP. **No:** cambios solo en el remoto, porque el esquema no quedaría en el repo. **No:** stack local con Docker, por demasiado setup para un proyecto que hoy tiene una sola tabla.
- **Sí:** Server Actions con `@supabase/ssr`, cookies y `proxy.ts`. **No:** auth solo en el cliente. El servidor debe conocer la sesión (SPEC 05 la necesitará para insertar scores) y así se evita el parpadeo de "sin sesión".
- **Sí:** `getClaims()` para leer la sesión en servidor. **No:** `getSession()`, que no valida el JWT.
- **Sí:** el layout pasa el usuario inicial a `UserProvider`. **No:** que el provider consulte Supabase en el cliente. Las acciones redirigen y el layout se re-renderiza con el usuario nuevo.
- **Sí:** publishable key (`sb_publishable_…`). **No:** anon key legacy. Es la recomendada y se rota de forma independiente.
- **Sí:** `useUser()` expone `username`. **No:** mantener `name`. El nombre del campo describe lo que es, y el cambio se limita a tres componentes.
- **Sí:** el éxito redirige a `/library`. Esto reemplaza la decisión de SPEC 02 de que el login navegue a `/`, que quedaba explícitamente pendiente de un spec de auth.
- **Sí:** ninguna ruta protegida. El prototipo permite jugar como invitado.
- **Sí:** GOOGLE y GITHUB deshabilitados con "PRÓXIMAMENTE". **No:** ocultarlos, para no perder el diseño del prototipo.
- **No:** migrar los `av_user` existentes. No eran cuentas reales.

## Riesgos

| Riesgo                                                                                                                     | Mitigación                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Leer cookies en el layout con `cacheComponents` activo obliga a renderizar dinámicamente todo el árbol o da error de build | `getSessionUser()` va dentro de un `<Suspense>` en el layout, tal y como indica la guía de Next 16. El criterio de `npm run build` lo verifica. |
| "Confirm email" sigue activado en el dashboard: el `signUp` no inicia sesión y el usuario queda en el limbo                | Es el paso 1 del plan. Si `signUp` devuelve usuario sin sesión, la acción devuelve el error genérico y lo registra en el servidor.              |
| El error de username duplicado llega desde el trigger como un genérico "Database error saving new user"                    | Hay comprobación previa en `profiles`. En la carrera, la acción mapea ese error a "ESE USUARIO YA ESTÁ EN USO.".                                |
| Variables de entorno sin configurar en Vercel                                                                              | Error genérico y `console.error`. Un criterio de aceptación lo verifica. El usuario añade las dos variables en Vercel.                          |
| `proxy.ts` corre en todas las rutas y añade latencia                                                                       | El `matcher` excluye estáticos e imágenes. `getClaims()` valida el JWT en local, sin ir a la red, salvo cuando toca refrescar.                  |
| Los tipos generados se desincronizan del esquema                                                                           | Regenerarlos forma parte de cada spec que añada una migración.                                                                                  |
| El SMTP por defecto de Supabase se usa igualmente si alguien reactiva la confirmación                                      | Está fuera de alcance y queda documentado en las decisiones.                                                                                    |

## Lo que **no** está en este spec

- Puntuaciones y Salón de la Fama en Supabase (SPEC 05).
- OAuth con Google y GitHub.
- Confirmación de email, recuperación de contraseña y SMTP propio.
- Edición de perfil.
- Rutas protegidas.
- Stack local de Supabase.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
