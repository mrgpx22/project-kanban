(() => {
  const delayTasksList = document.querySelector("#delayTasksList");
  if (!delayTasksList) return;

  const app = window.KanbanApp;
  const utils = window.KanbanUtils;
  const TABLE_NAME = (app && app.tables && app.tables.delayTasks) || "n8n_delay_tasks";

  const state = {
    supabase: null,
    projectId: "",
    realtimeChannel: null,
    refreshTimer: null,
    isLoading: false,
  };

  const text = (value) => (utils && typeof utils.text === "function" ? utils.text(value) : String(value || "").trim());
  const isAuthRequiredError = (error) => (app && typeof app.isAuthRequiredError === "function" ? app.isAuthRequiredError(error) : false);

  const getProjectId = () => {
    if (app && typeof app.getProjectIdFromUrl === "function") {
      return text(app.getProjectIdFromUrl());
    }
    const params = new URLSearchParams(window.location.search);
    return text(params.get("project"));
  };

  const formatDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getField = (row, keys, fallback = "") => {
    const source = row || {};
    for (const key of keys) {
      const value = source[key];
      const safe = text(value);
      if (safe) return safe;
    }
    return text(fallback);
  };

  const getChipInfo = (row) => {
    const rawStatus = text(row && (row.status || row.state || row.delay_status));
    const isResolved =
      row && (row.is_active === false || rawStatus.toLowerCase() === "resolved" || rawStatus.toLowerCase() === "done");
    if (isResolved) {
      return { label: "Resuelto", className: "is-resolved" };
    }
    if (rawStatus.toLowerCase() === "pending" || rawStatus.toLowerCase() === "waiting") {
      return { label: "Pendiente", className: "is-pending" };
    }
    return { label: "Retraso", className: "is-delayed" };
  };

  const normalizeDelayRow = (row) => {
    const taskId = getField(row, ["task_id", "id", "source_id"]);
    const taskTitle = getField(row, ["task_title", "title", "task_name", "name", "summary"], taskId ? `Tarea ${taskId.slice(0, 8)}` : "Tarea sin título");
    const reason = getField(row, ["reason", "delay_reason", "explanation", "message", "details", "description"], "Sin explicación");
    const source = getField(row, ["source", "origin", "created_by"], "n8n");
    const updatedAt = getField(row, ["updated_at", "modified_at", "created_at"]);
    const status = getChipInfo(row);

    return {
      taskId,
      taskTitle,
      reason,
      source,
      updatedAt,
      updatedLabel: updatedAt ? formatDateTime(updatedAt) : "",
      status,
    };
  };

  const renderMessage = (className, message) => {
    delayTasksList.innerHTML = "";
    const box = document.createElement("div");
    box.className = className;
    box.textContent = String(message || "");
    delayTasksList.appendChild(box);
  };

  const renderRows = (rows) => {
    const safeRows = Array.isArray(rows) ? rows.map((row) => normalizeDelayRow(row)) : [];
    delayTasksList.innerHTML = "";

    if (safeRows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "delay-notes-empty";
      empty.textContent = "No hay retrasos activos en este proyecto.";
      delayTasksList.appendChild(empty);
      return;
    }

    safeRows.forEach((row) => {
      const card = document.createElement("article");
      card.className = "delay-task-card";

      const head = document.createElement("div");
      head.className = "delay-task-card__head";

      const title = document.createElement("h3");
      title.className = "delay-task-card__title";
      title.textContent = row.taskTitle;

      const chip = document.createElement("span");
      chip.className = `delay-task-card__chip ${row.status.className}`;
      chip.textContent = row.status.label;

      const reason = document.createElement("p");
      reason.className = "delay-task-card__reason";
      reason.textContent = row.reason;

      const meta = document.createElement("div");
      meta.className = "delay-task-card__meta";

      const source = document.createElement("span");
      source.textContent = row.source ? `Fuente: ${row.source}` : "Fuente: n8n";

      meta.appendChild(source);

      if (row.updatedLabel) {
        const updated = document.createElement("span");
        updated.textContent = `Actualizado: ${row.updatedLabel}`;
        meta.appendChild(updated);
      }

      if (row.taskId) {
        const taskId = document.createElement("span");
        taskId.textContent = `ID: ${row.taskId.slice(0, 8)}`;
        meta.appendChild(taskId);
      }

      head.appendChild(title);
      head.appendChild(chip);
      card.appendChild(head);
      card.appendChild(reason);
      card.appendChild(meta);
      delayTasksList.appendChild(card);
    });
  };

  const loadDelayTasks = async () => {
    if (!state.supabase || !state.projectId || state.isLoading) return;
    state.isLoading = true;

    if (state.refreshTimer) {
      window.clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }

    try {
      const response = await state.supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("project_id", state.projectId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (response.error) throw response.error;
      renderRows(response.data || []);
    } catch (error) {
      console.error(error);
      if (isAuthRequiredError(error)) {
        renderMessage("delay-notes-error", "Necesitas iniciar sesión para ver los retrasos.");
      } else {
        const message = text(error && error.message) || "No se pudieron cargar los retrasos.";
        renderMessage("delay-notes-error", message);
      }
    } finally {
      state.isLoading = false;
    }
  };

  const startRealtime = () => {
    if (!state.supabase || !state.projectId || state.realtimeChannel) return;

    state.realtimeChannel = state.supabase
      .channel(`kanban-delay-tasks-${state.projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME, filter: `project_id=eq.${state.projectId}` },
        () => {
          loadDelayTasks().catch((error) => console.error(error));
        }
      )
      .subscribe();
  };

  const scheduleRefresh = () => {
    if (state.refreshTimer) window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(() => {
      loadDelayTasks().catch((error) => console.error(error));
    }, 45000);
  };

  const cleanup = () => {
    if (state.refreshTimer) {
      window.clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
    if (state.supabase && state.realtimeChannel) {
      state.supabase.removeChannel(state.realtimeChannel);
      state.realtimeChannel = null;
    }
  };

  const init = async () => {
    if (!app || !app.hasSupabaseConfig || !app.hasSupabaseConfig()) {
      renderMessage("delay-notes-error", "Configura Supabase para mostrar los retrasos.");
      return;
    }

    state.supabase = app.createSupabaseClient ? app.createSupabaseClient() : null;
    if (!state.supabase) {
      renderMessage("delay-notes-error", "No se pudo crear el cliente de Supabase.");
      return;
    }

    state.projectId = getProjectId();
    if (!state.projectId) {
      renderMessage("delay-notes-error", "Falta el id del proyecto en la URL.");
      return;
    }

    try {
      if (typeof app.ensureAuthSession === "function") {
        await app.ensureAuthSession(state.supabase);
      }
      await loadDelayTasks();
      startRealtime();
      scheduleRefresh();
    } catch (error) {
      console.error(error);
      if (isAuthRequiredError(error)) {
        renderMessage("delay-notes-error", "Necesitas iniciar sesión para ver los retrasos.");
      } else {
        const message = text(error && error.message) || "No se pudieron cargar los retrasos.";
        renderMessage("delay-notes-error", message);
      }
    }
  };

  window.addEventListener("beforeunload", cleanup);
  init();
})();
