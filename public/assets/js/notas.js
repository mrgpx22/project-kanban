(() => {
  const noteForm = document.querySelector("#noteForm");
  if (!noteForm) return;

  const noteInput = document.querySelector("#noteInput");
  const createNoteBtn = document.querySelector("#createNoteBtn");
  const notesList = document.querySelector("#notesList");
  const notesEmpty = document.querySelector("#notesEmpty");
  const refreshButton = document.querySelector("#refreshNotes");
  const syncStatus = document.querySelector("#syncStatus");
  const projectContext = document.querySelector("#projectContext");
  const mainViewLink = document.querySelector("#mainViewLink");
  const kanbanViewLink = document.querySelector("#kanbanViewLink");
  const calendarViewLink = document.querySelector("#calendarViewLink");
  const ganttViewLink = document.querySelector("#ganttViewLink");

  const app = window.KanbanApp;
  const utils = window.KanbanUtils;
  const NOTES_TABLE = (app && app.tables && app.tables.notes) || "kanban_quick_notes";
  const LOCAL_STORAGE_PREFIX = "kanban_quick_notes_v1";

  const state = {
    supabase: null,
    activeProject: null,
    currentUser: null,
    profileRole: "user",
    mode: "user",
    projectPermission: "editor",
    canEdit: false,
    localMode: false,
    realtimeChannel: null,
    notes: [],
  };

  const text = (value) =>
    utils && typeof utils.text === "function" ? utils.text(value) : String(value || "").trim();

  const setStatus = (message, type = "info") => {
    if (utils && typeof utils.setStatus === "function") {
      utils.setStatus(syncStatus, message, type);
      return;
    }
    if (!syncStatus) return;
    syncStatus.textContent = String(message || "");
    syncStatus.classList.remove("is-info", "is-success", "is-warning", "is-error");
    syncStatus.classList.add(`is-${type}`);
  };

  const createLocalId = () =>
    utils && typeof utils.createLocalId === "function"
      ? utils.createLocalId()
      : window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

  const isMissingNotesTableError = (error) => {
    const code = text(error && error.code).toLowerCase();
    const message = text(error && error.message).toLowerCase();
    if (code === "42p01" || code === "pgrst205") return true;
    if (message.includes("kanban_quick_notes")) return true;
    if (message.includes("relation") && message.includes("does not exist") && message.includes("quick")) return true;
    return false;
  };

  const getLocalStorageKey = () => {
    const projectId = state.activeProject && text(state.activeProject.id) ? text(state.activeProject.id) : "global";
    return `${LOCAL_STORAGE_PREFIX}:${projectId}`;
  };

  const sanitizeNote = (note) => ({
    id: text(note && note.id) || createLocalId(),
    content: text(note && note.content),
    is_done: !!(note && note.is_done),
    created_at: text(note && note.created_at) || new Date().toISOString(),
  });

  const sortNotes = (notes) =>
    (Array.isArray(notes) ? notes : [])
      .map((row) => sanitizeNote(row))
      .filter((row) => row.content.length > 0)
      .sort((a, b) => {
        const aTime = Date.parse(a.created_at);
        const bTime = Date.parse(b.created_at);
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return -1;
        if (Number.isNaN(bTime)) return 1;
        return aTime - bTime;
      });

  const readLocalNotes = () => {
    try {
      const raw = window.localStorage.getItem(getLocalStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return sortNotes(parsed);
    } catch (error) {
      console.warn(error);
      return [];
    }
  };

  const writeLocalNotes = () => {
    try {
      window.localStorage.setItem(getLocalStorageKey(), JSON.stringify(state.notes));
    } catch (error) {
      console.warn(error);
      setStatus("No se pudieron guardar notas en almacenamiento local.", "error");
    }
  };

  const setProjectContextText = () => {
    if (!projectContext || !state.activeProject) return;
    const permissionLabel =
      app && app.projectPermissionToLabel ? app.projectPermissionToLabel(state.projectPermission) : state.projectPermission;
    const projectName = text(state.activeProject.name) || `Proyecto ${text(state.activeProject.id).slice(0, 8)}`;
    projectContext.textContent = `Proyecto: ${projectName} | modo ${state.mode} | permiso ${permissionLabel}`;
  };

  const updateViewLinks = () => {
    if (!app || !state.activeProject) return;
    const links = app.getProjectLinks(state.activeProject.id);
    if (mainViewLink) mainViewLink.href = links.main;
    if (kanbanViewLink) kanbanViewLink.href = links.kanban;
    if (calendarViewLink) calendarViewLink.href = links.calendar;
    if (ganttViewLink) ganttViewLink.href = links.gantt;
  };

  const applyReadOnly = () => {
    const disabled = !state.canEdit;
    if (noteInput) noteInput.disabled = disabled;
    if (createNoteBtn) createNoteBtn.disabled = disabled;
  };

  const updateEmptyState = () => {
    if (!notesEmpty) return;
    notesEmpty.classList.toggle("hidden", state.notes.length > 0);
  };

  const renderNotes = () => {
    if (!notesList) return;
    notesList.innerHTML = "";

    state.notes.forEach((note) => {
      const item = document.createElement("li");
      item.className = "note-item";
      if (note.is_done) item.classList.add("is-done");

      const textNode = document.createElement("p");
      textNode.className = "note-text";
      textNode.textContent = note.content;

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "note-check";
      check.checked = note.is_done;
      check.disabled = !state.canEdit;
      check.setAttribute("aria-label", "Marcar nota como completada");
      check.addEventListener("change", () => {
        updateNoteDone(note.id, check.checked).catch((error) => {
          console.error(error);
          setStatus("No se pudo actualizar la nota.", "error");
        });
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "note-delete-btn";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.disabled = !state.canEdit;
      deleteBtn.addEventListener("click", () => {
        deleteNote(note.id).catch((error) => {
          console.error(error);
          setStatus("No se pudo eliminar la nota.", "error");
        });
      });

      item.appendChild(textNode);
      item.appendChild(check);
      item.appendChild(deleteBtn);
      notesList.appendChild(item);
    });

    updateEmptyState();
  };

  const switchToLocalMode = (message) => {
    state.localMode = true;
    state.notes = readLocalNotes();
    renderNotes();
    setStatus(message || "Modo local activado para notas.", "warning");
  };

  const fetchRemoteNotes = async () => {
    const { data, error } = await state.supabase
      .from(NOTES_TABLE)
      .select("id,content,is_done,created_at")
      .eq("project_id", state.activeProject.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return sortNotes(data || []);
  };

  const loadNotes = async (silent = false) => {
    if (state.localMode) {
      state.notes = readLocalNotes();
      renderNotes();
      if (!silent) {
        setStatus(`Notas locales cargadas: ${state.notes.length}.`, "success");
      }
      return;
    }

    if (!state.supabase || !state.activeProject) return;
    if (!silent) setStatus("Sincronizando notas...", "info");

    try {
      state.notes = await fetchRemoteNotes();
      renderNotes();
      if (!silent) {
        setStatus(`Notas sincronizadas: ${state.notes.length}.`, "success");
      }
    } catch (error) {
      if (isMissingNotesTableError(error)) {
        switchToLocalMode("Tabla de notas no encontrada en Supabase. Usando almacenamiento local por proyecto.");
        return;
      }
      throw error;
    }
  };

  const upsertLocalNote = (note) => {
    const safe = sanitizeNote(note);
    const index = state.notes.findIndex((row) => row.id === safe.id);
    if (index >= 0) state.notes[index] = safe;
    else state.notes.push(safe);
    state.notes = sortNotes(state.notes);
    writeLocalNotes();
    renderNotes();
  };

  const removeLocalNote = (noteId) => {
    state.notes = state.notes.filter((row) => row.id !== noteId);
    writeLocalNotes();
    renderNotes();
  };

  const createNote = async (content) => {
    const cleanContent = text(content);
    if (!cleanContent) return;

    if (state.localMode) {
      upsertLocalNote({
        id: createLocalId(),
        content: cleanContent,
        is_done: false,
        created_at: new Date().toISOString(),
      });
      setStatus("Nota creada en almacenamiento local.", "success");
      return;
    }

    try {
      const { error } = await state.supabase.from(NOTES_TABLE).insert({
        id: createLocalId(),
        project_id: state.activeProject.id,
        owner_id: state.currentUser ? state.currentUser.id : null,
        content: cleanContent,
        is_done: false,
      });
      if (error) throw error;
      await loadNotes(true);
      setStatus("Nota creada.", "success");
    } catch (error) {
      if (isMissingNotesTableError(error)) {
        switchToLocalMode("Tabla de notas no encontrada en Supabase. Usando almacenamiento local por proyecto.");
        upsertLocalNote({
          id: createLocalId(),
          content: cleanContent,
          is_done: false,
          created_at: new Date().toISOString(),
        });
        setStatus("Nota creada en almacenamiento local.", "success");
        return;
      }
      throw error;
    }
  };

  const updateNoteDone = async (noteId, done) => {
    const safeId = text(noteId);
    if (!safeId) return;

    if (state.localMode) {
      const current = state.notes.find((row) => row.id === safeId);
      if (!current) return;
      upsertLocalNote({ ...current, is_done: !!done });
      setStatus("Nota actualizada en almacenamiento local.", "success");
      return;
    }

    try {
      const { error } = await state.supabase
        .from(NOTES_TABLE)
        .update({ is_done: !!done })
        .eq("id", safeId)
        .eq("project_id", state.activeProject.id);
      if (error) throw error;
      await loadNotes(true);
      setStatus("Nota actualizada.", "success");
    } catch (error) {
      if (isMissingNotesTableError(error)) {
        switchToLocalMode("Tabla de notas no encontrada en Supabase. Usando almacenamiento local por proyecto.");
        const current = state.notes.find((row) => row.id === safeId);
        if (current) {
          upsertLocalNote({ ...current, is_done: !!done });
        }
        return;
      }
      throw error;
    }
  };

  const deleteNote = async (noteId) => {
    const safeId = text(noteId);
    if (!safeId) return;

    if (state.localMode) {
      removeLocalNote(safeId);
      setStatus("Nota eliminada en almacenamiento local.", "success");
      return;
    }

    try {
      const { error } = await state.supabase
        .from(NOTES_TABLE)
        .delete()
        .eq("id", safeId)
        .eq("project_id", state.activeProject.id);
      if (error) throw error;
      await loadNotes(true);
      setStatus("Nota eliminada.", "success");
    } catch (error) {
      if (isMissingNotesTableError(error)) {
        switchToLocalMode("Tabla de notas no encontrada en Supabase. Usando almacenamiento local por proyecto.");
        removeLocalNote(safeId);
        return;
      }
      throw error;
    }
  };

  const startRealtime = () => {
    if (state.localMode || !state.supabase || !state.activeProject || state.realtimeChannel) return;

    state.realtimeChannel = state.supabase
      .channel(`kanban-notes-sync-${state.activeProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: NOTES_TABLE,
          filter: `project_id=eq.${state.activeProject.id}`,
        },
        () => {
          loadNotes(true).catch((error) => {
            console.error(error);
          });
        }
      )
      .subscribe();
  };

  const redirectToMain = (message) => {
    if (message) {
      setStatus(message, "error");
    }
    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);
  };

  const initializeAccessContext = async () => {
    const projectId = app.getProjectIdFromUrl();
    if (!projectId) {
      redirectToMain("Debes abrir un proyecto desde MAIN.");
      return false;
    }

    await app.ensureAuthSession(state.supabase);
    state.currentUser = await app.getCurrentUser(state.supabase);
    const profile = await app.ensureProfile(state.supabase, state.currentUser.id);
    state.profileRole = profile.role;
    state.mode = app.resolveMode(profile.role);

    const access = await app.ensureProjectAccess({
      supabaseClient: state.supabase,
      projectId,
      userId: state.currentUser.id,
      profileRole: state.profileRole,
      mode: state.mode,
    });

    if (!access.allowed || !access.project) {
      redirectToMain("No tienes acceso al proyecto en este modo.");
      return false;
    }

    state.activeProject = access.project;
    state.projectPermission =
      (app && app.normalizeProjectPermission && access.permission
        ? app.normalizeProjectPermission(access.permission)
        : access.permission) || "editor";
    state.canEdit =
      app && app.canEditProjectData
        ? app.canEditProjectData({
            profileRole: state.profileRole,
            mode: state.mode,
            permission: state.projectPermission,
          })
        : true;

    updateViewLinks();
    setProjectContextText();
    applyReadOnly();
    return true;
  };

  const initializeLocalContext = () => {
    const params = new URLSearchParams(window.location.search);
    const projectId = text(params.get("project")) || "local";
    state.activeProject = {
      id: projectId,
      name: projectId === "local" ? "Proyecto local" : `Proyecto ${projectId.slice(0, 8)}`,
    };
    state.mode = app && typeof app.getStoredMode === "function" ? app.getStoredMode() : "user";
    state.projectPermission = "editor";
    state.canEdit = true;
    state.localMode = true;
    updateViewLinks();
    setProjectContextText();
    applyReadOnly();
    state.notes = readLocalNotes();
    renderNotes();
  };

  noteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.canEdit) {
      setStatus("Permiso de solo lectura en este proyecto.", "warning");
      return;
    }

    const content = text(noteInput ? noteInput.value : "");
    if (!content) {
      if (noteInput) noteInput.focus();
      return;
    }

    try {
      await createNote(content);
      noteForm.reset();
      if (noteInput) noteInput.focus();
    } catch (error) {
      console.error(error);
      setStatus("No se pudo crear la nota.", "error");
    }
  });

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      loadNotes(false).catch((error) => {
        console.error(error);
        setStatus("No se pudo refrescar la vista de notas.", "error");
      });
    });
  }

  window.addEventListener("beforeunload", () => {
    if (state.realtimeChannel && state.supabase) {
      state.supabase.removeChannel(state.realtimeChannel);
    }
  });

  const init = async () => {
    if (!app || !app.hasSupabaseConfig()) {
      initializeLocalContext();
      setStatus("Configura .env para sincronizar notas. Modo local activo.", "warning");
      return;
    }

    try {
      state.supabase = app.createSupabaseClient();
      if (!state.supabase) {
        initializeLocalContext();
        setStatus("No se pudo crear el cliente de Supabase. Modo local activo.", "warning");
        return;
      }

      const canContinue = await initializeAccessContext();
      if (!canContinue) return;

      await loadNotes(false);
      startRealtime();
      if (!state.canEdit) {
        setStatus("Notas en modo solo lectura.", "warning");
      }
    } catch (error) {
      if (app && app.isAuthRequiredError && app.isAuthRequiredError(error)) {
        app.redirectToLogin();
        return;
      }
      console.error(error);
      setStatus("Error de inicio: revisa sesion, tablas y politicas RLS.", "error");
    }
  };

  init();
})();
