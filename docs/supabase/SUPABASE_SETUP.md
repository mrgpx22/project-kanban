# Supabase Setup (Kanban Escalado por Proyectos)

## Modelo nuevo
- `kanban_projects`: proyectos de la empresa.
- `kanban_project_members`: usuarios participantes por proyecto + permiso (`viewer`, `editor`, `manager`).
- `kanban_users`: rol de aplicacion (`user` o `jefe`).
- `kanban_tasks`: tareas con `project_id`.
- `kanban_task_links`: dependencias + rango de fechas, tambien con `project_id`.
- `kanban_quick_notes`: notas rapidas por proyecto (vista Notas).
- `n8n_delay_tasks`: tarjetas de retrasos generadas por n8n para el panel lateral del Kanban.

## Acceso por rol
- Rol real en DB: se guarda en `kanban_users.role`.
- En UI:
  - `user`: solo ve proyectos donde participa.
  - `jefe`: ve todos los proyectos.
- El modo ya no se elige manualmente en MAIN: se resuelve automaticamente por rol.

## Permisos por proyecto
- `viewer`: solo lectura (no puede crear/editar/borrar tareas o dependencias).
- `editor`: puede editar tareas/dependencias del proyecto.
- `manager`: igual que `editor`, pensado para gestion avanzada por proyecto.
- Gestion de personas (anadir, quitar, mover, cambiar permiso) se hace desde MAIN con rol `jefe`.
- Al crear un proyecto, todos los usuarios con rol `jefe` se agregan automaticamente como `manager`.

## Directorio de personas (MAIN)
- Hay un panel "Directorio personas" (solo `jefe`) para gestionar fichas con campos:
  - `Nombre`
  - `Apellido1`
  - `Apellido2`
  - `Cargo`
  - `Departamento`
- Estas fichas se guardan en `kanban_users` (columnas `first_name`, `last_name_1`, `last_name_2`, `job_title`, `department`).

## 1) URL y claves
1. Abre tu proyecto en Supabase.
2. Ve a `Project Settings` -> `API`.
3. Copia:
   - `Project URL`
   - `anon public` key
   - `service_role` key
4. Pegalos en `.env`:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

El servidor genera automaticamente `/assets/js/supabase-config.js` para el navegador usando esas variables.

## 2) Activar login por email/password
1. Ve a `Authentication` -> `Providers`.
2. Activa `Email`.
3. (Opcional) desactiva `Confirm email` para pruebas locales mas rapidas.
4. Guarda cambios.

## 2.1) Login por ID (UUID)
La app ya permite escribir en `login.html`:
- `email`, o
- `ID de usuario (UUID)` de `auth.users.id`.

Para que el login por ID funcione:
1. Re-ejecuta el `docs/supabase/schema.sql` actualizado (incluye la funcion `kanban_get_auth_email_by_user_id`).
2. Crea usuarios en `Authentication > Users` (email/password).
3. Usa su `UID` para entrar desde login con ID + contrasena.

## 3) Ejecutar schema completo
1. Ve a `SQL Editor`.
2. Ejecuta entero `docs/supabase/schema.sql`.
3. Este script:
   - crea tablas nuevas,
   - migra tareas existentes a proyectos,
   - migra fechas legacy a `kanban_task_links`,
   - actualiza RLS para proyectos/roles y notas.

## 4) Definir jefes (manual una vez)
Por defecto, cada usuario nuevo se crea como `user`.
Para marcar a alguien como `jefe`, ejecuta en SQL Editor:

```sql
update public.kanban_users
set role = 'jefe'
where user_id = 'UUID_DEL_USUARIO';
```

## 5) Verificar Realtime
En `Database` -> `Replication`, comprueba que estan publicadas:
- `kanban_users`
- `kanban_projects`
- `kanban_project_members`
- `kanban_tasks`
- `kanban_task_links`
- `kanban_quick_notes`

## 6) Asignar participantes a un proyecto (opcional)
Si quieres meter un usuario en un proyecto concreto:

```sql
insert into public.kanban_project_members (project_id, user_id, permission)
values ('UUID_PROYECTO', 'UUID_USUARIO', 'editor')
on conflict (project_id, user_id) do nothing;
```

## 7) Probar flujo completo
1. Abre `login.html` e inicia sesion con email/password o con ID (UUID) + contrasena.
2. Verifica en MAIN que aparece el rol real detectado.
3. Crea uno o varios proyectos.
4. Abre un proyecto en Kanban y crea tareas.
5. Abre Gantt y Calendar del mismo proyecto.
6. Abre Notas del mismo proyecto y crea/marca notas.
7. Si eres `jefe`, usa "Gestionar personas" para:
   - anadir personas al proyecto,
   - cambiar permiso (`viewer/editor/manager`),
   - mover personas entre proyectos,
   - eliminar personas del proyecto.

## 8) Errores comunes
- `new row violates row-level security policy`:
  - Usuario sin permisos suficientes en RLS.
  - Faltan tablas/politicas del nuevo schema.
- `column project_id does not exist`:
  - No se ejecuto el schema nuevo.
- `No tienes acceso al proyecto en este modo`:
  - Estas en modo `user` sin pertenecer a ese proyecto.
  - O necesitas marcar el usuario como `jefe`.
- `column permission does not exist`:
  - No se ejecuto el schema actualizado con permisos por proyecto.
- `AUTH_REQUIRED` o redireccion constante a login:
  - No hay sesion iniciada.
  - El proveedor email/password no esta activo.
- `No se encontro un email para ese ID`:
  - El ID no existe en `auth.users`.
  - No se ejecuto el schema actualizado con `kanban_get_auth_email_by_user_id`.
- En Kanban solo ves tu nombre (o IDs) al asignar personas:
  - Falta la policy de lectura compartida en `kanban_users`.
  - Aplica este parche SQL si no vas a re-ejecutar el schema completo:

```sql
create or replace function public.kanban_shares_project_with_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kanban_project_members me
    join public.kanban_project_members other
      on other.project_id = me.project_id
    where me.user_id = auth.uid()
      and other.user_id = target_user_id
  );
$$;

grant execute on function public.kanban_shares_project_with_user(uuid) to authenticated;

drop policy if exists "kanban_users_select_self_or_jefe" on public.kanban_users;
create policy "kanban_users_select_self_or_jefe"
on public.kanban_users
for select
to authenticated
using (
  user_id = auth.uid()
  or public.kanban_is_jefe()
  or public.kanban_shares_project_with_user(user_id)
);
```
