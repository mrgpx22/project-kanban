(() => {
  const ganttElement = document.querySelector("#ganttHere");
  if (!ganttElement) return;

  const shiftProjectToTodayButton = document.querySelector("#shiftProjectToToday");
  const refreshButton = document.querySelector("#refreshGantt");
  const syncStatus = document.querySelector("#syncStatus");
  const totalTasksEl = document.querySelector("#totalTasks");
  const scheduledTasksEl = document.querySelector("#scheduledTasks");
  const unscheduledTasksEl = document.querySelector("#unscheduledTasks");
  const criticalPathTasksEl = document.querySelector("#criticalPathTasks");
  const projectContext = document.querySelector("#projectContext");
  const mainViewLink = document.querySelector("#mainViewLink");
  const kanbanViewLink = document.querySelector("#kanbanViewLink");
  const calendarViewLink = document.querySelector("#calendarViewLink");
  const notesViewLink = document.querySelector("#notesViewLink");
  const taskInfoModal = document.querySelector("#taskInfoModal");
  const taskInfoCloseBtn = document.querySelector("#taskInfoCloseBtn");
  const taskInfoTitleText = document.querySelector("#taskInfoTitleText");
  const taskInfoId = document.querySelector("#taskInfoId");
  const taskInfoKanbanStatus = document.querySelector("#taskInfoKanbanStatus");
  const taskInfoGanttStatus = document.querySelector("#taskInfoGanttStatus");
  const taskInfoDepartment = document.querySelector("#taskInfoDepartment");
  const taskInfoPriority = document.querySelector("#taskInfoPriority");
  const taskInfoDates = document.querySelector("#taskInfoDates");
  const taskInfoAssignees = document.querySelector("#taskInfoAssignees");
  const taskInfoCommentsCount = document.querySelector("#taskInfoCommentsCount");
  const taskInfoParent = document.querySelector("#taskInfoParent");
  const taskInfoEditDatesBtn = document.querySelector("#taskInfoEditDatesBtn");
  const app = window.KanbanApp;
  const utils = window.KanbanUtils;

  const SUPABASE_TABLE = (app && app.tables && app.tables.tasks) || "kanban_tasks";
  const SUPABASE_LINKS_TABLE = (app && app.tables && app.tables.links) || "kanban_task_links";
  const SUPABASE_COMMENTS_TABLE = (app && app.tables && app.tables.comments) || "kanban_task_comments";

  const GANTT_STATUS_OPTIONS = [
    { key: "complete", label: "Complete" },
    { key: "in-progress", label: "En proceso" },
    { key: "cancelled", label: "Cancelado" },
    { key: "delayed", label: "Retraso" },
    { key: "waiting", label: "Espera" },
  ];

  const PRIORITY_OPTIONS = [
    { key: "low", label: "Baja" },
    { key: "medium", label: "Media" },
    { key: "high", label: "Alta" },
    { key: "critical", label: "Critica" },
  ];

  const WORKFLOW_STAGES = Object.freeze([
    { key: "backlog", label: "Backlog", dbStatus: "open", progress: 0 },
    { key: "open-todo", label: "Open / To Do", dbStatus: "open", progress: 15 },
    { key: "in-progress", label: "In Progress", dbStatus: "open", progress: 45 },
    { key: "blocked", label: "Blocked", dbStatus: "on-hold", progress: 10 },
    { key: "review-qa", label: "Review / QA", dbStatus: "pending-approval", progress: 70 },
    { key: "pending-approval", label: "Pending Approval", dbStatus: "pending-approval", progress: 80 },
    { key: "done", label: "Done / Complete", dbStatus: "done", progress: 100 },
  ]);
  const WORKFLOW_STAGE_SET = new Set(WORKFLOW_STAGES.map((stage) => stage.key));
  const WORKFLOW_STAGE_BY_KEY = new Map(WORKFLOW_STAGES.map((stage) => [stage.key, stage]));
  const WORKFLOW_STAGE_TOKEN = /^\[WF:(backlog|open-todo|in-progress|blocked|review-qa|pending-approval|done)\]\s*/i;
  const DB_STATUS_TO_WORKFLOW_STAGE = Object.freeze({
    open: "open-todo",
    "on-hold": "blocked",
    "pending-approval": "pending-approval",
    done: "done",
  });

  const DEPARTMENT_OPTIONS = [
    "Producto",
    "UX",
    "Backend",
    "Frontend",
    "Marketing",
    "RRHH",
    "Ventas",
    "BBDD",
    "General",
  ];

  const KANBAN_STATUS_SET = new Set(["open", "on-hold", "pending-approval", "done"]);
  const GANTT_STATUS_SET = new Set(GANTT_STATUS_OPTIONS.map((item) => item.key));
  const PRIORITY_SET = new Set(PRIORITY_OPTIONS.map((item) => item.key));

  const state = {
    supabase: null,
    tasksRealtimeChannel: null,
    linksRealtimeChannel: null,
    commentsRealtimeChannel: null,
    suppressEvents: false,
    refreshMuteUntil: 0,
    refreshTimer: null,
    bulkProjectShiftInProgress: false,
    queuedTaskSyncTimers: new Map(),
    queuedLinkSyncTimers: new Map(),
    criticalPathLinkSet: new Set(),
    activeProject: null,
    currentUser: null,
    profileRole: "user",
    mode: "user",
    projectPermission: "editor",
    canEdit: false,
    modalTaskId: null,
  };

  const isValidIsoDate = (value) =>
    utils && typeof utils.isValidIsoDate === "function"
      ? utils.isValidIsoDate(value)
      : /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

  const createLocalId = () =>
    utils && typeof utils.createLocalId === "function"
      ? utils.createLocalId()
      : (() => {
          if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
          }
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
            const random = Math.floor(Math.random() * 16);
            const safeValue = char === "x" ? random : (random & 0x3) | 0x8;
            return safeValue.toString(16);
          });
        })();

  const pauseRealtimeRefresh = (duration = 1800) => {
    const muteFor = Math.max(0, Number(duration) || 0);
    state.refreshMuteUntil = Math.max(state.refreshMuteUntil || 0, Date.now() + muteFor);
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
  };

  const isRealtimeRefreshMuted = () => (state.refreshMuteUntil || 0) > Date.now();

  const scheduleGanttReload = () => {
    if (state.bulkProjectShiftInProgress) return;
    if (isRealtimeRefreshMuted()) return;
    if (state.refreshTimer) clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      if (isRealtimeRefreshMuted()) return;
      loadAndRender();
    }, 180);
  };

  const text = (value) => String(value == null ? "" : value).trim();

  const sanitizeAssignees = (value) => {
    const source = Array.isArray(value) ? value : String(value || "").split(/[,;\n]/);
    const seen = new Set();
    return source
      .map((item) => text(item))
      .filter(Boolean)
      .filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const parseIsoDate = (isoDate) => {
    if (utils && typeof utils.parseIsoDate === "function") {
      return utils.parseIsoDate(isoDate);
    }
    if (!isValidIsoDate(isoDate)) return null;
    const [year, month, day] = String(isoDate).split("-").map(Number);
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

  const addDays = (dateValue, days) => {
    const date = new Date(dateValue);
    date.setDate(date.getDate() + days);
    return date;
  };

  const shiftIsoDateByDays = (isoValue, days) => {
    const parsed = parseIsoDate(isoValue);
    const offset = Number(days);
    if (!parsed || !Number.isFinite(offset)) return null;
    parsed.setDate(parsed.getDate() + offset);
    return toIsoDate(parsed);
  };

  const clampProgress = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
  };

  const sanitizeKanbanStatus = (status) => {
    const normalized = String(status || "").trim();
    return KANBAN_STATUS_SET.has(normalized) ? normalized : "open";
  };

  const sanitizeGanttStatus = (status) => {
    const normalized = String(status || "").trim();
    return GANTT_STATUS_SET.has(normalized) ? normalized : "in-progress";
  };

  const sanitizeDepartment = (department) => {
    const normalized = splitDepartments(department);
    return normalized.join(", ");
  };

  const sanitizePriority = (priority) => {
    const normalized = String(priority || "").trim().toLowerCase();
    return PRIORITY_SET.has(normalized) ? normalized : "medium";
  };

  const priorityLabel = (priority) => {
    const current = PRIORITY_OPTIONS.find((item) => item.key === sanitizePriority(priority));
    return current ? current.label : "Media";
  };

  const splitDepartments = (value) => {
    const values = Array.isArray(value) ? value : String(value || "").split(/[,;\n|/]+/);
    const seen = new Set();
    const result = [];
    values.forEach((part) => {
      const safe = text(part);
      if (!safe) return;
      const key = safe.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(safe);
    });
    return result.length > 0 ? result : ["General"];
  };

  const normalizeWorkflowStage = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return WORKFLOW_STAGE_SET.has(normalized) ? normalized : "open-todo";
  };

  const workflowStageToDbStatus = (stage) => {
    const current = WORKFLOW_STAGE_BY_KEY.get(normalizeWorkflowStage(stage));
    return current ? current.dbStatus : "open";
  };

  const workflowStageProgressPercent = (stage) => {
    const current = WORKFLOW_STAGE_BY_KEY.get(normalizeWorkflowStage(stage));
    return current && Number.isFinite(current.progress) ? Number(current.progress) : 0;
  };

  const dbStatusToWorkflowStage = (status) => DB_STATUS_TO_WORKFLOW_STAGE[sanitizeKanbanStatus(status)] || "open-todo";

  const stripWorkflowStageToken = (titleValue) => {
    const rawTitle = String(titleValue || "");
    const match = rawTitle.match(WORKFLOW_STAGE_TOKEN);
    if (!match) return { stage: "", cleanTitle: rawTitle };
    const stage = normalizeWorkflowStage(match[1]);
    return { stage, cleanTitle: rawTitle.slice(match[0].length).trim() };
  };

  const captureGanttOpenState = () => {
    const openByTask = new Map();
    if (!window.gantt || typeof window.gantt.eachTask !== "function") return openByTask;
    window.gantt.eachTask((task) => {
      if (!task || task.id == null) return;
      openByTask.set(String(task.id), task.$open === true);
    });
    return openByTask;
  };

  const encodeTitleWithWorkflowStage = (titleValue, stage) => {
    const safeTitle = text(titleValue) || "Sin titulo";
    return `[WF:${normalizeWorkflowStage(stage)}] ${safeTitle}`;
  };

  const sanitizeLinkType = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return 0;
    if (parsed < 0 || parsed > 3) return 0;
    return parsed;
  };

  const sanitizeLag = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return 0;
    return parsed;
  };

  const deriveGanttStatusFromKanban = (status) => {
    if (status === "done") return "complete";
    if (status === "on-hold") return "waiting";
    return "in-progress";
  };

  const resolveGanttStatus = (kanbanStatus, ganttStatus) => {
    const normalizedKanban = sanitizeKanbanStatus(kanbanStatus);
    const normalizedGantt = sanitizeGanttStatus(ganttStatus);

    if (normalizedKanban === "done" && normalizedGantt === "in-progress") {
      return "complete";
    }
    if (normalizedKanban === "on-hold" && normalizedGantt === "in-progress") {
      return "waiting";
    }
    return normalizedGantt;
  };

  const kanbanStatusLabel = (stage) => {
    const current = WORKFLOW_STAGES.find((item) => item.key === normalizeWorkflowStage(stage));
    return current ? current.label : "Open / To Do";
  };

  const ganttStatusLabel = (status) => {
    const current = GANTT_STATUS_OPTIONS.find((item) => item.key === status);
    return current ? current.label : "En proceso";
  };

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

  const coerceDateValue = (value) => {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    }

    const parsedIso = parseIsoDate(value);
    if (parsedIso) return parsedIso;

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  const getTaskEndDate = (task, endValue) => {
    const endDate = coerceDateValue(endValue);
    if (endDate) return endDate;

    const startDate = coerceDateValue(task && task.start_date);
    if (!startDate) return null;

    const duration = Math.max(1, Number(task && task.duration) || 1);
    return addDays(startDate, duration - 1);
  };

  const getTaskRiskInfo = (task, options = {}) => {
    const endDate = getTaskEndDate(task, options.endValue || (task && task.end_date));
    const ganttStatus = sanitizeGanttStatus(task && task.gantt_status);
    const kanbanStatus = sanitizeKanbanStatus(task && task.status);
    const workflowStage = normalizeWorkflowStage(task && (task.workflow_stage || dbStatusToWorkflowStage(task.status)));
    const statusForRisk = ganttStatus === "complete" || kanbanStatus === "done" || workflowStage === "done" ? "done" : kanbanStatus;
    const riskTask = {
      ...(task || {}),
      status: statusForRisk,
      end_date: endDate ? toIsoDate(endDate) || (task && task.end_date) || null : (task && task.end_date) || null,
    };

    if (utils && typeof utils.getTaskRiskInfo === "function") {
      return utils.getTaskRiskInfo(riskTask, options);
    }

    return {
      state: "no-date",
      label: "Sin fecha limite",
      detail: "Anade una fecha final para activar el semaforo.",
      daysLeft: null,
      severity: -1,
      deadlineLabel: "",
      baseState: "no-date",
      reason: "no-date",
      blockedByDependency: false,
      criticalPath: options.criticalPath === true,
      isCritical: false,
    };
  };

  const getTaskDeadlineClass = (task, endValue, options = {}) => {
    if (!task) return "";
    const riskInfo = getTaskRiskInfo(task, { ...options, endValue });
    if (!riskInfo || !riskInfo.state) return "";
    return `deadline-${riskInfo.state}`;
  };

  const formatTaskDatesText = (task) => {
    if (!task || task.unscheduled) return "Sin fechas";
    const startIso = toIsoDate(task.start_date);
    const duration = Math.max(1, Number(task.duration) || 1);
    if (!startIso) return "Sin fechas";
    const startDate = parseIsoDate(startIso);
    if (!startDate) return "Sin fechas";
    const endIso = toIsoDate(addDays(startDate, duration - 1)) || startIso;
    const riskInfo = getTaskRiskInfo(task, { endValue: task && task.end_date });
    const deadlineSuffix =
      riskInfo.state === "critical"
        ? " - CRITICA"
        : riskInfo.state === "overdue"
        ? " - ATRASADA"
        : riskInfo.state === "due-today"
          ? " - vence hoy"
          : riskInfo.state === "due-soon"
            ? " - vence pronto"
            : riskInfo.state === "done-late"
              ? " - cerrada tarde"
            : "";
    const pathSuffix = task && task.critical_path ? " - ruta critica" : "";
    if (duration <= 1 || startIso === endIso) return `${startIso}${deadlineSuffix}${pathSuffix}`;
    return `${startIso} -> ${endIso} (${duration} dias)${deadlineSuffix}${pathSuffix}`;
  };

  const resolveParentTaskText = (task) => {
    const parentId = text(task && (task.parent_task_id || task.parent));
    if (!parentId || parentId === "0") return "Sin tarea padre";
    if (!window.gantt || !window.gantt.isTaskExists || !window.gantt.isTaskExists(parentId)) return parentId;
    const parentTask = window.gantt.getTask(parentId);
    return text(parentTask && parentTask.text) || parentId;
  };

  const openTaskInfoModal = (taskId) => {
    if (!taskInfoModal || !window.gantt || !window.gantt.isTaskExists || !window.gantt.isTaskExists(taskId)) return;
    const task = window.gantt.getTask(taskId);
    if (!task) return;
    state.modalTaskId = String(task.id);

    if (taskInfoTitleText) taskInfoTitleText.textContent = text(task.text) || "Sin titulo";
    if (taskInfoId) taskInfoId.textContent = text(task.id) || "-";
    if (taskInfoKanbanStatus) {
      taskInfoKanbanStatus.textContent = kanbanStatusLabel(task.workflow_stage || dbStatusToWorkflowStage(task.status));
    }
    if (taskInfoGanttStatus) taskInfoGanttStatus.textContent = ganttStatusLabel(sanitizeGanttStatus(task.gantt_status));
    if (taskInfoDepartment) taskInfoDepartment.textContent = sanitizeDepartment(task.department);
    if (taskInfoPriority) taskInfoPriority.textContent = priorityLabel(task.priority);
    if (taskInfoDates) taskInfoDates.textContent = formatTaskDatesText(task);
    if (taskInfoAssignees) {
      const assignees = sanitizeAssignees(task.assignees);
      taskInfoAssignees.textContent = assignees.length > 0 ? assignees.join(", ") : "Sin asignar";
    }
    if (taskInfoCommentsCount) taskInfoCommentsCount.textContent = String(Number(task.comments_count || 0));
    if (taskInfoParent) taskInfoParent.textContent = resolveParentTaskText(task);
    if (taskInfoEditDatesBtn) {
      taskInfoEditDatesBtn.disabled = !state.canEdit;
      taskInfoEditDatesBtn.title = state.canEdit ? "" : "Solo lectura";
    }

    taskInfoModal.classList.remove("hidden");
    taskInfoModal.setAttribute("aria-hidden", "false");
  };

  const closeTaskInfoModal = () => {
    if (!taskInfoModal) return;
    state.modalTaskId = null;
    taskInfoModal.classList.add("hidden");
    taskInfoModal.setAttribute("aria-hidden", "true");
  };

  const openTaskDatesEditorFromModal = () => {
    if (!state.canEdit) {
      setSyncStatus("Proyecto en modo solo lectura.", "warning");
      return;
    }
    const taskId = text(state.modalTaskId);
    if (!taskId || !window.gantt || !window.gantt.isTaskExists || !window.gantt.isTaskExists(taskId)) return;
    closeTaskInfoModal();
    window.gantt.showLightbox(taskId);
  };

  const isTreeToggleClick = (event) => {
    const target = event && event.target ? event.target : null;
    if (!target || !target.closest) return false;
    if (target.closest(".gantt_tree_icon")) return true;
    if (target.closest(".gantt_open")) return true;
    if (target.closest(".gantt_close")) return true;
    if (target.closest(".gantt_folder_open")) return true;
    if (target.closest(".gantt_folder_closed")) return true;
    const className = String(target.className || "");
    return /gantt_tree_icon|gantt_open|gantt_close|gantt_folder_open|gantt_folder_closed/.test(className);
  };

  const setProjectContextText = () => {
    if (!projectContext || !state.activeProject) return;
    const permissionLabel =
      app && app.projectPermissionToLabel ? app.projectPermissionToLabel(state.projectPermission) : state.projectPermission;
    projectContext.textContent = `Proyecto: ${state.activeProject.name} | modo ${state.mode} | permiso ${permissionLabel}`;
  };

  const updateActionButtonsState = () => {
    const busy = state.bulkProjectShiftInProgress === true;

    if (refreshButton) {
      refreshButton.disabled = busy;
      refreshButton.title = busy ? "Espera a que termine el desplazamiento del proyecto." : "Recargar datos desde Supabase";
    }

    if (shiftProjectToTodayButton) {
      const canShift = state.canEdit && !busy;
      shiftProjectToTodayButton.disabled = !canShift;
      if (!state.canEdit) {
        shiftProjectToTodayButton.title = "Solo lectura";
      } else if (busy) {
        shiftProjectToTodayButton.title = "Moviendo el proyecto a hoy...";
      } else {
        shiftProjectToTodayButton.title = "Alinear el proyecto al dia de hoy";
      }
    }
  };

  const applyGanttPermission = () => {
    if (!window.gantt) return;
    window.gantt.config.readonly = !state.canEdit;
    updateActionButtonsState();
    window.gantt.render();
  };

  const updateViewLinks = () => {
    if (!app || !state.activeProject) return;
    const links = app.getProjectLinks(state.activeProject.id);

    if (mainViewLink) {
      mainViewLink.href = links.main;
    }
    if (kanbanViewLink) {
      kanbanViewLink.href = links.kanban;
    }
    if (calendarViewLink) {
      calendarViewLink.href = links.calendar;
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
    updateActionButtonsState();
    updateViewLinks();
    setProjectContextText();
    return true;
  };

  const parseDbTask = (row) => {
    const status = sanitizeKanbanStatus(row.status);
    const rawGanttStatus = row.gantt_status ? String(row.gantt_status) : deriveGanttStatusFromKanban(status);
    const ganttStatus = resolveGanttStatus(status, rawGanttStatus);
    const tokenInfo = stripWorkflowStageToken(row.title);
    const workflowStage = tokenInfo.stage || dbStatusToWorkflowStage(status);

    return {
      id: String(row.id || createLocalId()),
      title: String(tokenInfo.cleanTitle || row.title || "").trim() || "Sin titulo",
      status,
      workflow_stage: workflowStage,
      gantt_status: ganttStatus,
      department: sanitizeDepartment(row.department),
      priority: sanitizePriority(row.priority),
      parent_task_id: row.parent_task_id ? String(row.parent_task_id) : null,
      progress: ganttStatus === "complete" ? 1 : clampProgress(row.progress),
      assignees: sanitizeAssignees(row.assignees),
    };
  };

  const parseDbLink = (row) => ({
    id: String(row.id || createLocalId()),
    source: String(row.source_id || ""),
    target: String(row.target_id || ""),
    type: sanitizeLinkType(row.link_type),
    lag: sanitizeLag(row.lag),
    start_date: isValidIsoDate(row.start_date) ? String(row.start_date) : null,
    end_date: isValidIsoDate(row.end_date) ? String(row.end_date) : null,
  });

  const fetchTasksAndLinks = async () => {
    const [tasksResult, linksResult, commentsResult] = await Promise.all([
      state.supabase
        .from(SUPABASE_TABLE)
        .select("id,title,department,status,gantt_status,priority,parent_task_id,progress,assignees,created_at")
        .eq("project_id", state.activeProject.id)
        .order("created_at", { ascending: true }),
      state.supabase
        .from(SUPABASE_LINKS_TABLE)
        .select("id,source_id,target_id,link_type,lag,start_date,end_date,created_at")
        .eq("project_id", state.activeProject.id)
        .order("created_at", { ascending: true }),
      state.supabase
        .from(SUPABASE_COMMENTS_TABLE)
        .select("task_id")
        .eq("project_id", state.activeProject.id),
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (linksResult.error) throw linksResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const commentsByTask = new Map();
    (commentsResult.data || []).forEach((row) => {
      const taskId = String(row.task_id || "");
      if (!taskId) return;
      commentsByTask.set(taskId, (commentsByTask.get(taskId) || 0) + 1);
    });

    return {
      tasks: (tasksResult.data || []).map((task) => parseDbTask(task)),
      links: (linksResult.data || []).map((link) => parseDbLink(link)),
      commentsByTask,
    };
  };

  const buildScheduleByTaskMap = (links) => {
    const map = new Map();
    links.forEach((link) => {
      if (!link.source || !link.target) return;
      if (link.source !== link.target) return;

      const start = link.start_date || link.end_date;
      const end = link.end_date || link.start_date;
      if (!start || !end) return;

      const normalizedEnd = end < start ? start : end;
      map.set(link.source, { start, end: normalizedEnd });
    });
    return map;
  };

  const buildChildrenByParentMap = (tasks) => {
    const map = new Map();
    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      const parentId = text(task && task.parent_task_id);
      const taskId = text(task && task.id);
      if (!parentId || !taskId || parentId === taskId) return;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(taskId);
    });
    return map;
  };

  const buildEffectiveScheduleByTask = (tasks, explicitScheduleByTask, childrenByParent) => {
    const taskIds = new Set((Array.isArray(tasks) ? tasks : []).map((task) => String(task.id || "")));
    const memo = new Map();
    const active = new Set();

    const resolve = (taskId) => {
      const safeTaskId = String(taskId || "");
      if (!safeTaskId || !taskIds.has(safeTaskId)) return null;
      if (memo.has(safeTaskId)) return memo.get(safeTaskId);
      if (active.has(safeTaskId)) return null;

      active.add(safeTaskId);

      const own = explicitScheduleByTask.get(safeTaskId);
      let start = own && isValidIsoDate(own.start) ? own.start : null;
      let end = own && isValidIsoDate(own.end) ? own.end : null;
      if (start && end && end < start) end = start;

      const children = childrenByParent.get(safeTaskId) || [];
      children.forEach((childId) => {
        const childSchedule = resolve(childId);
        if (!childSchedule) return;
        if (!start || childSchedule.start < start) start = childSchedule.start;
        if (!end || childSchedule.end > end) end = childSchedule.end;
      });

      const result = start && end ? { start, end } : null;
      memo.set(safeTaskId, result);
      active.delete(safeTaskId);
      return result;
    };

    taskIds.forEach((taskId) => {
      resolve(taskId);
    });

    const effective = new Map();
    memo.forEach((value, taskId) => {
      if (value) effective.set(taskId, value);
    });
    return effective;
  };

  const buildDependencyGraph = (links, visibleTaskIds) => {
    const dependencyLinks = [];
    const predecessorsByTask = new Map();
    const successorsByTask = new Map();

    (Array.isArray(links) ? links : [])
      .filter((link) => link.source && link.target && link.source !== link.target)
      .filter((link) => visibleTaskIds.has(link.source) && visibleTaskIds.has(link.target))
      .forEach((link) => {
        const dependencyLink = {
          id: link.id,
          source: link.source,
          target: link.target,
          type: link.type,
          lag: link.lag,
        };
        dependencyLinks.push(dependencyLink);

        if (!predecessorsByTask.has(link.target)) predecessorsByTask.set(link.target, new Set());
        predecessorsByTask.get(link.target).add(link.source);

        if (!successorsByTask.has(link.source)) successorsByTask.set(link.source, new Set());
        successorsByTask.get(link.source).add(link.target);
      });

    return { dependencyLinks, predecessorsByTask, successorsByTask };
  };

  const buildGanttRiskContext = (tasks, dependencyGraph) => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const todayIso = utils && typeof utils.getTodayIso === "function" ? utils.getTodayIso() : toIsoDate(new Date());
    const riskByTaskId = new Map();
    const taskById = new Map();

    safeTasks.forEach((task) => {
      const taskId = String(task && task.id ? task.id : "");
      if (!taskId) return;
      taskById.set(taskId, task);
      riskByTaskId.set(taskId, getTaskRiskInfo(task, { todayIso }));
    });

    const taskIds = [...taskById.keys()];
    const maxPasses = Math.max(1, taskIds.length);

    for (let pass = 0; pass < maxPasses; pass += 1) {
      let changed = false;

      taskIds.forEach((taskId) => {
        const task = taskById.get(taskId);
        if (!task) return;

        const predecessors = dependencyGraph && dependencyGraph.predecessorsByTask
          ? dependencyGraph.predecessorsByTask.get(taskId)
          : null;
        const blockedByDependency = !!(predecessors && [...predecessors].some((predecessorId) => {
          const predecessorInfo = riskByTaskId.get(predecessorId);
          return predecessorInfo && (predecessorInfo.state === "critical" || predecessorInfo.state === "overdue");
        }));

        const currentInfo = riskByTaskId.get(taskId) || getTaskRiskInfo(task, { todayIso });
        const nextInfo = getTaskRiskInfo(task, { todayIso, blockedByDependency });
        if (nextInfo.state !== currentInfo.state || nextInfo.blockedByDependency !== currentInfo.blockedByDependency) {
          riskByTaskId.set(taskId, nextInfo);
          changed = true;
        }
      });

      if (!changed) break;
    }

    const criticalPathSet = new Set();
    const stack = [];
    taskIds.forEach((taskId) => {
      const info = riskByTaskId.get(taskId);
      if (info && (info.state === "critical" || info.state === "overdue")) {
        stack.push(taskId);
      }
    });

    while (stack.length > 0) {
      const taskId = stack.pop();
      if (!taskId || criticalPathSet.has(taskId)) continue;
      criticalPathSet.add(taskId);

      const predecessors =
        dependencyGraph && dependencyGraph.predecessorsByTask ? dependencyGraph.predecessorsByTask.get(taskId) : null;
      const successors =
        dependencyGraph && dependencyGraph.successorsByTask ? dependencyGraph.successorsByTask.get(taskId) : null;

      if (predecessors) {
        predecessors.forEach((predecessorId) => {
          if (!criticalPathSet.has(predecessorId)) stack.push(predecessorId);
        });
      }

      if (successors) {
        successors.forEach((successorId) => {
          if (!criticalPathSet.has(successorId)) stack.push(successorId);
        });
      }
    }

    const criticalLinkSet = new Set();
    (dependencyGraph && Array.isArray(dependencyGraph.dependencyLinks) ? dependencyGraph.dependencyLinks : []).forEach(
      (link) => {
        if (criticalPathSet.has(link.source) && criticalPathSet.has(link.target)) {
          criticalLinkSet.add(`${link.source}->${link.target}`);
        }
      }
    );

    return {
      todayIso,
      riskByTaskId,
      criticalPathSet,
      criticalLinkSet,
    };
  };

  const getProjectShiftContext = (tasks, links) => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeLinks = Array.isArray(links) ? links : [];
    const explicitScheduleByTask = buildScheduleByTaskMap(safeLinks);
    const childrenByParent = buildChildrenByParentMap(safeTasks);
    const effectiveScheduleByTask = buildEffectiveScheduleByTask(safeTasks, explicitScheduleByTask, childrenByParent);
    const scheduleEntries = [...effectiveScheduleByTask.values()].filter(
      (schedule) => schedule && isValidIsoDate(schedule.start)
    );

    if (scheduleEntries.length === 0) return null;

    const earliestStart = scheduleEntries.reduce((earliest, schedule) => {
      if (!earliest) return schedule.start;
      return schedule.start < earliest ? schedule.start : earliest;
    }, "");

    const todayIso =
      (utils && typeof utils.getTodayIso === "function" ? utils.getTodayIso() : toIsoDate(new Date())) ||
      toIsoDate(new Date());
    const shiftDays = utils && typeof utils.diffIsoDays === "function" ? utils.diffIsoDays(earliestStart, todayIso) : null;
    if (shiftDays == null) return null;

    return {
      earliestStart,
      todayIso,
      shiftDays,
      scheduleRows: safeLinks.filter(
        (link) =>
          String(link && link.source ? link.source : "") === String(link && link.target ? link.target : "") &&
          isValidIsoDate(link && link.start_date) &&
          isValidIsoDate(link && link.end_date)
      ),
    };
  };

  const mapTaskToGantt = (
    task,
    scheduleByTask,
    visibleTaskIds,
    commentsByTask,
    childrenByParent,
    openStateByTask
  ) => {
    const schedule = scheduleByTask.get(task.id);
    const parentId =
      task.parent_task_id && visibleTaskIds.has(task.parent_task_id) ? String(task.parent_task_id) : 0;

    const baseTask = {
      id: task.id,
      text: task.title,
      progress: task.progress,
      status: task.status,
      workflow_stage: task.workflow_stage || dbStatusToWorkflowStage(task.status),
      gantt_status: task.gantt_status,
      department: task.department,
      priority: task.priority,
      parent_task_id: task.parent_task_id,
      parent: parentId,
      comments_count: Number(commentsByTask.get(task.id) || 0),
      assignees: sanitizeAssignees(task.assignees),
      type: "task",
      open: openStateByTask ? openStateByTask.get(String(task.id)) === true : false,
    };

    if (!schedule) {
      return {
        ...baseTask,
        start_date: toIsoDate(new Date()),
        duration: 1,
        unscheduled: true,
      };
    }

    const startDate = parseIsoDate(schedule.start);
    const endDate = parseIsoDate(schedule.end);
    if (!startDate || !endDate) {
      return {
        ...baseTask,
        start_date: toIsoDate(new Date()),
        duration: 1,
        unscheduled: true,
      };
    }

    const normalizedEnd = endDate < startDate ? startDate : endDate;
    const duration = Math.max(
      1,
      Math.round((normalizedEnd.getTime() - startDate.getTime()) / 86400000) + 1
    );

    return {
      ...baseTask,
      start_date: toIsoDate(startDate),
      duration,
      unscheduled: false,
    };
  };

  const updateCounters = (tasks, scheduleByTask, riskContext = null) => {
    const total = tasks.length;
    const scheduled = tasks.filter((task) => scheduleByTask.has(task.id)).length;
    const unscheduled = total - scheduled;
    const criticalPathCount =
      riskContext && riskContext.criticalPathSet ? riskContext.criticalPathSet.size : 0;

    if (totalTasksEl) totalTasksEl.textContent = String(total);
    if (scheduledTasksEl) scheduledTasksEl.textContent = String(scheduled);
    if (unscheduledTasksEl) unscheduledTasksEl.textContent = String(unscheduled);
    if (criticalPathTasksEl) criticalPathTasksEl.textContent = String(criticalPathCount);
  };

  const buildGanttData = (tasks, scheduleByTask, commentsByTask, childrenByParent, openStateByTask) => {
    const visibleTaskIds = new Set(tasks.map((task) => String(task.id)));
    return tasks
      .map((task) =>
        mapTaskToGantt(task, scheduleByTask, visibleTaskIds, commentsByTask, childrenByParent, openStateByTask)
      )
      .filter((task) => !!task);
  };

  const buildTaskPayloadFromGanttTask = (task) => {
    const workflowStage = normalizeWorkflowStage(task.workflow_stage || task.status);
    const status = workflowStageToDbStatus(workflowStage);
    const resolvedGanttStatus = resolveGanttStatus(status, task.gantt_status);
    const normalizedParent = String(task.parent || "").trim();
    const parentTaskId = normalizedParent && normalizedParent !== "0" ? normalizedParent : null;
    return {
      title: encodeTitleWithWorkflowStage(stripWorkflowStageToken(task.text).cleanTitle, workflowStage),
      status,
      gantt_status: resolvedGanttStatus,
      department: sanitizeDepartment(task.department),
      priority: sanitizePriority(task.priority),
      parent_task_id: parentTaskId,
      progress: resolvedGanttStatus === "complete" ? 1 : clampProgress(task.progress),
      project_id: state.activeProject ? state.activeProject.id : null,
    };
  };

  const buildSchedulePayloadFromGanttTask = (task) => {
    if (task && task.unscheduled) return null;
    const startDate = new Date(task.start_date);
    if (Number.isNaN(startDate.getTime())) return null;
    const duration = Math.max(1, Number(task.duration) || 1);
    const endDate = addDays(startDate, duration - 1);
    const startIso = toIsoDate(startDate);
    const endIso = toIsoDate(endDate);
    if (!startIso || !endIso) return null;
    return {
      start_date: startIso,
      end_date: endIso,
    };
  };

  const buildDependencyPayloadFromGanttLink = (link) => ({
    source_id: String(link.source || ""),
    target_id: String(link.target || ""),
    project_id: state.activeProject ? state.activeProject.id : null,
    link_type: sanitizeLinkType(link.type),
    lag: sanitizeLag(link.lag),
    start_date: null,
    end_date: null,
  });

  const canSetTaskToDone = async (taskId, nextStatus) => {
    if (sanitizeKanbanStatus(nextStatus) !== "done") return true;
    const { data, error } = await state.supabase
      .from(SUPABASE_TABLE)
      .select("id")
      .eq("project_id", state.activeProject.id)
      .eq("parent_task_id", String(taskId))
      .neq("status", "done")
      .limit(1);
    if (error) throw error;
    return !Array.isArray(data) || data.length === 0;
  };

  const upsertTaskSchedule = async (taskId, schedulePayload) => {
    const { error } = await state.supabase.from(SUPABASE_LINKS_TABLE).upsert(
      {
        source_id: taskId,
        target_id: taskId,
        project_id: state.activeProject.id,
        link_type: 0,
        lag: 0,
        start_date: schedulePayload.start_date,
        end_date: schedulePayload.end_date,
      },
      { onConflict: "project_id,source_id,target_id,link_type" }
    );

    if (error) throw error;
  };

  const deleteTaskSchedule = async (taskId) => {
    const { error } = await state.supabase
      .from(SUPABASE_LINKS_TABLE)
      .delete()
      .eq("project_id", state.activeProject.id)
      .eq("source_id", String(taskId))
      .eq("target_id", String(taskId))
      .eq("link_type", 0);

    if (error) throw error;
  };

  const moveProjectToToday = async () => {
    if (!state.supabase || !state.activeProject) return;
    if (!state.canEdit) {
      setSyncStatus("Proyecto en modo solo lectura.", "warning");
      return;
    }
    if (state.bulkProjectShiftInProgress) return;

    try {
      const { tasks, links } = await fetchTasksAndLinks();
      const shiftContext = getProjectShiftContext(tasks, links);

      if (!shiftContext) {
        setSyncStatus("No hay tareas con fechas para mover.", "warning");
        return;
      }

      if (shiftContext.shiftDays === 0) {
        setSyncStatus(`El proyecto ya empieza hoy (${shiftContext.todayIso}).`, "success");
        return;
      }

      const shouldMove = window.confirm(
        `Voy a mover el proyecto para que la primera tarea con fecha empiece hoy (${shiftContext.todayIso}). Las duraciones se mantendran. Deseas continuar?`
      );
      if (!shouldMove) return;

      state.bulkProjectShiftInProgress = true;
      updateActionButtonsState();
      pauseRealtimeRefresh(12000);
      setSyncStatus("Moviendo el proyecto a hoy...", "info");

      const rowsToShift = shiftContext.scheduleRows
        .map((link) => {
          const startDate = parseIsoDate(link.start_date);
          const endDate = parseIsoDate(link.end_date);
          if (!startDate || !endDate) return null;

          const normalizedEnd = endDate < startDate ? startDate : endDate;
          const nextStart = shiftIsoDateByDays(toIsoDate(startDate), shiftContext.shiftDays);
          const nextEnd = shiftIsoDateByDays(toIsoDate(normalizedEnd), shiftContext.shiftDays);
          if (!nextStart || !nextEnd) return null;

          return {
            sourceId: String(link.source || ""),
            targetId: String(link.target || ""),
            start_date: nextStart,
            end_date: nextEnd,
          };
        })
        .filter((row) => !!row.sourceId && !!row.targetId);

      if (rowsToShift.length === 0) {
        setSyncStatus("No se encontraron enlaces de calendario validos para desplazar.", "warning");
        return;
      }

      let updatedCount = 0;
      for (const row of rowsToShift) {
        const { error } = await state.supabase
          .from(SUPABASE_LINKS_TABLE)
          .update({
            start_date: row.start_date,
            end_date: row.end_date,
          })
          .eq("project_id", state.activeProject.id)
          .eq("source_id", row.sourceId)
          .eq("target_id", row.targetId);

        if (error) throw error;
        updatedCount += 1;
      }

      await loadAndRender();
      setSyncStatus(`Proyecto movido a hoy (${shiftContext.todayIso}). ${updatedCount} fechas reajustadas.`, "success");
    } catch (error) {
      console.error(error);
      try {
        await loadAndRender();
      } catch (reloadError) {
        console.error(reloadError);
      }
      setSyncStatus("No se pudo mover el proyecto a hoy.", "error");
    } finally {
      state.bulkProjectShiftInProgress = false;
      updateActionButtonsState();
    }
  };

  const initGanttUi = () => {
    if (!window.gantt) {
      throw new Error("DHTMLX Gantt no esta disponible.");
    }

    window.gantt.config.date_format = "%Y-%m-%d";
    window.gantt.config.grid_width = 980;
    window.gantt.config.autosize = false;
    window.gantt.config.show_progress = true;
    window.gantt.config.show_unscheduled = true;
    window.gantt.config.drag_progress = true;
    window.gantt.config.drag_move = true;
    window.gantt.config.drag_resize = true;
    window.gantt.config.details_on_create = true;
    window.gantt.config.details_on_dblclick = true;
    window.gantt.config.open_tree_initially = false;
    window.gantt.config.scroll_on_click = false;
    window.gantt.config.preserve_scroll = true;

    window.gantt.locale.labels.section_description = "Titulo";
    window.gantt.locale.labels.section_gantt_status = "Estado Gantt";
    window.gantt.locale.labels.section_workflow_stage = "Estado Kanban";
    window.gantt.locale.labels.section_priority = "Prioridad";
    window.gantt.locale.labels.section_department = "Departamento";
    window.gantt.locale.labels.section_time = "Fechas";

    window.gantt.form_blocks = window.gantt.form_blocks || {};
    window.gantt.form_blocks.department_checklist = {
      render: (sns) => {
        const height = Math.max(120, Number(sns && sns.height) || 152);
        const options = DEPARTMENT_OPTIONS.map(
          (department) =>
            `<label class="gantt-department-option"><input type="checkbox" value="${department}"><span>${department}</span></label>`
        ).join("");
        return `<div class="gantt-department-checklist" role="group" aria-label="Seleccion de departamentos" style="height:${height}px;">${options}</div>`;
      },
      set_value: (node, value) => {
        if (!node) return;
        const selected = new Set(splitDepartments(value).map((department) => department.toLowerCase()));
        const checkboxes = [...node.querySelectorAll('input[type="checkbox"]')];
        let hasSelection = false;
        checkboxes.forEach((checkbox) => {
          const isSelected = selected.has(String(checkbox.value || "").toLowerCase());
          checkbox.checked = isSelected;
          hasSelection = hasSelection || isSelected;
        });
        if (!hasSelection) {
          const fallback = checkboxes.find((checkbox) => String(checkbox.value || "").toLowerCase() === "general") || checkboxes[0];
          if (fallback) fallback.checked = true;
        }
      },
      get_value: (node) => {
        if (!node) return "General";
        const values = [...node.querySelectorAll('input[type="checkbox"]:checked')]
          .map((checkbox) => String(checkbox.value || "").trim())
          .filter(Boolean);
        return values.length > 0 ? values.join(", ") : "General";
      },
      focus: (node) => {
        if (!node) return;
        const first = node.querySelector('input[type="checkbox"]');
        if (first) first.focus();
      },
    };

    const getGanttTaskClassNames = (task, endValue) => {
      const classes = [`state-${sanitizeGanttStatus(task && task.gantt_status)}`];
      const riskInfo = task && task.risk_state ? { state: task.risk_state } : getTaskRiskInfo(task, { endValue });
      if (riskInfo && riskInfo.state) classes.push(`deadline-${riskInfo.state}`);
      if (task && task.unscheduled) classes.push("is-unscheduled");
      if (task && task.critical_path) classes.push("is-critical-path");
      if (task && task.blocked_by_dependency) classes.push("is-risk-blocked");
      return classes.join(" ");
    };

    window.gantt.templates.task_class = (_start, _end, task) => {
      return getGanttTaskClassNames(task, _end);
    };

    window.gantt.templates.task_row_class = (_start, _end, task) => getGanttTaskClassNames(task, _end);
    window.gantt.templates.grid_row_class = (_start, _end, task) => getGanttTaskClassNames(task, _end);
    window.gantt.templates.link_class = (a, b, c) => {
      const link = c && typeof c === "object" ? c : b && typeof b === "object" ? b : a && typeof a === "object" ? a : null;
      const key = `${String(link && link.source ? link.source : "")}->${String(link && link.target ? link.target : "")}`;
      return state.criticalPathLinkSet && state.criticalPathLinkSet.has(key) ? "critical-path-link" : "";
    };

    window.gantt.config.lightbox.sections = [
      { name: "description", height: 50, map_to: "text", type: "textarea", focus: true },
      {
        name: "gantt_status",
        height: 26,
        map_to: "gantt_status",
        type: "select",
        options: GANTT_STATUS_OPTIONS.map((item) => ({ key: item.key, label: item.label })),
      },
      {
        name: "workflow_stage",
        height: 26,
        map_to: "workflow_stage",
        type: "select",
        options: WORKFLOW_STAGES.map((item) => ({ key: item.key, label: item.label })),
      },
      {
        name: "priority",
        height: 26,
        map_to: "priority",
        type: "select",
        options: PRIORITY_OPTIONS.map((item) => ({ key: item.key, label: item.label })),
      },
      {
        name: "department",
        height: 152,
        map_to: "department",
        type: "department_checklist",
      },
      { name: "time", type: "duration", map_to: "auto" },
    ];

    window.gantt.config.columns = [
      { name: "text", label: "Tarea", tree: true, width: "*" },
      {
        name: "gantt_status",
        label: "Estado",
        align: "center",
        width: 120,
        template: (task) => {
          const status = sanitizeGanttStatus(task.gantt_status);
          return `<span class="status-pill status-${status}">${ganttStatusLabel(status)}</span>`;
        },
      },
      {
        name: "status",
        label: "Estado Kanban",
        align: "center",
        width: 120,
        template: (task) => kanbanStatusLabel(task.workflow_stage || dbStatusToWorkflowStage(task.status)),
      },
      {
        name: "department",
        label: "Depto",
        align: "center",
        width: 96,
        template: (task) => sanitizeDepartment(task.department),
      },
      {
        name: "priority",
        label: "Prioridad",
        align: "center",
        width: 96,
        template: (task) => priorityLabel(task.priority),
      },
      {
        name: "comments_count",
        label: "Comments",
        align: "center",
        width: 80,
        template: (task) => String(Number(task.comments_count || 0)),
      },
      {
        name: "start_date",
        label: "Inicio",
        align: "center",
        width: 96,
        template: (task) => {
          if (task && task.unscheduled) return "-";
          const safe = toIsoDate(task && task.start_date);
          return safe || "-";
        },
      },
      {
        name: "duration",
        label: "Dias",
        align: "center",
        width: 72,
        template: (task) => (task && task.unscheduled ? "-" : String(Math.max(1, Number(task.duration) || 1))),
      },
      { name: "add", width: 44 },
    ];

    window.gantt.init("ganttHere");
  };

  const queueTaskSync = (id) => {
    if (state.suppressEvents) return;
    pauseRealtimeRefresh();
    const currentTask = window.gantt.getTask(id);
    if (!currentTask) return;

    const existingTimer = state.queuedTaskSyncTimers.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      state.queuedTaskSyncTimers.delete(id);
      try {
        const task = window.gantt.getTask(id);
        if (!task) return;

        const taskPayload = buildTaskPayloadFromGanttTask(task);
        const canComplete = await canSetTaskToDone(id, taskPayload.status);
        if (!canComplete) {
          setSyncStatus("No puedes completar una tarea padre si tiene hijas pendientes.", "warning");
          await loadAndRender();
          return;
        }
        const schedulePayload = buildSchedulePayloadFromGanttTask(task);

        if (
          Number(task.progress) !== Number(taskPayload.progress) ||
          String(task.gantt_status || "") !== taskPayload.gantt_status
        ) {
          state.suppressEvents = true;
          task.progress = taskPayload.progress;
          task.gantt_status = taskPayload.gantt_status;
          window.gantt.updateTask(id);
          state.suppressEvents = false;
        }

        const { error } = await state.supabase
          .from(SUPABASE_TABLE)
          .update(taskPayload)
          .eq("id", String(id))
          .eq("project_id", state.activeProject.id);
        if (error) throw error;
        if (schedulePayload) {
          await upsertTaskSchedule(String(id), schedulePayload);
        } else {
          await deleteTaskSchedule(String(id));
        }
        setSyncStatus("Cambios en Gantt sincronizados.", "success");
      } catch (error) {
        console.error(error);
        setSyncStatus("No se pudo sincronizar una tarea de Gantt.", "error");
      }
    }, 140);

    state.queuedTaskSyncTimers.set(id, timer);
  };

  const queueLinkSync = (id) => {
    if (state.suppressEvents) return;
    pauseRealtimeRefresh();
    const existingTimer = state.queuedLinkSyncTimers.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      state.queuedLinkSyncTimers.delete(id);
      try {
        const link = window.gantt.getLink(id);
        if (!link) return;
        if (String(link.source) === String(link.target)) return;

        const payload = buildDependencyPayloadFromGanttLink(link);
        const { error } = await state.supabase
          .from(SUPABASE_LINKS_TABLE)
          .update(payload)
          .eq("id", String(id))
          .eq("project_id", state.activeProject.id);
        if (error) throw error;
        setSyncStatus("Dependencia actualizada.", "success");
      } catch (error) {
        console.error(error);
        setSyncStatus("No se pudo actualizar una dependencia.", "error");
      }
    }, 140);

    state.queuedLinkSyncTimers.set(id, timer);
  };

  const attachGanttEvents = () => {
    window.gantt.attachEvent("onTaskClick", (id, event) => {
      if (isTreeToggleClick(event)) return true;
      openTaskInfoModal(String(id));
      return true;
    });

    window.gantt.attachEvent("onTaskCreated", (task) => {
      if (!state.canEdit) return false;
      task.id = createLocalId();
      task.status = "open";
      task.workflow_stage = "open-todo";
      task.gantt_status = "in-progress";
      task.department = "General";
      task.priority = "medium";
      task.parent = task.parent || 0;
      task.progress = workflowStageProgressPercent(task.workflow_stage) / 100;
      return true;
    });

    window.gantt.attachEvent("onAfterTaskAdd", (id) => {
      if (!state.canEdit) return;
      if (state.suppressEvents) return;
      pauseRealtimeRefresh();
      const task = window.gantt.getTask(id);
      if (!task) return;

      const taskPayload = buildTaskPayloadFromGanttTask(task);
      const schedulePayload = buildSchedulePayloadFromGanttTask(task);

      state.supabase
        .from(SUPABASE_TABLE)
        .insert({
          id: String(id),
          title: taskPayload.title,
          status: taskPayload.status,
          gantt_status: taskPayload.gantt_status,
          department: taskPayload.department,
          priority: taskPayload.priority,
          parent_task_id: taskPayload.parent_task_id,
          progress: taskPayload.progress,
          project_id: state.activeProject.id,
        })
        .then(async ({ error }) => {
          if (error) throw error;
          if (schedulePayload) {
            await upsertTaskSchedule(String(id), schedulePayload);
          }
          setSyncStatus("Tarea creada desde Gantt.", "success");
        })
        .catch((error) => {
          console.error(error);
          setSyncStatus("No se pudo crear la tarea en Supabase.", "error");
          state.suppressEvents = true;
          window.gantt.deleteTask(id);
          state.suppressEvents = false;
        });
    });

    window.gantt.attachEvent("onAfterTaskUpdate", (id) => {
      if (!state.canEdit) return;
      queueTaskSync(id);
    });

    window.gantt.attachEvent("onAfterTaskDrag", (id) => {
      if (!state.canEdit) return;
      queueTaskSync(id);
    });

    window.gantt.attachEvent("onAfterTaskDelete", (id) => {
      if (!state.canEdit) return;
      if (state.suppressEvents) return;
      pauseRealtimeRefresh();
      state.supabase
        .from(SUPABASE_TABLE)
        .delete()
        .eq("id", String(id))
        .eq("project_id", state.activeProject.id)
        .then(({ error }) => {
          if (error) throw error;
          setSyncStatus("Tarea eliminada desde Gantt.", "success");
        })
        .catch((error) => {
          console.error(error);
          setSyncStatus("No se pudo eliminar la tarea en Supabase.", "error");
        });
    });

    window.gantt.attachEvent("onLinkCreated", (link) => {
      if (!state.canEdit) return false;
      if (String(link.source) === String(link.target)) {
        return false;
      }
      link.id = createLocalId();
      return true;
    });

    window.gantt.attachEvent("onAfterLinkAdd", (id) => {
      if (!state.canEdit) return;
      if (state.suppressEvents) return;
      pauseRealtimeRefresh();
      const link = window.gantt.getLink(id);
      if (!link) return;
      if (String(link.source) === String(link.target)) return;

      const payload = buildDependencyPayloadFromGanttLink(link);
      state.supabase
        .from(SUPABASE_LINKS_TABLE)
        .insert({
          id: String(id),
          ...payload,
        })
        .then(({ error }) => {
          if (error) throw error;
          setSyncStatus("Dependencia guardada en Supabase.", "success");
        })
        .catch((error) => {
          console.error(error);
          setSyncStatus("No se pudo guardar la dependencia.", "error");
          state.suppressEvents = true;
          window.gantt.deleteLink(id);
          state.suppressEvents = false;
        });
    });

    window.gantt.attachEvent("onAfterLinkUpdate", (id) => {
      if (!state.canEdit) return;
      queueLinkSync(id);
    });

    window.gantt.attachEvent("onAfterLinkDelete", (id) => {
      if (!state.canEdit) return;
      if (state.suppressEvents) return;
      pauseRealtimeRefresh();
      state.supabase
        .from(SUPABASE_LINKS_TABLE)
        .delete()
        .eq("id", String(id))
        .eq("project_id", state.activeProject.id)
        .then(({ error }) => {
          if (error) throw error;
          setSyncStatus("Dependencia eliminada.", "success");
        })
        .catch((error) => {
          console.error(error);
          setSyncStatus("No se pudo eliminar la dependencia.", "error");
        });
    });
  };

  const loadAndRender = async () => {
    if (!state.supabase) return;
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
    closeTaskInfoModal();
    state.criticalPathLinkSet = new Set();
    setSyncStatus("Sincronizando Gantt...", "info");

    try {
      const { tasks, links, commentsByTask } = await fetchTasksAndLinks();
      const previousScroll = captureGanttScrollState();
      const previousOpenState = captureGanttOpenState();
      const explicitScheduleByTask = buildScheduleByTaskMap(links);
      const childrenByParent = buildChildrenByParentMap(tasks);
      const effectiveScheduleByTask = buildEffectiveScheduleByTask(tasks, explicitScheduleByTask, childrenByParent);
      const ganttTasks = buildGanttData(
        tasks,
        effectiveScheduleByTask,
        commentsByTask,
        childrenByParent,
        previousOpenState
      );

      const visibleTaskIds = new Set(ganttTasks.map((task) => String(task.id)));
      const dependencyGraph = buildDependencyGraph(links, visibleTaskIds);
      const riskContext = buildGanttRiskContext(ganttTasks, dependencyGraph);
      const ganttData = ganttTasks.map((task) => {
        const taskId = String(task.id || "");
        const riskInfo = riskContext.riskByTaskId.get(taskId) || getTaskRiskInfo(task, { todayIso: riskContext.todayIso });
        return {
          ...task,
          risk_state: riskInfo.state,
          risk_label: riskInfo.label,
          risk_detail: riskInfo.detail,
          risk_reason: riskInfo.reason,
          risk_severity: riskInfo.severity,
          blocked_by_dependency: riskInfo.blockedByDependency === true,
          critical_path: riskContext.criticalPathSet.has(taskId),
        };
      });

      state.criticalPathLinkSet = riskContext.criticalLinkSet;
      updateCounters(tasks, effectiveScheduleByTask, riskContext);

      state.suppressEvents = true;
      try {
        window.gantt.clearAll();
        window.gantt.parse({ data: ganttData, links: dependencyGraph.dependencyLinks });
      } finally {
        state.suppressEvents = false;
      }
      restoreGanttScrollState(previousScroll);

      if (state.canEdit) {
        setSyncStatus("Gantt actualizado desde Supabase.", "success");
      } else {
        setSyncStatus("Gantt en modo solo lectura.", "warning");
      }
    } catch (error) {
      console.error(error);
      setSyncStatus("No se pudo leer Supabase. Revisa sesion, tablas y politicas RLS.", "error");
    }
  };

  const captureGanttScrollState = () => {
    if (!window.gantt || typeof window.gantt.getScrollState !== "function") return null;
    const stateValue = window.gantt.getScrollState();
    if (!stateValue || (stateValue.x == null && stateValue.y == null)) return null;
    return {
      x: Number.isFinite(Number(stateValue.x)) ? Number(stateValue.x) : 0,
      y: Number.isFinite(Number(stateValue.y)) ? Number(stateValue.y) : 0,
    };
  };

  const restoreGanttScrollState = (scrollState) => {
    if (!scrollState || !window.gantt || typeof window.gantt.scrollTo !== "function") return;
    const applyScroll = () => window.gantt.scrollTo(scrollState.x, scrollState.y);
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(applyScroll);
      return;
    }
    window.setTimeout(applyScroll, 0);
  };

  const startRealtime = () => {
    if (!state.supabase || !state.activeProject) return;

    if (!state.tasksRealtimeChannel) {
      state.tasksRealtimeChannel = state.supabase
        .channel(`kanban-gantt-tasks-sync-${state.activeProject.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: SUPABASE_TABLE,
            filter: `project_id=eq.${state.activeProject.id}`,
          },
          () => {
            scheduleGanttReload();
          }
        )
        .subscribe();
    }

    if (!state.linksRealtimeChannel) {
      state.linksRealtimeChannel = state.supabase
        .channel(`kanban-gantt-links-sync-${state.activeProject.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: SUPABASE_LINKS_TABLE,
            filter: `project_id=eq.${state.activeProject.id}`,
          },
          () => {
            scheduleGanttReload();
          }
        )
        .subscribe();
    }

    if (!state.commentsRealtimeChannel) {
      state.commentsRealtimeChannel = state.supabase
        .channel(`kanban-gantt-comments-sync-${state.activeProject.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: SUPABASE_COMMENTS_TABLE,
            filter: `project_id=eq.${state.activeProject.id}`,
          },
          () => {
            scheduleGanttReload();
          }
        )
        .subscribe();
    }
  };

  const init = async () => {
    const hasConfig = !!app && app.hasSupabaseConfig();

    try {
      initGanttUi();
      applyGanttPermission();
      if (hasConfig) {
        attachGanttEvents();
      }
    } catch (error) {
      console.error(error);
      setSyncStatus("No se pudo iniciar DHTMLX Gantt.", "error");
      return;
    }

    if (!hasConfig) {
      setSyncStatus("Configura .env para activar la vista compartida.", "warning");
      updateCounters([], new Map());
      return;
    }

    try {
      state.supabase = app.createSupabaseClient();
      if (!state.supabase) {
        setSyncStatus("No se pudo crear el cliente de Supabase.", "error");
        return;
      }

      const canContinue = await initializeAccessContext();
      if (!canContinue) return;

      applyGanttPermission();
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

  if (shiftProjectToTodayButton) {
    shiftProjectToTodayButton.addEventListener("click", () => {
      moveProjectToToday();
    });
  }

  if (taskInfoCloseBtn) {
    taskInfoCloseBtn.addEventListener("click", () => {
      closeTaskInfoModal();
    });
  }

  if (taskInfoEditDatesBtn) {
    taskInfoEditDatesBtn.addEventListener("click", () => {
      openTaskDatesEditorFromModal();
    });
  }

  if (taskInfoModal) {
    taskInfoModal.addEventListener("click", (event) => {
      if (event.target === taskInfoModal) {
        closeTaskInfoModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTaskInfoModal();
    }
  });

  window.addEventListener("beforeunload", () => {
    state.queuedTaskSyncTimers.forEach((timer) => clearTimeout(timer));
    state.queuedTaskSyncTimers.clear();
    state.queuedLinkSyncTimers.forEach((timer) => clearTimeout(timer));
    state.queuedLinkSyncTimers.clear();
    if (state.refreshTimer) clearTimeout(state.refreshTimer);
    state.refreshTimer = null;

    if (state.tasksRealtimeChannel && state.supabase) {
      state.supabase.removeChannel(state.tasksRealtimeChannel);
    }
    if (state.linksRealtimeChannel && state.supabase) {
      state.supabase.removeChannel(state.linksRealtimeChannel);
    }
    if (state.commentsRealtimeChannel && state.supabase) {
      state.supabase.removeChannel(state.commentsRealtimeChannel);
    }
  });

  init();
})();
