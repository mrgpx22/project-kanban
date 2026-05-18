(() => {
  const app = window.KanbanApp;
  const loginForm = document.querySelector("#loginForm");
  if (!loginForm) return;

  const emailInput = document.querySelector("#emailInput");
  const passwordInput = document.querySelector("#passwordInput");
  const loginStatus = document.querySelector("#loginStatus");
  const loginRole = document.querySelector("#loginRole");

  const state = {
    supabase: null,
  };

  const setStatus = (message, type = "info") => {
    if (!loginStatus) return;
    loginStatus.textContent = message;
    loginStatus.classList.remove("is-info", "is-success", "is-warning", "is-error");
    loginStatus.classList.add(`is-${type}`);
  };

  const setRole = (message = "") => {
    if (!loginRole) return;
    loginRole.textContent = message;
  };

  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || "").trim()
    );

  const resolveEmailFromIdentifier = async (identifier) => {
    const normalized = String(identifier || "").trim();
    if (!normalized) {
      return null;
    }

    if (normalized.includes("@")) {
      return normalized.toLowerCase();
    }

    if (!isUuid(normalized)) {
      return null;
    }

    const { data, error } = await state.supabase.rpc("kanban_get_auth_email_by_user_id", {
      input_user_id: normalized,
    });
    if (error) throw error;

    const resolvedEmail = String(data || "").trim().toLowerCase();
    return resolvedEmail && resolvedEmail.includes("@") ? resolvedEmail : null;
  };

  const normalizeAuthError = (error) => {
    const raw = String((error && error.message) || "").toLowerCase();
    if (raw.includes("kanban_get_auth_email_by_user_id")) {
      return "Falta la funcion SQL de login por ID. Ejecuta el schema actualizado.";
    }
    if (raw.includes("uuid")) {
      return "El ID debe ser un UUID valido completo.";
    }
    if (raw.includes("invalid login credentials")) {
      return "ID/Email o contrasena incorrectos.";
    }
    if (raw.includes("email not confirmed")) {
      return "Tu email aun no esta confirmado.";
    }
    if (raw.includes("rate limit")) {
      return "Demasiados intentos. Espera un momento.";
    }
    return "No se pudo iniciar sesion.";
  };

  const maybeRedirectIfAuthenticated = async () => {
    const { data, error } = await state.supabase.auth.getSession();
    if (error) throw error;

    const session = data ? data.session : null;
    if (!session || !session.user || !session.user.id) return false;
    if (session.user.is_anonymous) {
      await state.supabase.auth.signOut();
      return false;
    }

    const profile = await app.ensureProfile(state.supabase, session.user.id);
    setRole(`Rol detectado: ${app.roleToLabel(profile.role)}`);
    setStatus("Sesion ya activa. Redirigiendo...", "success");
    setTimeout(() => app.redirectAfterLogin("index.html"), 350);
    return true;
  };

  const init = async () => {
    if (!app || !app.hasSupabaseConfig()) {
      setStatus("Configura .env antes de iniciar sesion.", "warning");
      return;
    }

    state.supabase = app.createSupabaseClient();
    if (!state.supabase) {
      setStatus("No se pudo crear el cliente de Supabase.", "error");
      return;
    }

    try {
      const redirected = await maybeRedirectIfAuthenticated();
      if (!redirected) {
        setStatus("Introduce tus credenciales.", "info");
      }
    } catch (error) {
      console.error(error);
      setStatus("Error al comprobar la sesion actual.", "error");
    }
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.supabase) return;

    const identifier = String(emailInput ? emailInput.value : "").trim();
    const password = String(passwordInput ? passwordInput.value : "");

    if (!identifier || !password) {
      setStatus("Completa ID/Email y contrasena.", "warning");
      if (emailInput) emailInput.focus();
      return;
    }

    setRole("");
    setStatus("Validando credenciales...", "info");

    try {
      const resolvedEmail = await resolveEmailFromIdentifier(identifier);
      if (!resolvedEmail) {
        setStatus("No se encontro un email para ese ID. Usa UUID completo o email.", "error");
        return;
      }

      const { data, error } = await state.supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });
      if (error) throw error;

      const user = data && data.user ? data.user : null;
      if (!user || !user.id) {
        throw new Error("No se pudo recuperar el usuario autenticado.");
      }

      const profile = await app.ensureProfile(state.supabase, user.id);
      setRole(`Rol detectado: ${app.roleToLabel(profile.role)}`);
      setStatus("Login correcto. Entrando en la aplicacion...", "success");
      setTimeout(() => app.redirectAfterLogin("index.html"), 500);
    } catch (error) {
      console.error(error);
      setStatus(normalizeAuthError(error), "error");
    }
  });

  init();
})();
