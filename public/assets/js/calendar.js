(() => {
  const calendarEl = document.querySelector("#calendar");
  if (!calendarEl) return;

  const refreshButton = document.querySelector("#refreshCalendar");
  const syncStatus = document.querySelector("#syncStatus");
  const noDateList = document.querySelector("#noDateList");
  const totalTasksEl = document.querySelector("#totalTasks");
  const scheduledTasksEl = document.querySelector("#scheduledTasks");
  const unscheduledTasksEl = document.querySelector("#unscheduledTasks");
  const criticalTasksEl = document.querySelector("#criticalTasks");
  const projectContext = document.querySelector("#projectContext");
  const mainViewLink = document.querySelector("#mainViewLink");
  const kanbanViewLink = document.querySelector("#kanbanViewLink");
  const ganttViewLink = document.querySelector("#ganttViewLink");
  const notesViewLink = document.querySelector("#notesViewLink");
  const app = window.KanbanApp;
  const utils = window.KanbanUtils;

  const SUPABASE_TABLE = (app && app.tables && app.tables.tasks) || "kanban_tasks";
  const SUPABASE_LINKS_TABLE = (app && app.tables && app.tables.links) || "kanban_task_links";

  const STATUS_LABELS = Object.freeze({
    open: "Open",
    "on-hold": "On Hold",
    "pending-approval": "Pending Approval",
    done: "Complete",
  });

  const STAGE_TOKEN = /^\[WF:(backlog|open-todo|in-progress|blocked|review-qa|pending-approval|done)\]\s*/i;

  const DEPARTMENT_COLORS = Object.freeze({
    producto: "#f59e0b",
    ux: "#ec4899",
    backend: "#10b981",
    frontend: "#3b82f6",
    marketing: "#8b5cf6",
    rrhh: "#ef4444",
    "recursos humanos": "#ef4444",
    ventas: "#f97316",
    bbdd: "#14b8a6",
    "base de datos": "#14b8a6",
    general: "#94a3b8",
  });

  let supabaseClient = null;
  let realtimeChannel = null;
  let calendar = null;
  let activeProject = null;
  let currentMode = "user";
  let profileRole = "user";
  let currentPermission = "editor";

  const isValidIsoDate = (value) =>
    utils && typeof utils.isValidIsoDate === "function"
      ? utils.isValidIsoDate(value)
      : /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

  const parseIsoDate = (value) => {
    if (utils && typeof utils.parseIsoDate === "function") {
      return utils.parseIsoDate(value);
    }
    if (!isValidIsoDate(value)) return null;
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const toIsoDate = (dateValue) => {
    if (utils && typeof utils.toIsoDate === "function") {
      return utils.toIsoDate(dateValue);
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const addDaysToIso = (value, days) => {
    if (utils && typeof utils.addDaysToIso === "function") {
      return utils.addDaysToIso(value, days);
    }
    const parsed = parseIsoDate(value);
    if (!parsed) return null;
    parsed.setDate(parsed.getDate() + days);
    return toIsoDate(parsed);
  };

  const normalizeDepartment = (value) =>
    utils && typeof utils.normalizeKey === "function"
      ? utils.normalizeKey(value)
      : String(value || "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

  const stripStageToken = (titleValue) => {
    const rawTitle = String(titleValue || "");
    const match = rawTitle.match(STAGE_TOKEN);
    if (!match) return rawTitle.trim();
    return rawTitle.slice(match[0].length).trim();
  };

  const getDepartmentColor = (department) => {
    const normalized = normalizeDepartment(department);
    return DEPARTMENT_COLORS[normalized] || DEPARTMENT_COLORS.general;
  };

  const sanitizeTask = (task) => ({
    id: String(task.id || ""),
    title: stripStageToken(task.title) || "Sin titulo",
    department: String(task.department || "General").trim() || "General",
    status: String(task.status || "open"),
    priority: String(task.priority || "medium"),
  });

  const sanitizeScheduleLink = (row) => ({
    source_id: String(row.source_id || ""),
    target_id: String(row.target_id || ""),
    start_date: isValidIsoDate(row.start_date) ? String(row.start_date) : null,
    end_date: isValidIsoDate(row.end_date) ? String(row.end_date) : null,
  });

  const setSyncStatus = (message, type = "info") => {
    if (utils && typeof utils.setStatus === "function") {
      utils.setStatus(syncStatus, message, type);
      return;
    }
    if (!syncStatus) return;
    syncStatus.textContent = message;
    syncStatus.classList.remove("is-info", "is-success", "is-warning", "is-error");
    syncStatus.classList.add(`is-${type}`);
  };

  const setProjectContextText = () => {
    if (!projectContext || !activeProject) return;
    const permissionLabel =
      app && app.projectPermissionToLabel ? app.projectPermissionToLabel(currentPermission) : currentPermission;
    projectContext.textContent = `Proyecto: ${activeProject.name} | modo ${currentMode} | permiso ${permissionLabel}`;
  };

  const updateViewLinks = () => {
    if (!app || !activeProject) return;
    const links = app.getProjectLinks(activeProject.id);

    if (mainViewLink) {
      mainViewLink.href = links.main;
    }
    if (kanbanViewLink) {
      kanbanViewLink.href = links.kanban;
    }
    if (ganttViewLink) {
      ganttViewLink.href = links.gantt;
    }
    if (notesViewLink) {
      notesViewLink.href = links.notes;
    }
  };

  const redirectToMain = (message) => {
    if (message) {
      setSyncStatus(message, "error");
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

    await app.ensureAuthSession(supabaseClient);
    const user = await app.getCurrentUser(supabaseClient);
    const profile = await app.ensureProfile(supabaseClient, user.id);
    profileRole = profile.role;
    currentMode = app.resolveMode(profile.role);

    const access = await app.ensureProjectAccess({
      supabaseClient,
      projectId,
      userId: user.id,
      profileRole,
      mode: currentMode,
    });

    if (!access.allowed || !access.project) {
      redirectToMain("No tienes acceso al proyecto en este modo.");
      return false;
    }

    activeProject = access.project;
    currentPermission =
      (app && app.normalizeProjectPermission && access.permission
        ? app.normalizeProjectPermission(access.permission)
        : access.permission) || "editor";
    updateViewLinks();
    setProjectContextText();
    return true;
  };

  const fetchTasksAndScheduleLinks = async () => {
    const [tasksResult, linksResult] = await Promise.all([
      supabaseClient
        .from(SUPABASE_TABLE)
        .select("id,title,department,status,priority")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: true }),
      supabaseClient
        .from(SUPABASE_LINKS_TABLE)
        .select("source_id,target_id,start_date,end_date")
        .eq("project_id", activeProject.id),
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (linksResult.error) throw linksResult.error;

    const tasks = (tasksResult.data || []).map((task) => sanitizeTask(task));
    const scheduleLinks = (linksResult.data || [])
      .map((link) => sanitizeScheduleLink(link))
      .filter((link) => link.source_id && link.target_id && link.source_id === link.target_id);

    return { tasks, scheduleLinks };
  };

  const buildScheduleByTaskMap = (scheduleLinks) => {
    const map = new Map();
    scheduleLinks.forEach((link) => {
      const taskId = link.source_id;
      if (!taskId) return;

      const start = link.start_date || link.end_date;
      const end = link.end_date || link.start_date;
      if (!start || !end) return;

      const normalizedEnd = end < start ? start : end;
      map.set(taskId, { start, end: normalizedEnd });
    });
    return map;
  };

  const buildCalendarRiskContext = (tasks, scheduleByTask) => {
    const riskByTaskId = new Map();
    const counts = {
      critical: 0,
      overdue: 0,
      dueToday: 0,
      dueSoon: 0,
      doneLate: 0,
      done: 0,
      noDate: 0,
      onTrack: 0,
    };

    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      const schedule = scheduleByTask.get(task.id);
      const riskTask = {
        ...task,
        start_date: schedule ? schedule.start : "",
        end_date: schedule ? schedule.end : "",
      };
      const riskInfo =
        utils && typeof utils.getTaskRiskInfo === "function"
          ? utils.getTaskRiskInfo(riskTask, {})
          : {
              state: "no-date",
              label: "Sin fecha limite",
              detail: "Anade una fecha final para activar el semaforo.",
              severity: -1,
              daysLeft: null,
            };
      riskByTaskId.set(task.id, riskInfo);

      if (riskInfo.state === "critical") counts.critical += 1;
      else if (riskInfo.state === "overdue") counts.overdue += 1;
      else if (riskInfo.state === "due-today") counts.dueToday += 1;
      else if (riskInfo.state === "due-soon") counts.dueSoon += 1;
      else if (riskInfo.state === "done-late") counts.doneLate += 1;
      else if (riskInfo.state === "done") counts.done += 1;
      else if (riskInfo.state === "no-date") counts.noDate += 1;
      else counts.onTrack += 1;
    });

    return { riskByTaskId, counts };
  };

  const getEventColorForRisk = (department, stateValue) => {
    const baseColor = getDepartmentColor(department);
    if (stateValue === "critical") {
      return { backgroundColor: "#7f1d1d", borderColor: "#5f1212", textColor: "#ffffff" };
    }
    if (stateValue === "overdue") {
      return { backgroundColor: "#dc2626", borderColor: "#9f1d1d", textColor: "#ffffff" };
    }
    if (stateValue === "due-today") {
      return { backgroundColor: "#f97316", borderColor: "#c2410c", textColor: "#ffffff" };
    }
    if (stateValue === "due-soon") {
      return { backgroundColor: "#facc15", borderColor: "#ca8a04", textColor: "#4a3200" };
    }
    if (stateValue === "done-late") {
      return { backgroundColor: "#fb923c", borderColor: "#c2410c", textColor: "#ffffff" };
    }
    if (stateValue === "done") {
      return { backgroundColor: "#16a34a", borderColor: "#166534", textColor: "#ffffff" };
    }
    return { backgroundColor: baseColor, borderColor: baseColor, textColor: "#ffffff" };
  };

  const renderNoDateTasks = (tasks, scheduleByTask) => {
    if (!noDateList) return;
    noDateList.innerHTML = "";

    const withoutDate = tasks.filter((task) => !scheduleByTask.has(task.id));
    if (withoutDate.length === 0) {
      const empty = document.createElement("li");
      empty.className = "no-date-empty";
      empty.textContent = "No hay tareas pendientes sin fecha.";
      noDateList.appendChild(empty);
      return;
    }

    withoutDate.forEach((task) => {
      const item = document.createElement("li");
      item.className = "no-date-item";
      item.style.setProperty("--dept-color", getDepartmentColor(task.department));

      const title = document.createElement("p");
      title.className = "no-date-title";
      title.textContent = task.title;

      const meta = document.createElement("p");
      meta.className = "no-date-meta";
      const statusLabel = STATUS_LABELS[task.status] || task.status || "Open";
      meta.textContent = `${task.department} - ${statusLabel}`;

      item.appendChild(title);
      item.appendChild(meta);
      noDateList.appendChild(item);
    });
  };

  const updateCounters = (tasks, scheduleByTask, riskContext = null) => {
    const total = tasks.length;
    const scheduled = tasks.filter((task) => scheduleByTask.has(task.id)).length;
    const unscheduled = total - scheduled;
    const criticalCount = riskContext && riskContext.counts ? Number(riskContext.counts.critical || 0) : 0;

    if (totalTasksEl) totalTasksEl.textContent = String(total);
    if (scheduledTasksEl) scheduledTasksEl.textContent = String(scheduled);
    if (unscheduledTasksEl) unscheduledTasksEl.textContent = String(unscheduled);
    if (criticalTasksEl) criticalTasksEl.textContent = String(criticalCount);
  };

  const buildEvents = (tasks, scheduleByTask, riskContext = null) =>
    tasks
      .filter((task) => scheduleByTask.has(task.id))
      .map((task) => {
        const range = scheduleByTask.get(task.id);
        if (!range) return null;

        const endExclusive = addDaysToIso(range.end, 1);
        if (!endExclusive) return null;

        const riskInfo =
          riskContext && riskContext.riskByTaskId
            ? riskContext.riskByTaskId.get(task.id)
            : utils && typeof utils.getTaskRiskInfo === "function"
              ? utils.getTaskRiskInfo({ ...task, start_date: range.start, end_date: range.end }, {})
              : null;
        const color = riskInfo
          ? getEventColorForRisk(task.department, riskInfo.state)
          : {
              backgroundColor: getDepartmentColor(task.department),
              borderColor: getDepartmentColor(task.department),
              textColor: "#ffffff",
            };
        const statusLabel = STATUS_LABELS[task.status] || task.status || "Open";
        return {
          id: task.id,
          title: task.title,
          start: range.start,
          end: endExclusive,
          allDay: true,
          display: "block",
          backgroundColor: color.backgroundColor,
          borderColor: color.borderColor,
          textColor: color.textColor,
          classNames: [`risk-${riskInfo ? riskInfo.state : "on-track"}`],
          extendedProps: {
            department: task.department,
            status: statusLabel,
            riskState: riskInfo ? riskInfo.state : "on-track",
            riskLabel: riskInfo ? riskInfo.label : "Quedan varios dias",
          },
        };
      })
      .filter((eventItem) => !!eventItem);

  const ensureCalendar = () => {
    if (calendar) return calendar;
    if (!window.FullCalendar) {
      throw new Error("FullCalendar no esta disponible.");
    }

    calendar = new window.FullCalendar.Calendar(calendarEl, {
      locale: "es",
      initialView: "dayGridMonth",
      firstDay: 1,
      height: "auto",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,listWeek",
      },
      buttonText: {
        today: "Hoy",
        month: "Mes",
        week: "Semana",
        list: "Lista",
      },
      eventDisplay: "block",
      displayEventTime: false,
      eventClick: (info) => {
        if (!app || !activeProject) return;
        const taskId = encodeURIComponent(info.event.id);
        window.location.href = app.buildProjectUrl("kanban.html", activeProject.id, { task: taskId });
      },
      dateClick: () => {
        if (!app || !activeProject) return;
        window.location.href = app.buildProjectUrl("kanban.html", activeProject.id, { new: "1" });
      },
    });
    calendar.render();
    return calendar;
  };

  const renderCalendar = (events) => {
    const instance = ensureCalendar();
    instance.removeAllEvents();
    events.forEach((event) => instance.addEvent(event));
  };

  const loadAndRender = async () => {
    if (!supabaseClient) return;
    setSyncStatus("Sincronizando calendario...", "info");

    try {
      const { tasks, scheduleLinks } = await fetchTasksAndScheduleLinks();
      const scheduleByTask = buildScheduleByTaskMap(scheduleLinks);
      const riskContext = buildCalendarRiskContext(tasks, scheduleByTask);
      renderCalendar(buildEvents(tasks, scheduleByTask, riskContext));
      renderNoDateTasks(tasks, scheduleByTask);
      updateCounters(tasks, scheduleByTask, riskContext);
      setSyncStatus("Calendario actualizado desde Supabase.", "success");
    } catch (error) {
      console.error(error);
      setSyncStatus("No se pudo leer Supabase. Revisa sesion, tablas y politicas RLS.", "error");
    }
  };

  const startRealtime = () => {
    if (!supabaseClient || realtimeChannel || !activeProject) return;

    realtimeChannel = supabaseClient
      .channel(`kanban-calendar-sync-${activeProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: SUPABASE_TABLE,
          filter: `project_id=eq.${activeProject.id}`,
        },
        () => {
          loadAndRender();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: SUPABASE_LINKS_TABLE,
          filter: `project_id=eq.${activeProject.id}`,
        },
        () => {
          loadAndRender();
        }
      )
      .subscribe();
  };

  const init = async () => {
    if (!app || !app.hasSupabaseConfig()) {
      setSyncStatus("Configura .env para activar la vista compartida.", "warning");
      ensureCalendar();
      renderNoDateTasks([], new Map());
      updateCounters([], new Map());
      return;
    }

    try {
      supabaseClient = app.createSupabaseClient();
      if (!supabaseClient) {
        setSyncStatus("No se pudo crear el cliente de Supabase.", "error");
        return;
      }

      const canContinue = await initializeAccessContext();
      if (!canContinue) return;

      await loadAndRender();
      startRealtime();
    } catch (error) {
      if (app && app.isAuthRequiredError && app.isAuthRequiredError(error)) {
        app.redirectToLogin();
        return;
      }
      console.error(error);
      setSyncStatus("Error de inicio: revisa sesion, tablas y politicas RLS.", "error");
    }
  };

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      loadAndRender();
    });
  }

  window.addEventListener("beforeunload", () => {
    if (realtimeChannel && supabaseClient) {
      supabaseClient.removeChannel(realtimeChannel);
    }
  });

  init();
})();
