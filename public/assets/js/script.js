(() => {
  const columns = document.querySelectorAll('.cards');
  if (columns.length === 0) return;

  const progressBar = document.querySelector('#progressBar');
  const progressValue = document.querySelector('#progressValue');
  const progressTrack = document.querySelector('.progress-track');
  const progressWrap = document.querySelector('.progress-wrap');

  const createCardModal = document.querySelector('#createCardModal');
  const openCreateModalBtn = document.querySelector('#openCreateModal');
  const cancelCreateModalBtn = document.querySelector('#cancelCreateModal');
  const confirmChildrenModal = document.querySelector('#confirmChildrenModal');
  const confirmChildrenList = document.querySelector('#confirmChildrenList');
  const confirmChildrenBtn = document.querySelector('#confirmChildrenBtn');
  const cancelChildrenBtn = document.querySelector('#cancelChildrenBtn');
  const addTaskButtons = document.querySelectorAll('.add-task-btn');
  const createCardForm = document.querySelector('#createCardForm');
  const createCardTitle = document.querySelector('#createCardTitle');
  const saveCardBtn = document.querySelector('#saveCardBtn');
  const deleteCardBtn = document.querySelector('#deleteCardBtn');

  const newCardTitleInput = document.querySelector('#newCardTitle');
  const newCardMetaSelect = document.querySelector('#newCardMeta');
  const newCardMetaGroup = document.querySelector('#newCardMetaGroup');
  const newCardAssigneesGroup = document.querySelector('#newCardAssigneesGroup');
  const newCardPrioritySelect = document.querySelector('#newCardPriority');
  const newCardParentTaskSelect = document.querySelector('#newCardParentTask');
  const newCardColumnSelect = document.querySelector('#newCardColumn');
  const newCardStartDateInput = document.querySelector('#newCardStartDate');
  const newCardEndDateInput = document.querySelector('#newCardEndDate');

  const tasksFilterSelect = document.querySelector('#tasksFilter');
  const usersFilterSelect = document.querySelector('#usersFilter');
  const tagsFilterSelect = document.querySelector('#tagsFilter');
  const globalSearchInput = document.querySelector('#globalSearchInput');

  const taskCommentsList = document.querySelector('#taskCommentsList');
  const taskCommentForm = document.querySelector('#taskCommentForm');
  const newTaskCommentInput = document.querySelector('#newTaskComment');
  const taskAttachmentInput = document.querySelector('#taskAttachmentInput');
  const uploadAttachmentBtn = document.querySelector('#uploadAttachmentBtn');
  const taskAttachmentsList = document.querySelector('#taskAttachmentsList');
  const taskDetailsPanel = document.querySelector('#taskDetailsPanel');
  const taskDelaySummary = document.querySelector('#taskDelaySummary');

  const syncStatus = document.querySelector('#syncStatus');
  const projectContext = document.querySelector('#projectContext');
  const mainViewLink = document.querySelector('#mainViewLink');
  const calendarViewLink = document.querySelector('#calendarViewLink');
  const ganttViewLink = document.querySelector('#ganttViewLink');
  const notesViewLink = document.querySelector('#notesViewLink');
  const delayRadarPanel = document.querySelector('#delayRadarPanel');
  const delayRadarOverdueCount = document.querySelector('#delayRadarOverdueCount');
  const delayRadarCriticalCount = document.querySelector('#delayRadarCriticalCount');
  const delayRadarDueTodayCount = document.querySelector('#delayRadarDueTodayCount');
  const delayRadarRiskCount = document.querySelector('#delayRadarRiskCount');
  const delayRadarNoDateCount = document.querySelector('#delayRadarNoDateCount');
  const delayRadarFocus = document.querySelector('#delayRadarFocus');
  const delayRadarFilterBtn = document.querySelector('#delayRadarFilterBtn');
  const delayRadarResetBtn = document.querySelector('#delayRadarResetBtn');
  const dailyFocusPanel = document.querySelector('#dailyFocusPanel');
  const dailyFocusCriticalCount = document.querySelector('#dailyFocusCriticalCount');
  const dailyFocusOverdueCount = document.querySelector('#dailyFocusOverdueCount');
  const dailyFocusBlockedCount = document.querySelector('#dailyFocusBlockedCount');
  const dailyFocusImpactCount = document.querySelector('#dailyFocusImpactCount');
  const dailyFocusList = document.querySelector('#dailyFocusList');
  const dailyFocusFooter = document.querySelector('#dailyFocusFooter');

  const app = window.KanbanApp;
  const utils = window.KanbanUtils;
  const SUPABASE_TABLE = (app && app.tables && app.tables.tasks) || 'kanban_tasks';
  const LINKS_TABLE = (app && app.tables && app.tables.links) || 'kanban_task_links';
  const COMMENTS_TABLE = (app && app.tables && app.tables.comments) || 'kanban_task_comments';
  const ATTACHMENTS_TABLE = (app && app.tables && app.tables.attachments) || 'kanban_task_attachments';
  const ATTACHMENTS_BUCKET = (app && app.attachmentsBucket) || 'kanban-attachments';

  const WORKFLOW_STAGES = Object.freeze([
    { key: 'backlog', label: 'Backlog', dbStatus: 'open', progress: 0 },
    { key: 'open-todo', label: 'Open / To Do', dbStatus: 'open', progress: 15 },
    { key: 'in-progress', label: 'In Progress', dbStatus: 'open', progress: 45 },
    { key: 'blocked', label: 'Blocked', dbStatus: 'on-hold', progress: 10 },
    { key: 'review-qa', label: 'Review / QA', dbStatus: 'pending-approval', progress: 70 },
    { key: 'pending-approval', label: 'Pending Approval', dbStatus: 'pending-approval', progress: 80 },
    { key: 'done', label: 'Done / Complete', dbStatus: 'done', progress: 100 },
  ]);
  const VALID_STATUSES = new Set(WORKFLOW_STAGES.map((stage) => stage.key));
  const STAGE_BY_KEY = new Map(WORKFLOW_STAGES.map((stage) => [stage.key, stage]));
  const STAGE_TOKEN = /^\[WF:(backlog|open-todo|in-progress|blocked|review-qa|pending-approval|done)\]\s*/i;
  const DB_STATUS_TO_STAGE = Object.freeze({
    open: 'open-todo',
    'on-hold': 'blocked',
    'pending-approval': 'pending-approval',
    done: 'done',
  });
  const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
  const PRIORITY_LABEL = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Critica' };
  const DEPARTMENT_COLORS = {
    producto: '#f59e0b',
    ux: '#000000',
    backend: '#10b981',
    frontend: '#3b82f6',
    marketing: '#8b5cf6',
    rrhh: '#ef4444',
    ventas: '#f97316',
    bbdd: '#14b8a6',
    general: '#94a3b8'
  };

  const pageParams = new URLSearchParams(window.location.search);
  const state = {
    supabase: null,
    activeProject: null,
    currentUser: null,
    currentProfile: null,
    mode: 'user',
    profileRole: 'user',
    projectPermission: 'editor',
    canEdit: false,
    allTasks: [],
    assigneeDirectory: [],
    assigneeRoleByName: new Map(),
    searchCommentsByTask: new Map(),
    searchAttachmentsByTask: new Map(),
    taskLinks: [],
    taskRiskContext: null,
    editingTaskId: null,
    editingCard: null,
    draggedCard: null,
    dragInProgress: false,
    lastProgressPercent: null,
    isRefreshingFromSupabase: false,
    delayRefreshTimer: null,
    delayView: 'all',
    realtimeChannels: [],
    taskToHighlight: pageParams.get('task'),
  };

  const text = (v) => (utils && typeof utils.text === 'function' ? utils.text(v) : String(v || '').trim());
  const norm = (v) =>
    utils && typeof utils.normalizeKey === 'function'
      ? utils.normalizeKey(v)
      : text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normRole = (v) => (norm(v) === 'jefe' ? 'jefe' : 'user');
  const roleLabel = (role) => (normRole(role) === 'jefe' ? 'Jefe' : 'Trabajador');
  const priorityOf = (v) => (VALID_PRIORITIES.has(text(v).toLowerCase()) ? text(v).toLowerCase() : 'medium');
  const normalizeDbStatus = (value) => {
    const safe = text(value).toLowerCase();
    if (safe === 'on-hold' || safe === 'pending-approval' || safe === 'done') return safe;
    return 'open';
  };
  const normalizeStage = (value) => (VALID_STATUSES.has(text(value).toLowerCase()) ? text(value).toLowerCase() : 'open-todo');
  const stageToDbStatus = (stage) => {
    const safeStage = normalizeStage(stage);
    const found = STAGE_BY_KEY.get(safeStage);
    return found ? found.dbStatus : 'open';
  };
  const stageProgressPercent = (stage) => {
    const safeStage = normalizeStage(stage);
    const found = STAGE_BY_KEY.get(safeStage);
    if (found && Number.isFinite(found.progress)) return Number(found.progress);
    return 0;
  };
  const stripStageToken = (titleValue) => {
    const rawTitle = String(titleValue || '');
    const match = rawTitle.match(STAGE_TOKEN);
    if (!match) return { stage: '', cleanTitle: rawTitle };
    const stage = normalizeStage(match[1]);
    const cleanTitle = rawTitle.slice(match[0].length).trim();
    return { stage, cleanTitle };
  };
  const encodeTitleWithStage = (titleValue, stage) => {
    const safeTitle = text(titleValue) || 'Sin titulo';
    return `[WF:${normalizeStage(stage)}] ${safeTitle}`;
  };
  const createId = () =>
    utils && typeof utils.createLocalId === 'function'
      ? utils.createLocalId()
      : (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const statusProgressPercent = (status) => {
    return stageProgressPercent(status);
  };
  const isValidIsoDate = (value) =>
    utils && typeof utils.isValidIsoDate === 'function'
      ? utils.isValidIsoDate(value)
      : /^\d{4}-\d{2}-\d{2}$/.test(text(value));
  const normalizeTaskDate = (value) => {
    const safe = text(value);
    return isValidIsoDate(safe) ? safe : '';
  };
  const normalizeTaskSchedule = (task) => {
    const start_date = normalizeTaskDate(task && task.start_date);
    const end_date = normalizeTaskDate(task && task.end_date);
    if (!start_date || !end_date) return { start_date: '', end_date: '' };
    if (end_date < start_date) return { start_date, end_date: start_date };
    return { start_date, end_date };
  };
  const taskScheduleSignature = (task) => {
    const schedule = normalizeTaskSchedule(task);
    return `${schedule.start_date}|${schedule.end_date}`;
  };
  const buildTaskSchedulePayload = (task) => {
    const start_date = normalizeTaskDate(task && task.start_date);
    const end_date = normalizeTaskDate(task && task.end_date);
    if (!start_date || !end_date) return null;
    if (end_date < start_date) return null;
    return { start_date, end_date };
  };
  const readTaskScheduleFromInputs = () => ({
    start_date: normalizeTaskDate(newCardStartDateInput ? newCardStartDateInput.value : ''),
    end_date: normalizeTaskDate(newCardEndDateInput ? newCardEndDateInput.value : ''),
  });

  const DAY_MS = 24 * 60 * 60 * 1000;

  const getTodayIso = () => {
    if (utils && typeof utils.toIsoDate === 'function') {
      return text(utils.toIsoDate(new Date()));
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const formatDayCount = (days) => `${days} día${days === 1 ? '' : 's'}`;

  const diffIsoDays = (fromIso, toIso) => {
    const parse = (value) => {
      if (utils && typeof utils.parseIsoDate === 'function') {
        return utils.parseIsoDate(value);
      }
      const safe = text(value);
      if (!isValidIsoDate(safe)) return null;
      return new Date(`${safe}T00:00:00`);
    };

    const fromDate = parse(fromIso);
    const toDate = parse(toIso);
    if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
    return Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS);
  };

  const formatDeadlineDate = (value) => {
    const safe = text(value);
    if (!safe) return '';
    if (utils && typeof utils.formatDateEs === 'function') {
      return utils.formatDateEs(safe, '');
    }
    const parsed = utils && typeof utils.parseIsoDate === 'function' ? utils.parseIsoDate(safe) : new Date(`${safe}T00:00:00`);
    if (!parsed || Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('es-ES');
  };

  const getTaskDelayInfo = (task, options = {}) => {
    const schedule = normalizeTaskSchedule(task);
    const endDate = text(schedule.end_date);
    const status = normalizeStage(task && task.status);
    const today = text(options.todayIso) || getTodayIso();
    const deadlineLabel = formatDeadlineDate(endDate);
    const riskTask = {
      ...(task || {}),
      start_date: schedule.start_date,
      end_date: schedule.end_date,
    };

    if (utils && typeof utils.getTaskRiskInfo === 'function') {
      return utils.getTaskRiskInfo(riskTask, {
        criticalThresholdDays: Math.max(1, Number(options.criticalThresholdDays) || 3),
        criticalPriorityWindow: Math.max(0, Number(options.criticalPriorityWindow) || 2),
        todayIso: today,
        blockedByDependency: options.blockedByDependency === true,
        criticalPath: options.criticalPath === true,
      });
    }

    if (!endDate) {
      return {
        state: 'no-date',
        label: 'Sin fecha limite',
        detail: 'Anade una fecha final para activar el radar.',
        daysLeft: null,
        severity: -1,
        deadlineLabel: '',
      };
    }

    if (status === 'done') {
      const daysUntilDeadline = diffIsoDays(today, endDate);
      if (daysUntilDeadline != null && daysUntilDeadline < 0) {
        return {
          state: 'done-late',
          label: 'Cerrada tarde',
          detail: `Se cerro ${formatDayCount(Math.abs(daysUntilDeadline))} despues del plazo${deadlineLabel ? ` (${deadlineLabel})` : ''}.`,
          daysLeft: daysUntilDeadline,
          severity: -1,
          deadlineLabel,
        };
      }

      return {
        state: 'done',
        label: 'Completada',
        detail: deadlineLabel ? `Cerrada dentro del plazo (${deadlineLabel}).` : 'Cerrada sin fecha limite.',
        daysLeft: daysUntilDeadline,
        severity: -2,
        deadlineLabel,
      };
    }

    const daysLeft = diffIsoDays(today, endDate);
    if (daysLeft == null) {
      return {
        state: 'no-date',
        label: 'Sin fecha limite',
        detail: 'No se pudo calcular la fecha final.',
        daysLeft: null,
        severity: -1,
        deadlineLabel: '',
        blockedByDependency: false,
      };
    }

    const criticalThresholdDays = Math.max(1, Number(options.criticalThresholdDays) || 3);
    const criticalPriorityWindow = Math.max(0, Number(options.criticalPriorityWindow) || 2);
    const blockedByDependency = options.blockedByDependency === true;
    const priority = text(task && task.priority).toLowerCase();
    const isCriticalOverdue = daysLeft < 0 && Math.abs(daysLeft) >= criticalThresholdDays;
    const isCriticalPriority = priority === 'critical' && daysLeft <= criticalPriorityWindow;
    const isDependencyCritical = blockedByDependency === true;
    const criticalReason = isDependencyCritical
      ? 'dependency'
      : isCriticalOverdue
        ? 'overdue'
        : isCriticalPriority
          ? 'priority'
          : '';

    let stateValue = 'on-track';
    let label = `Quedan ${formatDayCount(daysLeft)}`;
    let detail = deadlineLabel ? `Fecha limite ${deadlineLabel}.` : 'Fecha limite programada.';
    let severity = 0;

    if (daysLeft < 0) {
      stateValue = 'overdue';
      label = `Retrasada ${formatDayCount(Math.abs(daysLeft))}`;
      detail = `Vencio hace ${formatDayCount(Math.abs(daysLeft))}${deadlineLabel ? ` (${deadlineLabel})` : ''}.`;
      severity = 3;
    } else if (daysLeft === 0) {
      stateValue = 'due-today';
      label = 'Vence hoy';
      detail = deadlineLabel ? `La fecha limite es hoy (${deadlineLabel}).` : 'La fecha limite es hoy.';
      severity = 2;
    } else if (daysLeft <= 2) {
      stateValue = 'due-soon';
      label = `Vence en ${formatDayCount(daysLeft)}`;
      detail = deadlineLabel ? `Quedan ${formatDayCount(daysLeft)} (${deadlineLabel}).` : `Quedan ${formatDayCount(daysLeft)}.`;
      severity = 1;
    }

    if (criticalReason) {
      stateValue = 'critical';
      severity = 4;
      if (criticalReason === 'dependency') {
        label = 'Critica por dependencia';
        detail = deadlineLabel
          ? `Una dependencia atrasada bloquea esta tarea (${deadlineLabel}).`
          : 'Una dependencia atrasada bloquea esta tarea.';
      } else if (criticalReason === 'priority') {
        label = 'Critica';
        detail = deadlineLabel
          ? `La prioridad critica deja poco margen (${deadlineLabel}).`
          : 'La prioridad critica deja poco margen.';
      } else {
        label = `Critica ${formatDayCount(Math.abs(daysLeft))}`;
        detail = `Vencio hace ${formatDayCount(Math.abs(daysLeft))}${deadlineLabel ? ` (${deadlineLabel})` : ''}.`;
      }
    }

    return {
      state: stateValue,
      label,
      detail,
      daysLeft,
      severity,
      deadlineLabel,
      blockedByDependency,
      baseState: stateValue,
      reason: criticalReason || stateValue,
      criticalPath: options.criticalPath === true,
      isCritical: stateValue === 'critical',
    };
  };

  const getContextualTaskDelayInfo = (task, riskContext = state.taskRiskContext, options = {}) => {
    const taskId = text(task && task.id);
    if (riskContext && taskId && riskContext.riskByTaskId && riskContext.riskByTaskId.has(taskId)) {
      return riskContext.riskByTaskId.get(taskId);
    }
    return getTaskDelayInfo(task, options);
  };

  const getDelayStateLabel = (stateValue) => {
    if (stateValue === 'critical') return 'is-critical';
    if (stateValue === 'overdue') return 'is-overdue';
    if (stateValue === 'due-today') return 'is-due-today';
    if (stateValue === 'due-soon') return 'is-due-soon';
    if (stateValue === 'done-late') return 'is-completed-late';
    if (stateValue === 'done') return 'is-done';
    if (stateValue === 'no-date') return 'is-no-deadline';
    return 'is-on-track';
  };

  const buildDelayRadarState = (tasks = state.allTasks, riskContext = state.taskRiskContext) => {
    const buckets = {
      critical: [],
      overdue: [],
      dueToday: [],
      dueSoon: [],
      onTrack: [],
      completed: [],
      noDate: [],
      doneLate: [],
      focus: null,
    };

    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      const info = getContextualTaskDelayInfo(task, riskContext, { todayIso: riskContext && riskContext.todayIso });
      const bucketItem = { task, info };
      if (info.state === 'critical') buckets.critical.push(bucketItem);
      else if (info.state === 'overdue') buckets.overdue.push(bucketItem);
      else if (info.state === 'due-today') buckets.dueToday.push(bucketItem);
      else if (info.state === 'due-soon') buckets.dueSoon.push(bucketItem);
      else if (info.state === 'done-late') buckets.doneLate.push(bucketItem);
      else if (info.state === 'done') buckets.completed.push(bucketItem);
      else if (info.state === 'no-date') buckets.noDate.push(bucketItem);
      else buckets.onTrack.push(bucketItem);
    });

    const byUrgency = (a, b) => {
      const aDays = Number(a && a.info ? a.info.daysLeft : null);
      const bDays = Number(b && b.info ? b.info.daysLeft : null);
      if (Number.isFinite(aDays) && Number.isFinite(bDays) && aDays !== bDays) return aDays - bDays;
      return text(a.task && a.task.title).localeCompare(text(b.task && b.task.title), 'es', { sensitivity: 'base' });
    };

    buckets.critical.sort(byUrgency);
    buckets.overdue.sort(byUrgency);
    buckets.dueToday.sort(byUrgency);
    buckets.dueSoon.sort(byUrgency);
    buckets.onTrack.sort(byUrgency);
    buckets.completed.sort(byUrgency);
    buckets.doneLate.sort(byUrgency);
    buckets.focus = buckets.critical[0] || buckets.overdue[0] || buckets.dueToday[0] || buckets.dueSoon[0] || buckets.onTrack[0] || buckets.doneLate[0] || buckets.completed[0] || null;
    return buckets;
  };

  const buildChildrenByParentMap = (tasks = state.allTasks) => {
    const map = new Map();
    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      const taskId = text(task && task.id);
      const parentId = text(task && task.parent_task_id);
      if (!taskId || !parentId || taskId === parentId) return;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(taskId);
    });
    return map;
  };

  const buildKanbanDependencyGraph = (links = [], validTaskIds = new Set()) => {
    const dependencyLinks = [];
    const predecessorsByTask = new Map();
    const successorsByTask = new Map();

    (Array.isArray(links) ? links : [])
      .forEach((link) => {
        const source = text(link && (link.source || link.source_id));
        const target = text(link && (link.target || link.target_id));
        if (!source || !target || source === target) return;
        if (validTaskIds.size > 0 && (!validTaskIds.has(source) || !validTaskIds.has(target))) return;

        dependencyLinks.push({
          id: text(link && link.id) || `${source}->${target}`,
          source,
          target,
        });

        if (!predecessorsByTask.has(target)) predecessorsByTask.set(target, new Set());
        predecessorsByTask.get(target).add(source);

        if (!successorsByTask.has(source)) successorsByTask.set(source, new Set());
        successorsByTask.get(source).add(target);
      });

    return { dependencyLinks, predecessorsByTask, successorsByTask };
  };

  const buildKanbanRiskContext = (tasks = state.allTasks, links = state.taskLinks) => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const taskById = new Map();
    safeTasks.forEach((task) => {
      const taskId = text(task && task.id);
      if (!taskId) return;
      taskById.set(taskId, task);
    });

    const dependencyGraph = buildKanbanDependencyGraph(links, new Set(taskById.keys()));
    const todayIso = getTodayIso();
    const riskByTaskId = new Map();

    taskById.forEach((task, taskId) => {
      riskByTaskId.set(taskId, getTaskDelayInfo(task, { todayIso }));
    });

    const taskIds = [...taskById.keys()];
    const maxPasses = Math.max(1, taskIds.length);

    for (let pass = 0; pass < maxPasses; pass += 1) {
      let changed = false;

      taskIds.forEach((taskId) => {
        const task = taskById.get(taskId);
        if (!task) return;

        const predecessors = dependencyGraph.predecessorsByTask.get(taskId);
        const blockedByDependency = !!(predecessors && [...predecessors].some((predecessorId) => {
          const predecessorInfo = riskByTaskId.get(predecessorId);
          return predecessorInfo && (predecessorInfo.state === 'critical' || predecessorInfo.state === 'overdue');
        }));

        const currentInfo = riskByTaskId.get(taskId) || getTaskDelayInfo(task, { todayIso });
        const nextInfo = getTaskDelayInfo(task, { todayIso, blockedByDependency });
        if (
          nextInfo.state !== currentInfo.state ||
          nextInfo.blockedByDependency !== currentInfo.blockedByDependency ||
          nextInfo.reason !== currentInfo.reason
        ) {
          riskByTaskId.set(taskId, nextInfo);
          changed = true;
        }
      });

      if (!changed) break;
    }

    return {
      todayIso,
      taskById,
      dependencyGraph,
      riskByTaskId,
    };
  };

  const buildDailyFocusState = (tasks = state.allTasks, riskContext = state.taskRiskContext) => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    if (safeTasks.length === 0) {
      return {
        items: [],
        criticalCount: 0,
        overdueCount: 0,
        blockedCount: 0,
        impactCount: 0,
        topItem: null,
        totalCount: 0,
      };
    }

    const context = riskContext && riskContext.riskByTaskId ? riskContext : buildKanbanRiskContext(safeTasks, state.taskLinks);
    const taskById = context.taskById || new Map(safeTasks.map((task) => [text(task && task.id), task]).filter(([id]) => !!id));
    const childrenByParent = buildChildrenByParentMap(safeTasks);
    const hierarchyMemo = new Map();

    const computeHierarchyStats = (taskId, trail = new Set()) => {
      const safeTaskId = text(taskId);
      if (!safeTaskId) return { total: 0, active: 0, direct: 0 };
      if (hierarchyMemo.has(safeTaskId)) return hierarchyMemo.get(safeTaskId);
      if (trail.has(safeTaskId)) return { total: 0, active: 0, direct: 0 };

      const nextTrail = new Set(trail);
      nextTrail.add(safeTaskId);

      const directChildren = childrenByParent.get(safeTaskId) || [];
      let total = 0;
      let active = 0;

      directChildren.forEach((childId) => {
        total += 1;
        const childTask = taskById.get(childId);
        if (childTask && normalizeStage(childTask.status) !== 'done') active += 1;
        const childStats = computeHierarchyStats(childId, nextTrail);
        total += childStats.total;
        active += childStats.active;
      });

      const result = {
        total,
        active,
        direct: directChildren.length,
      };
      hierarchyMemo.set(safeTaskId, result);
      return result;
    };

    taskById.forEach((_, taskId) => {
      computeHierarchyStats(taskId);
    });

    const priorityWeight = (priority) => {
      const safe = text(priority).toLowerCase();
      if (safe === 'critical') return 3;
      if (safe === 'high') return 2;
      if (safe === 'medium') return 1;
      return 0;
    };

    const stateWeights = {
      critical: 8,
      overdue: 7,
      'due-today': 6,
      'due-soon': 5,
      'on-track': 3,
      'no-date': 2,
      'done-late': 1,
      done: 0,
    };

    const items = safeTasks.map((task) => {
      const taskId = text(task && task.id);
      const info = getContextualTaskDelayInfo(task, context, { todayIso: context.todayIso });
      const hierarchy = hierarchyMemo.get(taskId) || { total: 0, active: 0, direct: 0 };
      const dependencySuccessors = context.dependencyGraph.successorsByTask.has(taskId)
        ? context.dependencyGraph.successorsByTask.get(taskId).size
        : 0;
      const dependencyPredecessors = context.dependencyGraph.predecessorsByTask.has(taskId)
        ? context.dependencyGraph.predecessorsByTask.get(taskId).size
        : 0;

      const score =
        ((stateWeights[info.state] || 0) * 1000) +
        (priorityWeight(task.priority) * 100) +
        (hierarchy.active * 45) +
        (hierarchy.total * 12) +
        (dependencySuccessors * 28) +
        (info.blockedByDependency ? 220 : 0) +
        (info.isCritical ? 120 : 0) +
        (normalizeStage(task.status) !== 'done' ? 60 : 0) +
        (dependencyPredecessors > 0 ? 20 : 0);

      const impactBits = [];
      if (hierarchy.active > 0) {
        impactBits.push(`Bloquea ${hierarchy.active} activa${hierarchy.active === 1 ? '' : 's'}`);
      } else if (hierarchy.total > 0) {
        impactBits.push(`${hierarchy.total} subtarea${hierarchy.total === 1 ? '' : 's'}`);
      }
      if (dependencySuccessors > 0) {
        impactBits.push(`${dependencySuccessors} dependencia${dependencySuccessors === 1 ? '' : 's'}`);
      }

      return {
        task,
        info,
        hierarchy,
        dependencySuccessors,
        dependencyPredecessors,
        score,
        impactLabel: impactBits.length > 0 ? impactBits.join(' · ') : 'Sin impacto directo',
      };
    });

    const activeItems = items.filter((item) => item.info.state !== 'done');
    const sortedItems = [...(activeItems.length > 0 ? activeItems : items)].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.info.severity !== a.info.severity) return Number(b.info.severity || 0) - Number(a.info.severity || 0);
      const aDays = Number(a.info.daysLeft);
      const bDays = Number(b.info.daysLeft);
      if (Number.isFinite(aDays) && Number.isFinite(bDays) && aDays !== bDays) return aDays - bDays;
      return text(a.task && a.task.title).localeCompare(text(b.task && b.task.title), 'es', { sensitivity: 'base' });
    });

    const topItems = sortedItems.slice(0, 3);
    const criticalCount = items.filter((item) => item.info.state === 'critical').length;
    const overdueCount = items.filter((item) => item.info.state === 'overdue').length;
    const blockedCount = items.filter((item) => item.info.blockedByDependency === true).length;
    const impactCount = topItems.reduce(
      (sum, item) => sum + Number(item.hierarchy.active || 0) + Number(item.dependencySuccessors || 0),
      0
    );

    return {
      items: topItems,
      criticalCount,
      overdueCount,
      blockedCount,
      impactCount,
      topItem: topItems[0] || null,
      totalCount: items.length,
    };
  };

  const focusDailyTask = (taskId) => {
    const safeTaskId = text(taskId);
    if (!safeTaskId) return;

    state.taskToHighlight = safeTaskId;
    renderBoard();

    const locateCard = () => document.querySelector(`.card[data-task-id="${safeTaskId}"]`);
    let card = locateCard();

    if (!card) {
      const filtersChanged =
        (tasksFilterSelect && tasksFilterSelect.value !== 'all') ||
        (usersFilterSelect && usersFilterSelect.value !== 'all') ||
        (tagsFilterSelect && tagsFilterSelect.value !== 'all') ||
        (globalSearchInput && text(globalSearchInput.value));

      if (tasksFilterSelect) tasksFilterSelect.value = 'all';
      if (usersFilterSelect) usersFilterSelect.value = 'all';
      if (tagsFilterSelect) tagsFilterSelect.value = 'all';
      if (globalSearchInput) globalSearchInput.value = '';
      if (filtersChanged) renderBoard();
      card = locateCard();
      if (card && filtersChanged) {
        setStatus('Se han quitado los filtros para mostrar el foco.', 'info');
      }
    }

    if (!card) {
      setStatus('No se pudo localizar la tarea de foco.', 'warning');
      return;
    }

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('is-highlighted');
    window.setTimeout(() => {
      card.classList.remove('is-highlighted');
    }, 1700);

    if (state.canEdit) {
      openModal({ card });
    }
  };

  const renderDailyFocusPanel = () => {
    if (!dailyFocusPanel || !dailyFocusList) return;

    const focusState = buildDailyFocusState();
    const topItem = focusState.topItem;
    const topItems = focusState.items;

    dailyFocusPanel.className = 'daily-focus-panel';
    dailyFocusPanel.classList.toggle('has-critical', focusState.criticalCount > 0);
    dailyFocusPanel.classList.toggle('has-overdue', focusState.criticalCount === 0 && focusState.overdueCount > 0);
    dailyFocusPanel.classList.toggle(
      'has-risk',
      focusState.criticalCount === 0 && focusState.overdueCount === 0 && topItems.some((item) => item.info.state === 'due-soon' || item.info.state === 'due-today')
    );

    if (dailyFocusCriticalCount) dailyFocusCriticalCount.textContent = String(focusState.criticalCount);
    if (dailyFocusOverdueCount) dailyFocusOverdueCount.textContent = String(focusState.overdueCount);
    if (dailyFocusBlockedCount) dailyFocusBlockedCount.textContent = String(focusState.blockedCount);
    if (dailyFocusImpactCount) dailyFocusImpactCount.textContent = String(focusState.impactCount);

    dailyFocusList.innerHTML = '';

    if (topItems.length === 0) {
      dailyFocusPanel.classList.add('is-empty');
      const empty = document.createElement('div');
      empty.className = 'daily-focus-empty';
      empty.textContent = 'No hay tareas para priorizar.';
      dailyFocusList.appendChild(empty);
    } else {
      dailyFocusPanel.classList.remove('is-empty');
      topItems.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `daily-focus-item ${getDelayStateLabel(item.info.state)}`;
        button.setAttribute('data-task-id', item.task.id);
        button.setAttribute('aria-label', `Abrir tarea ${index + 1}: ${text(item.task && item.task.title) || 'Sin titulo'}`);
        button.addEventListener('click', () => focusDailyTask(item.task.id));

        const rank = document.createElement('span');
        rank.className = 'daily-focus-item__rank';
        rank.textContent = String(index + 1);

        const main = document.createElement('span');
        main.className = 'daily-focus-item__main';

        const badge = document.createElement('span');
        badge.className = 'daily-focus-item__badge';
        badge.textContent = item.info.label;

        const title = document.createElement('strong');
        title.className = 'daily-focus-item__title';
        title.textContent = text(item.task && item.task.title) || 'Sin titulo';

        const textLine = document.createElement('p');
        textLine.className = 'daily-focus-item__text';
        textLine.textContent = item.info.detail;

        const meta = document.createElement('div');
        meta.className = 'daily-focus-item__meta';

        const priorityChip = document.createElement('span');
        priorityChip.className = 'daily-focus-chip';
        priorityChip.textContent = `Prioridad ${PRIORITY_LABEL[item.task.priority] || 'Media'}`;

        const impactChip = document.createElement('span');
        impactChip.className = 'daily-focus-chip';
        impactChip.textContent = item.impactLabel;

        meta.appendChild(priorityChip);
        meta.appendChild(impactChip);

        main.appendChild(badge);
        main.appendChild(title);
        main.appendChild(textLine);
        main.appendChild(meta);

        const arrow = document.createElement('span');
        arrow.className = 'daily-focus-item__arrow';
        arrow.textContent = '→';

        button.appendChild(rank);
        button.appendChild(main);
        button.appendChild(arrow);
        dailyFocusList.appendChild(button);
      });
    }

    if (dailyFocusFooter) {
      dailyFocusFooter.innerHTML = '';
      const note = document.createElement('p');
      note.className = 'daily-focus-footer__text';

      if (topItem) {
        const remaining = Number(topItem.info.daysLeft);
        const impactTotal = Number(topItem.hierarchy.active || 0) + Number(topItem.dependencySuccessors || 0);
        const urgency =
          topItem.info.state === 'critical'
            ? 'Ataque'
            : topItem.info.state === 'overdue'
              ? 'Rescata'
              : topItem.info.state === 'due-today' || topItem.info.state === 'due-soon'
                ? 'Prioriza'
                : topItem.info.state === 'done-late'
                  ? 'Revisa'
                : 'Empuja';
        const impactText = impactTotal > 0
          ? `desbloquear ${impactTotal} frente${impactTotal === 1 ? '' : 's'} de trabajo`
          : 'mover sin bloquear otras tareas';
        const remainingText = Number.isFinite(remaining)
          ? ` y ajustar ${Math.abs(remaining)} dia${Math.abs(remaining) === 1 ? '' : 's'}`
          : '';
        note.textContent = `${urgency} primero la #1 para ${impactText}${remainingText}.`;

        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'btn-mini';
        action.textContent = state.canEdit ? 'Abrir primera' : 'Resaltar primera';
        action.addEventListener('click', () => focusDailyTask(topItem.task.id));

        dailyFocusFooter.appendChild(note);
        dailyFocusFooter.appendChild(action);
      } else {
        note.textContent = 'Anade fechas y dependencias para ver el foco automatico.';
        dailyFocusFooter.appendChild(note);
      }
    }
  };

  const setDelayView = (mode) => {
    const nextView = mode === 'urgent' ? 'urgent' : 'all';
    if (nextView === 'urgent') {
      const radarState = buildDelayRadarState();
      if (
        radarState.critical.length === 0 &&
        radarState.overdue.length === 0 &&
        radarState.dueToday.length === 0 &&
        radarState.dueSoon.length === 0
      ) {
        setStatus('No hay tareas urgentes activas para filtrar.', 'info');
        return;
      }
    }

    if (state.delayView === nextView) {
      renderBoard();
      return;
    }

    state.delayView = nextView;
    renderBoard();
  };

  const scheduleDelayRefresh = () => {
    if (state.delayRefreshTimer) {
      window.clearTimeout(state.delayRefreshTimer);
      state.delayRefreshTimer = null;
    }

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 5, 0);
    const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());

    state.delayRefreshTimer = window.setTimeout(() => {
      state.delayRefreshTimer = null;
      renderBoard();
    }, delay);
  };

  const renderTaskDelaySummary = (task) => {
    if (!taskDelaySummary) return;
    taskDelaySummary.innerHTML = '';
    const info = getContextualTaskDelayInfo(task);
    taskDelaySummary.className = `task-delay-summary ${getDelayStateLabel(info.state)}`;

    const eyebrow = document.createElement('p');
    eyebrow.className = 'task-delay-summary__eyebrow';
    eyebrow.textContent = 'Plazo';

    const title = document.createElement('h5');
    title.className = 'task-delay-summary__title';
    title.textContent = info.label;

    const textLine = document.createElement('p');
    textLine.className = 'task-delay-summary__text';
    textLine.textContent = info.detail;

    taskDelaySummary.appendChild(eyebrow);
    taskDelaySummary.appendChild(title);
    taskDelaySummary.appendChild(textLine);
  };

  const renderDelayRadar = () => {
    if (!delayRadarPanel) return;
    const radarState = buildDelayRadarState();
    const criticalCount = radarState.critical.length;
    const overdueCount = radarState.overdue.length;
    const dueTodayCount = radarState.dueToday.length;
    const dueSoonCount = radarState.dueSoon.length;
    const noDateCount = radarState.noDate.length;
    const focus = radarState.focus;

    if (delayRadarCriticalCount) delayRadarCriticalCount.textContent = String(criticalCount);
    if (delayRadarOverdueCount) delayRadarOverdueCount.textContent = String(overdueCount);
    if (delayRadarDueTodayCount) delayRadarDueTodayCount.textContent = String(dueTodayCount);
    if (delayRadarRiskCount) delayRadarRiskCount.textContent = String(criticalCount + dueTodayCount + dueSoonCount);
    if (delayRadarNoDateCount) delayRadarNoDateCount.textContent = String(noDateCount);

    delayRadarPanel.classList.toggle('has-critical', criticalCount > 0);
    delayRadarPanel.classList.toggle('has-overdue', overdueCount > 0);
    delayRadarPanel.classList.toggle('has-risk', criticalCount === 0 && overdueCount === 0 && (dueTodayCount > 0 || dueSoonCount > 0));

    if (delayRadarFilterBtn) {
      const urgentCount = criticalCount + overdueCount + dueTodayCount + dueSoonCount;
      delayRadarFilterBtn.textContent = state.delayView === 'urgent' ? 'Mostrando urgentes' : `Solo urgentes (${urgentCount})`;
      delayRadarFilterBtn.classList.toggle('is-active', state.delayView === 'urgent');
      delayRadarFilterBtn.setAttribute('aria-pressed', String(state.delayView === 'urgent'));
      delayRadarFilterBtn.disabled = urgentCount === 0 && state.delayView !== 'urgent';
    }

    if (delayRadarResetBtn) {
      delayRadarResetBtn.disabled = state.delayView === 'all';
    }

    if (!delayRadarFocus) return;
    delayRadarFocus.innerHTML = '';
    delayRadarFocus.className = 'delay-radar-focus';

    if (!focus) {
      delayRadarFocus.classList.add('is-muted');
      const emptyEyebrow = document.createElement('p');
      emptyEyebrow.className = 'delay-radar-focus__eyebrow';
      emptyEyebrow.textContent = 'Radar vacio';
      const emptyTitle = document.createElement('h3');
      emptyTitle.className = 'delay-radar-focus__title';
      emptyTitle.textContent = 'Sin tareas con fecha limite';
      const emptyText = document.createElement('p');
      emptyText.className = 'delay-radar-focus__text';
      emptyText.textContent = 'Anade una fecha final para activar el rescate automatico.';
      delayRadarFocus.appendChild(emptyEyebrow);
      delayRadarFocus.appendChild(emptyTitle);
      delayRadarFocus.appendChild(emptyText);
      return;
    }

    const badge = document.createElement('span');
    badge.className = 'delay-radar-focus__badge';
    if (focus.info.state === 'critical') {
      badge.textContent = 'Critica';
      delayRadarFocus.classList.add('is-critical');
    } else if (focus.info.state === 'overdue') {
      badge.textContent = 'Urgente';
      delayRadarFocus.classList.add('is-overdue');
    } else if (focus.info.state === 'due-today' || focus.info.state === 'due-soon') {
      badge.textContent = 'En riesgo';
      delayRadarFocus.classList.add('is-warning');
    } else if (focus.info.state === 'done-late') {
      badge.textContent = 'Cerrada tarde';
      delayRadarFocus.classList.add('is-done-late');
    } else if (focus.info.state === 'done') {
      badge.textContent = 'Completada';
      delayRadarFocus.classList.add('is-muted');
    } else {
      badge.textContent = 'Proximo plazo';
      delayRadarFocus.classList.add('is-muted');
    }

    const title = document.createElement('h3');
    title.className = 'delay-radar-focus__title';
    title.textContent = text(focus.task && focus.task.title) || 'Sin titulo';

    const textLine = document.createElement('p');
    textLine.className = 'delay-radar-focus__text';
    textLine.textContent = focus.info.detail;

    delayRadarFocus.appendChild(badge);
    delayRadarFocus.appendChild(title);
    delayRadarFocus.appendChild(textLine);
  };

  const sanitizeAssignees = (value) =>
    utils && typeof utils.sanitizeAssignees === 'function'
      ? utils.sanitizeAssignees(value, { normalizeFn: norm })
      : (() => {
          const src = Array.isArray(value) ? value : String(value || '').split(/[,;\n]/);
          const seen = new Set();
          return src
            .map((x) => text(x))
            .filter(Boolean)
            .filter((x) => {
              const key = norm(x);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
        })();

  const getDepartmentCheckboxes = () =>
    newCardMetaGroup ? [...newCardMetaGroup.querySelectorAll('input[type="checkbox"][name="meta"]')] : [];

  const getSelectedDepartments = () => {
    const checks = getDepartmentCheckboxes();
    if (checks.length > 0) {
      return checks.filter((check) => check.checked).map((check) => text(check.value)).filter(Boolean);
    }
    if (newCardMetaSelect) {
      return [...newCardMetaSelect.selectedOptions].map((option) => text(option.value)).filter(Boolean);
    }
    return [];
  };

  const setSelectedDepartments = (departments) => {
    const selected = new Set(splitTaskDepartments(departments).map((department) => norm(department)));
    const checks = getDepartmentCheckboxes();
    if (checks.length > 0) {
      let hasSelection = false;
      checks.forEach((check) => {
        const isSelected = selected.has(norm(check.value));
        check.checked = isSelected;
        hasSelection = hasSelection || isSelected;
      });
      if (!hasSelection) {
        const preferred = checks.find((check) => norm(check.value) === 'frontend') || checks[0];
        if (preferred) preferred.checked = true;
      }
      return;
    }

    if (!newCardMetaSelect) return;
    let hasSelection = false;
    [...newCardMetaSelect.options].forEach((option) => {
      const isSelected = selected.has(norm(option.value));
      option.selected = isSelected;
      hasSelection = hasSelection || isSelected;
    });
    if (!hasSelection && newCardMetaSelect.options.length > 0) {
      newCardMetaSelect.options[0].selected = true;
    }
  };

  const focusDepartmentsField = () => {
    const checks = getDepartmentCheckboxes();
    if (checks.length > 0) {
      checks[0].focus();
      return;
    }
    if (newCardMetaSelect) newCardMetaSelect.focus();
  };

  const resolveAssigneeDisplayName = (value) => {
    const safe = text(value);
    if (!safe) return '';
    const byUserId = state.assigneeDirectory.find((person) => text(person.userId) === safe);
    if (byUserId && text(byUserId.name)) return text(byUserId.name);
    return safe;
  };

  const looksLikeUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));

  const splitTaskDepartments = (value) => {
    const values = Array.isArray(value) ? value : String(value || '').split(/[,;\n|/]+/);
    const seen = new Set();
    const result = [];
    values.forEach((part) => {
      const safe = text(part);
      if (!safe) return;
      const key = norm(safe);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(safe);
    });
    return result.length > 0 ? result : ['General'];
  };

  const joinTaskDepartments = (value) => splitTaskDepartments(value).join(', ');

  const sanitizeTask = (task) => {
    const id = text(task.id) || createId();
    const parent = text(task.parent_task_id) || null;
    const tokenInfo = stripStageToken(task.title);
    const rawStatus = text(task.status).toLowerCase();
    const fromDbStatus = DB_STATUS_TO_STAGE[normalizeDbStatus(rawStatus)] || 'open-todo';
    const stage = tokenInfo.stage || (VALID_STATUSES.has(rawStatus) ? rawStatus : fromDbStatus);
    const taskAssignees = sanitizeAssignees(task.assignees)
      .map((assignee) => resolveAssigneeDisplayName(assignee))
      .filter(Boolean);
    const schedule = normalizeTaskSchedule(task);
    return {
      id,
      title: text(tokenInfo.cleanTitle || task.title) || 'Sin titulo',
      department: joinTaskDepartments(task.department),
      status: normalizeStage(stage),
      assignees: sanitizeAssignees(taskAssignees),
      priority: priorityOf(task.priority),
      parent_task_id: parent && parent !== id ? parent : null,
      start_date: schedule.start_date || null,
      end_date: schedule.end_date || null,
    };
  };

  const parentTitle = (parentId) => {
    if (!parentId) return '';
    const row = state.allTasks.find((t) => t.id === parentId);
    return row ? row.title : '';
  };

  const setStatus = (msg, type = 'info') => {
    if (utils && typeof utils.setStatus === 'function') {
      utils.setStatus(syncStatus, msg, type);
      return;
    }
    if (!syncStatus) return;
    syncStatus.textContent = msg;
    syncStatus.classList.remove('is-info', 'is-success', 'is-warning', 'is-error');
    syncStatus.classList.add(`is-${type}`);
  };

  const setProjectText = (project) => {
    if (!projectContext) return;
    const mode = state.mode === 'jefe' ? 'jefe' : 'user';
    const perm = app && app.projectPermissionToLabel ? app.projectPermissionToLabel(state.projectPermission) : state.projectPermission;
    projectContext.textContent = `Proyecto: ${project.name} | modo ${mode} | permiso ${perm}`;
  };

  const normalizeDepartmentKey = (department) => {
    const key = norm(department);
    if (!key) return 'general';

    // Handle common variants so UX always matches the expected key
    const aliasMap = {
      ux: ['ux', 'user experience', 'userexperience', 'user-experience'],
      marketing: ['marketing', 'market'],
      rrhh: ['rrhh', 'recursoshumanos', 'recursos humanos'],
      bbdd: ['bbdd', 'basededatos', 'base de datos'],
      producto: ['producto', 'product'],
      frontend: ['frontend', 'front-end'],
      backend: ['backend', 'back-end'],
      ventas: ['ventas', 'sales'],
      general: ['general'],
    };

    for (const [canonical, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) return canonical;
    }

    return key;
  };

  const deptColor = (department) => {
    const key = normalizeDepartmentKey(department);
    return DEPARTMENT_COLORS[key] || DEPARTMENT_COLORS.general;
  };

  const buildDepartmentGradient = (colors) => {
    const safeColors = [...new Set((Array.isArray(colors) ? colors : []).map((color) => text(color)).filter(Boolean))];
    if (safeColors.length <= 1) return safeColors[0] || DEPARTMENT_COLORS.general;
    const step = 100 / safeColors.length;
    const stops = safeColors
      .map((color, index) => {
        const from = (index * step).toFixed(2);
        const to = ((index + 1) * step).toFixed(2);
        return `${color} ${from}% ${to}%`;
      })
      .join(', ');
    return `linear-gradient(90deg, ${stops})`;
  };

  const applyDeptColor = (card) => {
    const meta = card.querySelector('.card-meta');
    const departments = splitTaskDepartments(meta ? meta.textContent : 'General');
    const colors = departments.map((department) => deptColor(department));
    card.style.setProperty('--dept-color', colors[0] || DEPARTMENT_COLORS.general);
    card.style.setProperty('--dept-gradient', buildDepartmentGradient(colors));
    let indicator = card.querySelector('.card-dept-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'card-dept-indicator';
      card.appendChild(indicator);
    }
  };

  const ensureLine = (card, className) => {
    let el = card.querySelector(`.${className}`);
    if (el) return el;
    el = document.createElement('p');
    el.className = className;
    card.appendChild(el);
    return el;
  };

  const cardFromTask = (task) => {
    const t = sanitizeTask(task);
    const delayInfo = getContextualTaskDelayInfo(t);
    const card = document.createElement('div');
    card.className = 'card';
    card.classList.add(getDelayStateLabel(delayInfo.state));
    card.draggable = state.canEdit;
    card.setAttribute('data-task-id', t.id);
    card.setAttribute('data-task-assignees', JSON.stringify(t.assignees));
    card.setAttribute('data-task-priority', t.priority);
    card.setAttribute('data-task-parent-id', t.parent_task_id || '');
    card.setAttribute('data-task-start-date', t.start_date || '');
    card.setAttribute('data-task-end-date', t.end_date || '');
    card.setAttribute('data-task-delay-state', delayInfo.state);
    card.setAttribute('data-task-delay-label', delayInfo.label);

    const title = ensureLine(card, 'card-title');
    const meta = ensureLine(card, 'card-meta');
    const assignees = ensureLine(card, 'card-assignees');
    const priority = ensureLine(card, 'card-priority');
    const delay = ensureLine(card, 'card-delay');
    const parent = ensureLine(card, 'card-parent');

    title.textContent = t.title;
    meta.textContent = t.department;
    assignees.textContent = `Personas: ${t.assignees.length ? t.assignees.join(', ') : 'Sin asignar'}`;
    priority.className = `card-priority priority-${t.priority}`;
    priority.textContent = `Prioridad: ${PRIORITY_LABEL[t.priority] || 'Media'}`;
    delay.className = `card-delay delay-${delayInfo.state}`;
    delay.textContent = delayInfo.label;
    delay.title = delayInfo.detail;
    const pTitle = parentTitle(t.parent_task_id);
    parent.textContent = pTitle ? `Subtarea de: ${pTitle}` : '';
    parent.classList.toggle('hidden', !pTitle);

    applyDeptColor(card);
    return card;
  };

  const taskFromCard = (card) => {
    const title = card.querySelector('.card-title');
    const meta = card.querySelector('.card-meta');
    let assignees = [];
    try { assignees = sanitizeAssignees(JSON.parse(card.getAttribute('data-task-assignees') || '[]')); } catch (_) {}
    return sanitizeTask({
      id: card.getAttribute('data-task-id') || createId(),
      title: title ? title.textContent : '',
      department: meta ? meta.textContent : 'General',
      status: (card.closest('.cards') || {}).dataset ? card.closest('.cards').dataset.column : 'open-todo',
      assignees,
      priority: card.getAttribute('data-task-priority') || 'medium',
      parent_task_id: card.getAttribute('data-task-parent-id') || null,
      start_date: card.getAttribute('data-task-start-date') || null,
      end_date: card.getAttribute('data-task-end-date') || null,
    });
  };

  const updateProgress = () => {
    const cards = [...document.querySelectorAll('.card')];
    const total = cards.length;
    const weighted = cards.reduce((sum, card) => {
      const column = card.closest('.cards');
      const status = column && column.dataset ? column.dataset.column : 'open-todo';
      return sum + statusProgressPercent(status);
    }, 0);
    const pct = total === 0 ? 0 : Math.round(weighted / total);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressValue) progressValue.textContent = `${pct}%`;
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(pct));
    if (progressWrap && state.lastProgressPercent !== null && state.lastProgressPercent !== pct) {
      progressWrap.classList.remove('pulse');
      void progressWrap.offsetWidth;
      progressWrap.classList.add('pulse');
    }
    state.lastProgressPercent = pct;
  };

  const setModalMode = (mode) => {
    const isEdit = mode === 'edit';
    if (createCardTitle) createCardTitle.textContent = isEdit ? 'Editar etiqueta' : 'Crear etiqueta';
    if (saveCardBtn) saveCardBtn.textContent = isEdit ? 'Guardar' : 'Crear';
    if (deleteCardBtn) {
      deleteCardBtn.style.display = isEdit ? '' : 'none';
      deleteCardBtn.disabled = !isEdit;
      deleteCardBtn.textContent = 'Eliminar';
    }
    if (taskDetailsPanel) taskDetailsPanel.classList.toggle('hidden', !isEdit);
  };

  const clearBoard = () => {
    columns.forEach((col) => { col.innerHTML = ''; });
  };

  const refreshParentOptions = (currentTaskId = '', selected = '') => {
    if (!newCardParentTaskSelect) return;
    const previous = text(selected) || text(newCardParentTaskSelect.value);
    newCardParentTaskSelect.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Sin tarea padre';
    newCardParentTaskSelect.appendChild(empty);

    state.allTasks
      .filter((task) => task.id !== currentTaskId)
      .sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }))
      .forEach((task) => {
        const opt = document.createElement('option');
        opt.value = task.id;
        opt.textContent = `${task.title} (${task.department})`;
        newCardParentTaskSelect.appendChild(opt);
      });

    newCardParentTaskSelect.value = [...newCardParentTaskSelect.options].some((o) => o.value === previous) ? previous : '';
    newCardParentTaskSelect.disabled = newCardParentTaskSelect.options.length <= 1;
  };

  const getSelectedAssignees = () => {
    if (!newCardAssigneesGroup) return [];
    return [...newCardAssigneesGroup.querySelectorAll('input[type="checkbox"]:checked')]
      .map((input) => text(input.value))
      .filter(Boolean);
  };

  const refreshAssigneeOptions = (selected = []) => {
    if (!newCardAssigneesGroup) return;
    const selectedValues = sanitizeAssignees(selected)
      .map((value) => resolveAssigneeDisplayName(value))
      .filter(Boolean);
    const selectedKeys = new Set(selectedValues.map((value) => norm(value)));
    newCardAssigneesGroup.innerHTML = '';

    const optionByKey = new Map();
    state.assigneeDirectory.forEach((person) => {
      const name = text(person.name);
      if (!name) return;
      const key = norm(name);
      optionByKey.set(key, { name, role: person.role, userId: person.userId || '' });
    });
    selectedValues.forEach((name) => {
      const key = norm(name);
      if (!optionByKey.has(key) && !looksLikeUuid(name)) optionByKey.set(key, { name, role: '', userId: '' });
    });

    if (optionByKey.size === 0) {
      const empty = document.createElement('p');
      empty.className = 'task-assignee-empty';
      empty.textContent = 'No hay personas disponibles.';
      newCardAssigneesGroup.appendChild(empty);
      newCardAssigneesGroup.setAttribute('aria-disabled', 'true');
      return;
    }

    newCardAssigneesGroup.removeAttribute('aria-disabled');
    [...optionByKey.values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      .forEach((row) => {
        const label = document.createElement('label');
        label.className = 'task-assignee-option';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'assignees';
        input.value = row.name;
        input.checked = selectedKeys.has(norm(row.name));

        const content = document.createElement('span');
        content.className = 'task-assignee-option__content';

        const title = document.createElement('span');
        title.className = 'task-assignee-option__name';
        title.textContent = row.name;

        const meta = document.createElement('small');
        meta.className = 'task-assignee-option__meta';
        meta.textContent = row.role ? roleLabel(row.role) : 'Sin rol';

        content.appendChild(title);
        content.appendChild(meta);
        label.appendChild(input);
        label.appendChild(content);
        newCardAssigneesGroup.appendChild(label);
      });
  };

  const refreshUsersFilter = () => {
    if (!usersFilterSelect) return;
    const prev = text(usersFilterSelect.value) || 'current';
    const base = [
      { value: 'current', label: 'Current' },
      { value: 'all', label: 'All' },
      { value: 'role:jefe', label: 'Jefe' },
      { value: 'unassigned', label: 'Sin asignar' },
    ];
    const peopleMap = new Map();
    state.assigneeDirectory.forEach((p) => peopleMap.set(norm(p.name), p.name));
    state.allTasks.forEach((task) => task.assignees.forEach((name) => { if (!peopleMap.has(norm(name))) peopleMap.set(norm(name), name); }));

    usersFilterSelect.innerHTML = '';
    [...base, ...[...peopleMap.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })).map((name) => ({
      value: `person:${name}`,
      label: name,
    }))].forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.value;
      opt.textContent = row.label;
      usersFilterSelect.appendChild(opt);
    });
    usersFilterSelect.value = [...usersFilterSelect.options].some((o) => o.value === prev) ? prev : 'current';
  };

  const currentUserMatch = (assignees) => {
    const keys = new Set();
    const userId = text(state.currentUser && state.currentUser.id);
    if (userId) {
      state.assigneeDirectory.forEach((person) => {
        if (text(person.userId) === userId) keys.add(norm(person.name));
      });
      keys.add(norm(`Usuario ${userId.slice(0, 8)}`));
    }
    if (state.currentProfile && text(state.currentProfile.display_name)) keys.add(norm(state.currentProfile.display_name));
    if (keys.size === 0) return false;
    return assignees.some((name) => keys.has(norm(name)));
  };

  const taskMatchesSearch = (task, queryKey) => {
    if (!queryKey) return true;
    const delayInfo = getContextualTaskDelayInfo(task);
    const bag = [
      task.title,
      task.department,
      task.assignees.join(' '),
      PRIORITY_LABEL[task.priority] || task.priority,
      parentTitle(task.parent_task_id),
      task.start_date,
      task.end_date,
      delayInfo.label,
      delayInfo.detail,
      (state.searchCommentsByTask.get(task.id) || []).join(' '),
      (state.searchAttachmentsByTask.get(task.id) || []).join(' '),
    ].join(' ');
    return norm(bag).includes(queryKey);
  };

  const visibleTasks = () => {
    const taskFilter = tasksFilterSelect ? text(tasksFilterSelect.value) || 'all' : 'all';
    const userFilter = usersFilterSelect ? text(usersFilterSelect.value) || 'current' : 'current';
    const tagFilter = tagsFilterSelect ? text(tagsFilterSelect.value) || 'all' : 'all';
    const searchKey = globalSearchInput ? norm(globalSearchInput.value) : '';
    const riskContext = state.taskRiskContext;

    const filtered = state.allTasks.filter((task) => {
      if (taskFilter !== 'all' && task.status !== taskFilter) return false;

      const assignees = sanitizeAssignees(task.assignees);
      if (userFilter === 'current' && assignees.length > 0 && !currentUserMatch(assignees)) return false;
      if (userFilter === 'unassigned' && assignees.length > 0) return false;
      if (userFilter.startsWith('person:')) {
        const target = norm(userFilter.slice('person:'.length));
        if (!assignees.some((name) => norm(name) === target)) return false;
      }
      if (userFilter.startsWith('role:')) {
        const targetRole = normRole(userFilter.slice('role:'.length));
        if (!assignees.some((name) => normRole(state.assigneeRoleByName.get(norm(name))) === targetRole)) return false;
      }

      if (tagFilter !== 'all') {
        const taskDepartments = splitTaskDepartments(task.department).map((department) => norm(department));
        if (!taskDepartments.includes(norm(tagFilter))) return false;
      }
      if (state.delayView === 'urgent') {
        const taskDelay = getContextualTaskDelayInfo(task, riskContext);
        if (
          taskDelay.state !== 'critical' &&
          taskDelay.state !== 'overdue' &&
          taskDelay.state !== 'due-today' &&
          taskDelay.state !== 'due-soon'
        ) {
          return false;
        }
      }
      if (!taskMatchesSearch(task, searchKey)) return false;
      return true;
    });

    if (state.delayView !== 'urgent') return filtered;

    return filtered.sort((left, right) => {
      const leftDelay = getContextualTaskDelayInfo(left, riskContext);
      const rightDelay = getContextualTaskDelayInfo(right, riskContext);
      if (leftDelay.severity !== rightDelay.severity) {
        return Number(rightDelay.severity || 0) - Number(leftDelay.severity || 0);
      }
      const leftDays = Number(leftDelay.daysLeft);
      const rightDays = Number(rightDelay.daysLeft);
      if (Number.isFinite(leftDays) && Number.isFinite(rightDays) && leftDays !== rightDays) {
        return leftDays - rightDays;
      }
      return text(left.title).localeCompare(text(right.title), 'es', { sensitivity: 'base' });
    });
  };

  const setDirectory = (rows = []) => {
    const unique = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const name = text(row && row.name);
      if (!name) return;
      const key = norm(name);
      if (unique.has(key)) return;
      unique.set(key, { name, role: normRole(row && row.role), userId: text(row && row.userId) });
    });
    state.assigneeDirectory = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    state.assigneeRoleByName = new Map(state.assigneeDirectory.map((person) => [norm(person.name), normRole(person.role)]));
    refreshAssigneeOptions(getSelectedAssignees());
    refreshUsersFilter();
  };

  const renderBoard = () => {
    state.taskRiskContext = buildKanbanRiskContext(state.allTasks, state.taskLinks);
    clearBoard();
    visibleTasks().forEach((task) => {
      const col = document.querySelector(`.cards[data-column="${task.status}"]`) || document.querySelector('.cards[data-column="open-todo"]');
      if (!col) return;
      const card = cardFromTask(task);

      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.draggable = state.canEdit;
      card.addEventListener('click', () => { if (state.canEdit && !state.dragInProgress) openModal({ card }); });
      card.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && state.canEdit && !state.dragInProgress) {
          event.preventDefault();
          openModal({ card });
        }
      });
      card.addEventListener('dragstart', (event) => {
        if (!state.canEdit) { event.preventDefault(); return; }
        state.dragInProgress = true;
        state.draggedCard = card;
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        state.dragInProgress = false;
        state.draggedCard = null;
      });

      col.appendChild(card);
    });

    renderDelayRadar();
    renderDailyFocusPanel();
    updateProgress();
    scheduleDelayRefresh();
    if (state.taskToHighlight) {
      const card = document.querySelector(`.card[data-task-id="${state.taskToHighlight}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('is-highlighted');
        setTimeout(() => card.classList.remove('is-highlighted'), 1700);
        state.taskToHighlight = null;
      }
    }
  };

  const renderTasks = (tasks) => {
    state.allTasks = (Array.isArray(tasks) ? tasks : []).map((task) => sanitizeTask(task));
    refreshUsersFilter();
    refreshParentOptions(state.editingTaskId || '', newCardParentTaskSelect ? newCardParentTaskSelect.value : '');
    renderBoard();
  };

  const readDomTasks = () => [...document.querySelectorAll('.card')].map((card) => sanitizeTask({ ...taskFromCard(card), id: createId() }));
  const collectAssigneesFromTasks = (tasks) =>
    (Array.isArray(tasks) ? tasks : []).flatMap((task) => sanitizeAssignees(task.assignees));

  const taskAssigneeSignature = (value) => sanitizeAssignees(value).map((name) => norm(name)).sort().join('|');
  const taskDepartmentSignature = (value) => splitTaskDepartments(value).map((department) => norm(department)).sort().join('|');
  const hasTaskChanged = (previous, next) => {
    if (!previous) return true;
    if (text(previous.title) !== text(next.title)) return true;
    if (taskDepartmentSignature(previous.department) !== taskDepartmentSignature(next.department)) return true;
    if (normalizeStage(previous.status) !== normalizeStage(next.status)) return true;
    if (priorityOf(previous.priority) !== priorityOf(next.priority)) return true;
    if (text(previous.parent_task_id) !== text(next.parent_task_id)) return true;
    if (taskAssigneeSignature(previous.assignees) !== taskAssigneeSignature(next.assignees)) return true;
    if (taskScheduleSignature(previous) !== taskScheduleSignature(next)) return true;
    return false;
  };

  const updateLinks = () => {
    if (!app || !state.activeProject) return;
    const links = app.getProjectLinks(state.activeProject.id);
    if (mainViewLink) mainViewLink.href = links.main;
    if (calendarViewLink) calendarViewLink.href = links.calendar;
    if (ganttViewLink) ganttViewLink.href = links.gantt;
    if (notesViewLink) notesViewLink.href = links.notes;
  };

  const applyReadOnly = () => {
    if (openCreateModalBtn) {
      openCreateModalBtn.disabled = !state.canEdit;
      openCreateModalBtn.setAttribute('aria-disabled', String(!state.canEdit));
    }
    addTaskButtons.forEach((btn) => {
      btn.disabled = !state.canEdit;
      btn.setAttribute('aria-disabled', String(!state.canEdit));
    });
    if (newTaskCommentInput) newTaskCommentInput.disabled = !state.canEdit;
    if (taskAttachmentInput) taskAttachmentInput.disabled = !state.canEdit;
    if (uploadAttachmentBtn) uploadAttachmentBtn.disabled = !state.canEdit;
    if (taskCommentForm) {
      const submit = taskCommentForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !state.canEdit;
    }
  };

  const ensureAccess = async () => {
    const projectId = app.getProjectIdFromUrl();
    if (!projectId) {
      setStatus('Debes abrir un proyecto desde MAIN.', 'error');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
      return false;
    }

    await app.ensureAuthSession(state.supabase);
    state.currentUser = await app.getCurrentUser(state.supabase);
    state.currentProfile = await app.ensureProfile(state.supabase, state.currentUser.id);
    state.profileRole = state.currentProfile.role;
    state.mode = app.resolveMode(state.profileRole);

    const access = await app.ensureProjectAccess({
      supabaseClient: state.supabase,
      projectId,
      userId: state.currentUser.id,
      profileRole: state.profileRole,
      mode: state.mode,
    });

    if (!access.allowed || !access.project) {
      setStatus('No tienes acceso al proyecto en este modo.', 'error');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
      return false;
    }

    state.activeProject = access.project;
    state.projectPermission = (app && app.normalizeProjectPermission && access.permission
      ? app.normalizeProjectPermission(access.permission)
      : access.permission) || 'editor';
    state.canEdit = app && app.canEditProjectData
      ? app.canEditProjectData({ profileRole: state.profileRole, mode: state.mode, permission: state.projectPermission })
      : true;

    updateLinks();
    setProjectText(access.project);
    return true;
  };

  const fetchProjectAssignees = async () => {
    if (!state.supabase || !state.activeProject || !app || !app.tables || !app.tables.members || !app.tables.users) return [];

    const { data: members, error: membersError } = await state.supabase
      .from(app.tables.members)
      .select('user_id')
      .eq('project_id', state.activeProject.id);
    if (membersError) throw membersError;

    const userIds = [...new Set((members || []).map((row) => text(row.user_id)).filter(Boolean))];
    if (userIds.length === 0) return [];

    const { data: profiles, error: profilesError } = await state.supabase
      .from(app.tables.users)
      .select('user_id,display_name,first_name,last_name_1,last_name_2,role')
      .in('user_id', userIds);
    if (profilesError) throw profilesError;

    return (Array.isArray(profiles) ? profiles : [])
      .map((profile) => {
        const fullName = [profile.first_name, profile.last_name_1, profile.last_name_2]
          .map((value) => text(value))
          .filter(Boolean)
          .join(' ');
        const name = fullName || text(profile.display_name);
        if (!name) return null;
        return {
          name,
          role: normRole(profile.role),
          userId: text(profile.user_id),
        };
      })
      .filter(Boolean);
  };

  const fetchTasks = async () => {
    const [tasksRes, linksRes] = await Promise.all([
      state.supabase
        .from(SUPABASE_TABLE)
        .select('id,title,department,status,assignees,priority,parent_task_id,project_id')
        .eq('project_id', state.activeProject.id)
        .order('created_at', { ascending: true }),
      state.supabase
        .from(LINKS_TABLE)
        .select('source_id,target_id,link_type,start_date,end_date,project_id,created_at')
        .eq('project_id', state.activeProject.id)
        .order('created_at', { ascending: true }),
    ]);
    if (tasksRes.error) throw tasksRes.error;
    if (linksRes.error) throw linksRes.error;

    const scheduleByTaskId = new Map();
    (linksRes.data || []).forEach((row) => {
      const sourceId = text(row.source_id);
      const targetId = text(row.target_id);
      if (!sourceId || sourceId !== targetId) return;
      const schedule = normalizeTaskSchedule(row);
      if (!schedule.start_date || !schedule.end_date) return;
      scheduleByTaskId.set(sourceId, schedule);
    });

    return {
      tasks: (tasksRes.data || []).map((row) => sanitizeTask({
        ...row,
        ...(scheduleByTaskId.get(text(row.id)) || {}),
      })),
      links: (linksRes.data || []).map((row) => ({
        id: text(row.id) || createId(),
        source: text(row.source_id),
        target: text(row.target_id),
        link_type: Number(row.link_type) || 0,
        lag: Number(row.lag) || 0,
        start_date: normalizeTaskDate(row.start_date),
        end_date: normalizeTaskDate(row.end_date),
      })),
    };
  };

  const fetchSearchIndex = async () => {
    state.searchCommentsByTask = new Map();
    state.searchAttachmentsByTask = new Map();
    if (!state.supabase || !state.activeProject) return;

    const [commentsRes, attachmentsRes] = await Promise.all([
      state.supabase.from(COMMENTS_TABLE).select('task_id,content').eq('project_id', state.activeProject.id),
      state.supabase.from(ATTACHMENTS_TABLE).select('task_id,file_name').eq('project_id', state.activeProject.id),
    ]);

    if (!commentsRes.error) {
      (commentsRes.data || []).forEach((row) => {
        const id = text(row.task_id);
        const content = text(row.content);
        if (!id || !content) return;
        if (!state.searchCommentsByTask.has(id)) state.searchCommentsByTask.set(id, []);
        state.searchCommentsByTask.get(id).push(content);
      });
    }

    if (!attachmentsRes.error) {
      (attachmentsRes.data || []).forEach((row) => {
        const id = text(row.task_id);
        const fileName = text(row.file_name);
        if (!id || !fileName) return;
        if (!state.searchAttachmentsByTask.has(id)) state.searchAttachmentsByTask.set(id, []);
        state.searchAttachmentsByTask.get(id).push(fileName);
      });
    }
  };

  const refreshFromSupabase = async () => {
    if (!state.supabase || state.isRefreshingFromSupabase) return;
    state.isRefreshingFromSupabase = true;
    try {
      const [{ tasks, links }] = await Promise.all([fetchTasks(), fetchSearchIndex()]);
      state.taskLinks = Array.isArray(links) ? links : [];
      renderTasks(tasks);
      if (state.editingTaskId) await loadTaskDetails(state.editingTaskId, true);
    } finally {
      state.isRefreshingFromSupabase = false;
    }
  };

  const saveTask = async (task) => {
    const t = sanitizeTask(task);
    const dbStatus = stageToDbStatus(t.status);
    const payload = {
      title: encodeTitleWithStage(t.title, t.status),
      department: t.department,
      status: dbStatus,
      assignees: t.assignees,
      priority: t.priority,
      parent_task_id: t.parent_task_id,
      project_id: state.activeProject.id,
      gantt_status: dbStatus === 'done' ? 'complete' : dbStatus === 'on-hold' ? 'waiting' : 'in-progress',
      progress: statusProgressPercent(t.status) / 100,
    };

    const { error } = await state.supabase.from(SUPABASE_TABLE).update(payload).eq('id', t.id).eq('project_id', state.activeProject.id);
    if (error) throw error;

    const schedulePayload = buildTaskSchedulePayload(t);
    if (schedulePayload) {
      const { error: scheduleError } = await state.supabase.from(LINKS_TABLE).upsert(
        {
          source_id: t.id,
          target_id: t.id,
          project_id: state.activeProject.id,
          link_type: 0,
          lag: 0,
          start_date: schedulePayload.start_date,
          end_date: schedulePayload.end_date,
        },
        { onConflict: 'project_id,source_id,target_id,link_type' }
      );
      if (scheduleError) throw scheduleError;
    } else {
      const { error: scheduleError } = await state.supabase
        .from(LINKS_TABLE)
        .delete()
        .eq('project_id', state.activeProject.id)
        .eq('source_id', t.id)
        .eq('target_id', t.id)
        .eq('link_type', 0);
      if (scheduleError) throw scheduleError;
    }
  };

  const createTask = async (task) => {
    const t = sanitizeTask(task);
    const dbStatus = stageToDbStatus(t.status);
    const payload = {
      id: t.id,
      title: encodeTitleWithStage(t.title, t.status),
      department: t.department,
      status: dbStatus,
      assignees: t.assignees,
      priority: t.priority,
      parent_task_id: t.parent_task_id,
      project_id: state.activeProject.id,
      gantt_status: dbStatus === 'done' ? 'complete' : dbStatus === 'on-hold' ? 'waiting' : 'in-progress',
      progress: statusProgressPercent(t.status) / 100,
    };

    const { error } = await state.supabase.from(SUPABASE_TABLE).insert(payload);
    if (error) throw error;

    const schedulePayload = buildTaskSchedulePayload(t);
    if (schedulePayload) {
      const { error: scheduleError } = await state.supabase.from(LINKS_TABLE).upsert(
        {
          source_id: t.id,
          target_id: t.id,
          project_id: state.activeProject.id,
          link_type: 0,
          lag: 0,
          start_date: schedulePayload.start_date,
          end_date: schedulePayload.end_date,
        },
        { onConflict: 'project_id,source_id,target_id,link_type' }
      );
      if (scheduleError) throw scheduleError;
    } else {
      const { error: scheduleError } = await state.supabase
        .from(LINKS_TABLE)
        .delete()
        .eq('project_id', state.activeProject.id)
        .eq('source_id', t.id)
        .eq('target_id', t.id)
        .eq('link_type', 0);
      if (scheduleError) throw scheduleError;
    }
  };

  const hasIncompleteChildren = (taskId, nextStatus) => {
    if (nextStatus !== 'done') return false;
    return state.allTasks.some((task) => task.parent_task_id === taskId && task.status !== 'done');
  };

  const getDirectChildren = (taskId) =>
    state.allTasks.filter((t) => t.parent_task_id === taskId);

  const showChildrenConfirmModal = (children) =>
    new Promise((resolve) => {
      if (!confirmChildrenModal || !confirmChildrenList) { resolve(true); return; }

      confirmChildrenList.innerHTML = '';
      children.forEach((child) => {
        const stage = STAGE_BY_KEY.get(child.status) || null;
        const stageLabel = stage ? stage.label : child.status;
        const isDone = child.status === 'done';
        const li = document.createElement('li');
        li.innerHTML = `<span class="child-status-badge${isDone ? ' done' : ''}">${stageLabel}</span>${child.title || child.id}`;
        confirmChildrenList.appendChild(li);
      });

      confirmChildrenModal.classList.remove('hidden');
      confirmChildrenModal.setAttribute('aria-hidden', 'false');

      const cleanup = () => {
        confirmChildrenModal.classList.add('hidden');
        confirmChildrenModal.setAttribute('aria-hidden', 'true');
        confirmChildrenBtn.removeEventListener('click', onConfirm);
        cancelChildrenBtn.removeEventListener('click', onCancel);
        confirmChildrenModal.removeEventListener('click', onBackdrop);
      };
      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };
      const onBackdrop = (e) => { if (e.target === confirmChildrenModal) onCancel(); };

      confirmChildrenBtn.addEventListener('click', onConfirm);
      cancelChildrenBtn.addEventListener('click', onCancel);
      confirmChildrenModal.addEventListener('click', onBackdrop);
    });

  const resolveParentStageFromChildren = (parentId, tasks = state.allTasks) => {
    const children = tasks.filter((task) => text(task.parent_task_id) === text(parentId));
    if (children.length === 0) return null;

    const allDone = children.every((child) => child.status === 'done');
    if (allDone) return 'done';

    const hasReviewChild = children.some((child) =>
      child.status === 'review-qa' || child.status === 'pending-approval'
    );
    if (hasReviewChild) return 'review-qa';

    return 'in-progress';
  };

  const syncParentChainLocal = (taskId, tasks = state.allTasks) => {
    const byId = new Map(tasks.map((task) => [text(task.id), { ...task }]));
    const current = byId.get(text(taskId));
    if (!current) return tasks;

    let parentId = text(current.parent_task_id);
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;

      const nextStage = resolveParentStageFromChildren(parentId, [...byId.values()]);
      if (nextStage && parent.status !== nextStage) {
        parent.status = nextStage;
        byId.set(parentId, parent);
      }

      parentId = text(parent.parent_task_id);
    }

    return [...byId.values()];
  };

  const collectCascadeTaskIds = (rootTaskId) => {
    const rootId = text(rootTaskId);
    if (!rootId) return [];

    const childrenByParent = new Map();
    state.allTasks.forEach((task) => {
      const taskId = text(task.id);
      const parentId = text(task.parent_task_id);
      if (!taskId || !parentId) return;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(taskId);
    });

    const taskIds = [];
    const visited = new Set();
    const stack = [rootId];
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);
      taskIds.push(currentId);
      const children = childrenByParent.get(currentId) || [];
      children.forEach((childId) => {
        if (!visited.has(childId)) stack.push(childId);
      });
    }
    return taskIds;
  };

  const deleteTaskCascadeLocal = (rootTaskId) => {
    const taskIds = collectCascadeTaskIds(rootTaskId);
    if (taskIds.length === 0) return 0;
    const ids = new Set(taskIds);

    state.allTasks = state.allTasks.filter((task) => !ids.has(text(task.id)));
    state.searchCommentsByTask = new Map(
      [...state.searchCommentsByTask.entries()].filter(([taskId]) => !ids.has(text(taskId)))
    );
    state.searchAttachmentsByTask = new Map(
      [...state.searchAttachmentsByTask.entries()].filter(([taskId]) => !ids.has(text(taskId)))
    );
    renderTasks(state.allTasks);
    return taskIds.length;
  };

  const deleteTaskCascadeInSupabase = async (rootTaskId) => {
    const taskIds = collectCascadeTaskIds(rootTaskId);
    if (taskIds.length === 0) return 0;
    const projectId = state.activeProject ? text(state.activeProject.id) : '';
    if (!projectId) return 0;

    const filePaths = [];
    const { data: attachmentRows, error: attachmentsReadError } = await state.supabase
      .from(ATTACHMENTS_TABLE)
      .select('file_path')
      .eq('project_id', projectId)
      .in('task_id', taskIds);
    if (attachmentsReadError) {
      console.warn(attachmentsReadError);
    } else {
      filePaths.push(...(attachmentRows || []).map((row) => text(row.file_path)).filter(Boolean));
    }

    const { error: deleteLinksSourceError } = await state.supabase
      .from(LINKS_TABLE)
      .delete()
      .eq('project_id', projectId)
      .in('source_id', taskIds);
    if (deleteLinksSourceError) console.warn(deleteLinksSourceError);

    const { error: deleteLinksTargetError } = await state.supabase
      .from(LINKS_TABLE)
      .delete()
      .eq('project_id', projectId)
      .in('target_id', taskIds);
    if (deleteLinksTargetError) console.warn(deleteLinksTargetError);

    const { error: deleteCommentsError } = await state.supabase
      .from(COMMENTS_TABLE)
      .delete()
      .eq('project_id', projectId)
      .in('task_id', taskIds);
    if (deleteCommentsError) console.warn(deleteCommentsError);

    const { error: deleteAttachmentsError } = await state.supabase
      .from(ATTACHMENTS_TABLE)
      .delete()
      .eq('project_id', projectId)
      .in('task_id', taskIds);
    if (deleteAttachmentsError) console.warn(deleteAttachmentsError);

    const { error: deleteTasksError } = await state.supabase
      .from(SUPABASE_TABLE)
      .delete()
      .eq('project_id', projectId)
      .in('id', taskIds);
    if (deleteTasksError) throw deleteTasksError;

    if (filePaths.length > 0) {
      const uniquePaths = [...new Set(filePaths)];
      const batchSize = 80;
      for (let i = 0; i < uniquePaths.length; i += batchSize) {
        const batch = uniquePaths.slice(i, i + batchSize);
        const { error: storageDeleteError } = await state.supabase.storage.from(ATTACHMENTS_BUCKET).remove(batch);
        if (storageDeleteError) console.warn(storageDeleteError);
      }
    }

    await fetchSearchIndex();
    return taskIds.length;
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatSize = (bytes) => {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const profileToDisplayName = (profile) => {
    if (!profile) return "";
    const fullName = [profile.first_name, profile.last_name_1, profile.last_name_2]
      .map((value) => text(value))
      .filter(Boolean)
      .join(" ");
    if (fullName) return fullName;
    const displayName = text(profile.display_name);
    return displayName || "";
  };

  const resolveCommentAuthorName = (authorId, profilesById = new Map()) => {
    const safeAuthorId = text(authorId);
    if (safeAuthorId && profilesById.has(safeAuthorId)) {
      const fromProfile = profileToDisplayName(profilesById.get(safeAuthorId));
      if (fromProfile) return fromProfile;
    }

    const fromDirectory = state.assigneeDirectory.find((person) => text(person.userId) === safeAuthorId);
    if (fromDirectory && text(fromDirectory.name)) {
      return text(fromDirectory.name);
    }

    return "Usuario";
  };

  const fetchTaskDetails = async (taskId) => {
    const [commentsRes, attachmentsRes] = await Promise.all([
      state.supabase
        .from(COMMENTS_TABLE)
        .select('id,task_id,author_id,content,created_at')
        .eq('project_id', state.activeProject.id)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }),
      state.supabase
        .from(ATTACHMENTS_TABLE)
        .select('id,task_id,file_name,file_path,file_size,created_at')
        .eq('project_id', state.activeProject.id)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false }),
    ]);

    if (commentsRes.error) throw commentsRes.error;
    if (attachmentsRes.error) throw attachmentsRes.error;

    const comments = Array.isArray(commentsRes.data) ? commentsRes.data : [];
    const authorIds = [...new Set(comments.map((row) => text(row.author_id)).filter(Boolean))];
    const authorProfilesById = new Map();

    if (authorIds.length > 0 && app && app.tables && app.tables.users) {
      const { data: authorProfiles, error: authorProfilesError } = await state.supabase
        .from(app.tables.users)
        .select("user_id,display_name,first_name,last_name_1,last_name_2")
        .in("user_id", authorIds);
      if (!authorProfilesError) {
        (Array.isArray(authorProfiles) ? authorProfiles : []).forEach((profile) => {
          authorProfilesById.set(text(profile.user_id), profile);
        });
      }
    }

    const commentsWithAuthorName = comments.map((row) => ({
      ...row,
      author_name: resolveCommentAuthorName(row.author_id, authorProfilesById),
    }));

    return { comments: commentsWithAuthorName, attachments: attachmentsRes.data || [] };
  };

  const renderDetailLists = ({ comments, attachments }) => {
    if (taskCommentsList) {
      taskCommentsList.innerHTML = '';
      if (!comments.length) {
        const empty = document.createElement('li');
        empty.className = 'task-details-empty';
        empty.textContent = 'No hay comentarios.';
        taskCommentsList.appendChild(empty);
      } else {
        comments.forEach((row) => {
          const li = document.createElement('li');
          li.className = 'task-comment-item';
          const meta = document.createElement('p');
          meta.className = 'task-comment-meta';
          meta.textContent = `${text(row.author_name) || 'Usuario'} · ${formatDate(row.created_at)}`;
          const commentText = document.createElement('p');
          commentText.className = 'task-comment-text';
          commentText.textContent = text(row.content);
          li.appendChild(meta);
          li.appendChild(commentText);
          if (state.canEdit) {
            const btn = document.createElement('button');
            btn.className = 'btn-mini';
            btn.type = 'button';
            btn.textContent = 'Eliminar';
            btn.addEventListener('click', async () => {
              await state.supabase.from(COMMENTS_TABLE).delete().eq('id', row.id).eq('project_id', state.activeProject.id);
              await fetchSearchIndex();
              await loadTaskDetails(state.editingTaskId, true);
              renderBoard();
            });
            li.appendChild(btn);
          }
          taskCommentsList.appendChild(li);
        });
      }
    }

    if (taskAttachmentsList) {
      taskAttachmentsList.innerHTML = '';
      if (!attachments.length) {
        const empty = document.createElement('li');
        empty.className = 'task-details-empty';
        empty.textContent = 'No hay adjuntos.';
        taskAttachmentsList.appendChild(empty);
      } else {
        attachments.forEach((row) => {
          const li = document.createElement('li');
          li.className = 'task-attachment-item';
          const name = document.createElement('p');
          name.className = 'task-comment-text';
          name.textContent = text(row.file_name);
          const meta = document.createElement('p');
          meta.className = 'task-attachment-meta';
          meta.textContent = `${formatSize(row.file_size)} · ${formatDate(row.created_at)}`;
          const actions = document.createElement('div');
          actions.className = 'task-attachment-actions';
          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'btn-mini';
          openBtn.textContent = 'Abrir';
          openBtn.addEventListener('click', async () => {
            const { data, error } = await state.supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(text(row.file_path), 900);
            if (error) throw error;
            if (data && data.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
          });
          actions.appendChild(openBtn);

          if (state.canEdit) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-mini';
            deleteBtn.textContent = 'Eliminar';
            deleteBtn.addEventListener('click', async () => {
              await state.supabase.from(ATTACHMENTS_TABLE).delete().eq('id', row.id).eq('project_id', state.activeProject.id);
              if (text(row.file_path)) await state.supabase.storage.from(ATTACHMENTS_BUCKET).remove([text(row.file_path)]);
              await fetchSearchIndex();
              await loadTaskDetails(state.editingTaskId, true);
              renderBoard();
            });
            actions.appendChild(deleteBtn);
          }

          li.appendChild(name);
          li.appendChild(meta);
          li.appendChild(actions);
          taskAttachmentsList.appendChild(li);
        });
      }
    }
  };

  const loadTaskDetails = async (taskId, silent = false) => {
    if (!taskId || !state.supabase || !state.activeProject) return;
    if (!silent) setStatus('Cargando detalle de tarea...', 'info');
    const data = await fetchTaskDetails(taskId);
    renderDetailLists(data);
    if (!silent) setStatus('Detalle de tarea actualizado.', 'success');
  };

  const openModal = (options = {}) => {
    if (!state.canEdit) { setStatus('Permiso de solo lectura en este proyecto.', 'warning'); return; }
    if (!createCardModal) return;

    const config = typeof options === 'string' ? { preferredColumn: options } : options;
    state.editingCard = config.card || null;
    state.editingTaskId = state.editingCard ? text(state.editingCard.getAttribute('data-task-id')) : null;

    if (createCardForm) createCardForm.reset();

    if (state.editingTaskId) {
      setModalMode('edit');
      const task = state.allTasks.find((row) => row.id === state.editingTaskId) || taskFromCard(state.editingCard);
      if (newCardTitleInput) newCardTitleInput.value = task.title;
      setSelectedDepartments(task.department);
      refreshAssigneeOptions(task.assignees);
      if (newCardPrioritySelect) newCardPrioritySelect.value = task.priority;
      if (newCardColumnSelect) newCardColumnSelect.value = task.status;
      if (newCardStartDateInput) newCardStartDateInput.value = task.start_date || '';
      if (newCardEndDateInput) newCardEndDateInput.value = task.end_date || '';
      refreshParentOptions(task.id, task.parent_task_id || '');
      renderTaskDelaySummary(task);
      loadTaskDetails(task.id).catch((error) => { console.error(error); setStatus('No se pudo cargar el detalle de la tarea.', 'error'); });
    } else {
      setModalMode('create');
      setSelectedDepartments(['Frontend']);
      refreshAssigneeOptions([]);
      refreshParentOptions('', '');
      if (newCardPrioritySelect) newCardPrioritySelect.value = 'medium';
      if (newCardColumnSelect && config.preferredColumn) newCardColumnSelect.value = config.preferredColumn;
      if (newCardStartDateInput) newCardStartDateInput.value = '';
      if (newCardEndDateInput) newCardEndDateInput.value = '';
      if (taskDelaySummary) taskDelaySummary.innerHTML = '';
    }

    createCardModal.classList.remove('hidden');
    createCardModal.setAttribute('aria-hidden', 'false');
    if (newCardTitleInput) { newCardTitleInput.focus(); newCardTitleInput.select(); }
  };

  const closeModal = () => {
    if (!createCardModal) return;
    createCardModal.classList.add('hidden');
    createCardModal.setAttribute('aria-hidden', 'true');
    if (createCardForm) createCardForm.reset();
    if (taskCommentForm) taskCommentForm.reset();
    if (taskAttachmentInput) taskAttachmentInput.value = '';
    state.editingTaskId = null;
    state.editingCard = null;
    setModalMode('create');
    if (taskDelaySummary) {
      taskDelaySummary.innerHTML = '';
      taskDelaySummary.className = 'task-delay-summary';
    }
  };

  const buildAttachmentPath = (taskId, fileName) => {
    const projectId = state.activeProject ? text(state.activeProject.id) : 'local';
    const clean = text(fileName).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '') || `archivo-${Date.now()}`;
    return `${projectId}/${taskId}/${Date.now()}-${clean}`;
  };

  const startRealtime = () => {
    if (!state.supabase || !state.activeProject || state.realtimeChannels.length > 0) return;

    const watch = (name, table, fn) => state.supabase
      .channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `project_id=eq.${state.activeProject.id}` }, fn)
      .subscribe();

    state.realtimeChannels = [
      watch(`kanban-tasks-${state.activeProject.id}`, SUPABASE_TABLE, () => refreshFromSupabase().catch(console.error)),
      watch(`kanban-links-${state.activeProject.id}`, LINKS_TABLE, () => refreshFromSupabase().catch(console.error)),
      watch(`kanban-comments-${state.activeProject.id}`, COMMENTS_TABLE, async () => {
        await fetchSearchIndex();
        renderBoard();
        if (state.editingTaskId) await loadTaskDetails(state.editingTaskId, true);
      }),
      watch(`kanban-attachments-${state.activeProject.id}`, ATTACHMENTS_TABLE, async () => {
        await fetchSearchIndex();
        renderBoard();
        if (state.editingTaskId) await loadTaskDetails(state.editingTaskId, true);
      }),
    ];
  };

  const initializeSupabase = async () => {
    if (!app || !app.hasSupabaseConfig()) { setStatus('Configura .env para sincronizar este proyecto.', 'warning'); return; }
    state.supabase = app.createSupabaseClient();
    if (!state.supabase) { setStatus('No se pudo crear el cliente de Supabase.', 'error'); return; }

    setStatus('Conectando con Supabase...', 'info');

    const canContinue = await ensureAccess();
    if (!canContinue) return;

    applyReadOnly();

    const { tasks, links } = await fetchTasks();
    state.taskLinks = Array.isArray(links) ? links : [];

    try {
      const assignees = await fetchProjectAssignees();
      setDirectory(assignees);
    } catch (error) {
      console.warn(error);
    }

    await fetchSearchIndex();
    renderTasks(tasks);
    applyReadOnly();
    startRealtime();
    setStatus(state.canEdit ? 'Proyecto conectado con Supabase.' : 'Proyecto conectado en modo solo lectura.', state.canEdit ? 'success' : 'warning');
  };

  setModalMode('create');
  renderTasks([]);
  setDirectory(collectAssigneesFromTasks(state.allTasks).map((name) => ({ name, role: 'user', userId: '' })));
  applyReadOnly();

  const rerender = () => renderBoard();
  [tasksFilterSelect, usersFilterSelect, tagsFilterSelect].forEach((el) => {
    if (el) el.addEventListener('change', rerender);
  });
  if (globalSearchInput) globalSearchInput.addEventListener('input', rerender);
  if (delayRadarFilterBtn) delayRadarFilterBtn.addEventListener('click', () => setDelayView('urgent'));
  if (delayRadarResetBtn) delayRadarResetBtn.addEventListener('click', () => setDelayView('all'));

  if (openCreateModalBtn) openCreateModalBtn.addEventListener('click', () => openModal());
  addTaskButtons.forEach((btn) => {
    btn.addEventListener('click', () => openModal({ preferredColumn: btn.getAttribute('data-target-column') || 'open-todo' }));
  });

  if (cancelCreateModalBtn) cancelCreateModalBtn.addEventListener('click', closeModal);
  if (deleteCardBtn) {
    deleteCardBtn.addEventListener('click', async () => {
      if (!state.canEdit || !state.editingTaskId) return;

      const taskId = state.editingTaskId;
      const cascadeIds = collectCascadeTaskIds(taskId);
      if (cascadeIds.length === 0) return;
      const childrenCount = Math.max(0, cascadeIds.length - 1);
      const question = childrenCount > 0
        ? `Se eliminara esta tarea y ${childrenCount} subtarea(s) en cascada. Continuar?`
        : 'Se eliminara esta tarea. Continuar?';
      if (!window.confirm(question)) return;

      const originalLabel = deleteCardBtn.textContent;
      deleteCardBtn.disabled = true;
      deleteCardBtn.textContent = 'Eliminando...';
      try {
        let deletedCount = 0;
        if (state.supabase && state.activeProject) {
          deletedCount = await deleteTaskCascadeInSupabase(taskId);
          closeModal();
          await refreshFromSupabase();
        } else {
          deletedCount = deleteTaskCascadeLocal(taskId);
          closeModal();
        }
        if (deletedCount > 1) {
          setStatus(`Eliminacion en cascada completada (${deletedCount} tareas).`, 'success');
        } else {
          setStatus('Tarea eliminada.', 'success');
        }
      } catch (error) {
        console.error(error);
        setStatus('No se pudo eliminar la tarea en cascada.', 'error');
      } finally {
        deleteCardBtn.disabled = false;
        deleteCardBtn.textContent = originalLabel || 'Eliminar';
      }
    });
  }
  if (createCardModal) {
    createCardModal.addEventListener('click', (event) => {
      if (event.target === createCardModal) closeModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && createCardModal && !createCardModal.classList.contains('hidden')) closeModal();
  });

  if (createCardForm) {
    createCardForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.canEdit) { setStatus('Permiso de solo lectura en este proyecto.', 'warning'); return; }

      const data = new FormData(createCardForm);
      const title = text(data.get('title'));
      const selectedDepartments = getSelectedDepartments();
      const department = joinTaskDepartments(selectedDepartments);
      const status = text(data.get('column')) || 'open-todo';
      const assignees = sanitizeAssignees(data.getAll('assignees'));
      const priority = priorityOf(data.get('priority'));
      const schedule = readTaskScheduleFromInputs();

      if (!title) { if (newCardTitleInput) newCardTitleInput.focus(); return; }
      if (selectedDepartments.length === 0) {
        setStatus('Selecciona al menos un departamento.', 'warning');
        focusDepartmentsField();
        return;
      }
      if (!VALID_STATUSES.has(status)) { setStatus('Estado de tarea no valido.', 'error'); return; }
      if (!schedule.start_date || !schedule.end_date) {
        setStatus('Debes indicar fecha de inicio y fecha final.', 'warning');
        if (newCardStartDateInput && !schedule.start_date) newCardStartDateInput.focus();
        else if (newCardEndDateInput && !schedule.end_date) newCardEndDateInput.focus();
        return;
      }
      if (schedule.end_date < schedule.start_date) {
        setStatus('La fecha final no puede ser anterior a la fecha de inicio.', 'warning');
        if (newCardEndDateInput) newCardEndDateInput.focus();
        return;
      }

      const taskId = state.editingTaskId || createId();
      let parentTaskId = text(data.get('parent_task_id')) || null;
      if (parentTaskId === taskId) parentTaskId = null;

      const parentMap = new Map(state.allTasks.map((row) => [row.id, row.parent_task_id]));
      let cursor = parentTaskId;
      let safety = 0;
      while (cursor && safety < state.allTasks.length + 5) {
        if (cursor === taskId) {
          setStatus('No se puede guardar: la tarea padre crea un ciclo.', 'error');
          return;
        }
        cursor = parentMap.get(cursor) || null;
        safety += 1;
      }

      const payload = sanitizeTask({
        id: taskId,
        title,
        department,
        status,
        assignees,
        priority,
        parent_task_id: parentTaskId,
        start_date: schedule.start_date,
        end_date: schedule.end_date,
      });

      if (hasIncompleteChildren(payload.id, payload.status)) {
        setStatus('No puedes completar una tarea padre si alguna hija no esta en Completed.', 'warning');
        return;
      }
      // 👉 1. reconstruimos lista local con el cambio
      let nextTasks = [...state.allTasks];
      const existingIndex = nextTasks.findIndex((row) => row.id === payload.id);

      if (existingIndex >= 0) nextTasks[existingIndex] = payload;
      else nextTasks.push(payload);

      // 👉 2. sincronizamos padres
      nextTasks = syncParentChainLocal(payload.id, nextTasks);

      // 👉 3. detectar cambios reales
      const changedTasks = nextTasks.filter((task) => {
        const prev = state.allTasks.find((row) => row.id === task.id);
        return hasTaskChanged(prev, task);
      });

      if (changedTasks.length === 0) {
        closeModal();
        return;
      }

      if (state.supabase) {
        try {
          // 👉 guardamos TODOS los afectados (hijo + padres)
          for (const t of changedTasks) {
            const exists = state.allTasks.find((row) => row.id === t.id);
            if (exists) await saveTask(t);
            else await createTask(t);
          }

          setStatus(state.editingTaskId ? 'Tarea actualizada en Supabase.' : 'Tarea creada en Supabase.', 'success');
          await refreshFromSupabase();
        } catch (error) {
          console.error(error);
          setStatus('Error al guardar tareas.', 'error');
          return;
        }
      } else {
        state.allTasks = nextTasks;
        renderTasks(state.allTasks);
      }

      closeModal();
    });
  }

  if (taskCommentForm) {
    taskCommentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.canEdit || !state.supabase || !state.editingTaskId) return;
      const content = text(newTaskCommentInput ? newTaskCommentInput.value : '');
      if (!content) return;
      try {
        const { error } = await state.supabase.from(COMMENTS_TABLE).insert({
          task_id: state.editingTaskId,
          project_id: state.activeProject.id,
          author_id: state.currentUser ? state.currentUser.id : null,
          content,
        });
        if (error) throw error;
        taskCommentForm.reset();
        await fetchSearchIndex();
        await loadTaskDetails(state.editingTaskId, true);
        renderBoard();
        setStatus('Comentario guardado.', 'success');
      } catch (error) {
        console.error(error);
        setStatus('No se pudo guardar el comentario.', 'error');
      }
    });
  }

  if (uploadAttachmentBtn) {
    uploadAttachmentBtn.addEventListener('click', async () => {
      if (!state.canEdit || !state.supabase || !state.editingTaskId) return;
      const file = taskAttachmentInput && taskAttachmentInput.files ? taskAttachmentInput.files[0] : null;
      if (!file) { setStatus('Selecciona un archivo para subir.', 'warning'); return; }

      const filePath = buildAttachmentPath(state.editingTaskId, file.name);
      try {
        const upload = await state.supabase.storage.from(ATTACHMENTS_BUCKET).upload(filePath, file, { cacheControl: '3600', upsert: false });
        if (upload.error) throw upload.error;

        const { error } = await state.supabase.from(ATTACHMENTS_TABLE).insert({
          task_id: state.editingTaskId,
          project_id: state.activeProject.id,
          owner_id: state.currentUser ? state.currentUser.id : null,
          file_name: file.name,
          file_path: filePath,
          mime_type: file.type || 'application/octet-stream',
          file_size: file.size || 0,
        });
        if (error) throw error;

        if (taskAttachmentInput) taskAttachmentInput.value = '';
        await fetchSearchIndex();
        await loadTaskDetails(state.editingTaskId, true);
        renderBoard();
        setStatus('Adjunto subido correctamente.', 'success');
      } catch (error) {
        console.error(error);
        setStatus('No se pudo subir el adjunto.', 'error');
      }
    });
  }

  columns.forEach((column) => {
    column.addEventListener('dragover', (event) => {
      if (!state.canEdit) return;
      event.preventDefault();
      if (!state.draggedCard) return;

      const cards = [...column.querySelectorAll('.card:not(.dragging)')];
      const target = cards.reduce((closest, card) => {
        const box = card.getBoundingClientRect();
        const offset = event.clientY - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: card };
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;

      if (target) column.insertBefore(state.draggedCard, target);
      else column.appendChild(state.draggedCard);
    });

    column.addEventListener('drop', async (event) => {
      if (!state.canEdit) return;
      event.preventDefault();
      if (!state.draggedCard) return;
      const task = taskFromCard(state.draggedCard);

      // Si se arrastra una tarea PADRE a "done", pedir confirmación y completar hijos
      let descendantsToDone = [];
      if (task.status === 'done') {
        const children = getDirectChildren(task.id);
        if (children.length > 0) {
          const confirmed = await showChildrenConfirmModal(children);
          if (!confirmed) {
            renderBoard();
            return;
          }
          descendantsToDone = collectCascadeTaskIds(task.id).filter((id) => id !== text(task.id));
        }
      }

      // 👉 reconstruir lista
      let nextTasks = [...state.allTasks];
      const index = nextTasks.findIndex((row) => row.id === task.id);
      if (index >= 0) nextTasks[index] = task;
      else nextTasks.push(task);

      // Aplicar done a descendientes (tras construir nextTasks para que changedTasks los detecte)
      if (descendantsToDone.length > 0) {
        nextTasks = nextTasks.map((t) =>
          descendantsToDone.includes(text(t.id)) ? { ...t, status: 'done' } : t
        );
      }

      // 👉 recalcular padres
      nextTasks = syncParentChainLocal(task.id, nextTasks);

      // 👉 detectar cambios
      const changedTasks = nextTasks.filter((t) => {
        const prev = state.allTasks.find((row) => row.id === t.id);
        return hasTaskChanged(prev, t);
      });

      if (state.supabase) {
        try {
          for (const t of changedTasks) {
            const exists = state.allTasks.find((row) => row.id === t.id);
            if (exists) await saveTask(t);
            else await createTask(t);
          }
          setStatus('Cambios sincronizados con Supabase.', 'success');
          await refreshFromSupabase();
        } catch (error) {
          console.error(error);
          setStatus('No se pudo sincronizar este cambio.', 'error');
        }
      } else {
        state.allTasks = nextTasks;
        renderTasks(state.allTasks);
      }
      updateProgress();
    });
  });

  if (pageParams.get('new') === '1') openModal({ preferredColumn: 'open-todo' });

  window.addEventListener('beforeunload', () => {
    if (state.delayRefreshTimer) {
      window.clearTimeout(state.delayRefreshTimer);
      state.delayRefreshTimer = null;
    }
    if (state.realtimeChannels.length > 0 && state.supabase) {
      state.realtimeChannels.forEach((channel) => state.supabase.removeChannel(channel));
    }
  });

  initializeSupabase().catch((error) => {
    if (app && app.isAuthRequiredError && app.isAuthRequiredError(error)) {
      app.redirectToLogin();
      return;
    }
    console.error(error);
    setStatus('Error de Supabase: revisa sesion, tablas y politicas RLS.', 'error');
  });
})();
