(() => {
  const STATUS_CLASS_NAMES = Object.freeze(["is-info", "is-success", "is-warning", "is-error"]);

  const text = (value) => String(value || "").trim();

  const normalizeKey = (value) =>
    text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const pad2 = (value) => String(value).padStart(2, "0");

  const isValidIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

  const parseIsoDate = (value) => {
    if (!isValidIsoDate(value)) return null;
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const toIsoDate = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  };

  const addDaysToIso = (value, days) => {
    const parsed = parseIsoDate(value);
    if (!parsed) return null;
    parsed.setDate(parsed.getDate() + Number(days || 0));
    return toIsoDate(parsed);
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const formatDayCount = (days) => `${days} dia${days === 1 ? "" : "s"}`;
  const getTodayIso = () => toIsoDate(new Date()) || "";

  const diffIsoDays = (fromIso, toIso) => {
    const fromDate = parseIsoDate(fromIso);
    const toDate = parseIsoDate(toIso);
    if (!fromDate || !toDate) return null;
    return Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS);
  };

  const createLocalId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      const safeValue = char === "x" ? random : (random & 0x3) | 0x8;
      return safeValue.toString(16);
    });
  };

  const sanitizeAssignees = (value, options = {}) => {
    const values = Array.isArray(value) ? value : String(value || "").split(/[,;\n]/);
    const normalizeFn = typeof options.normalizeFn === "function" ? options.normalizeFn : normalizeKey;
    const seen = new Set();

    return values
      .map((entry) => text(entry))
      .filter(Boolean)
      .filter((entry) => {
        const key = normalizeFn(entry);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const formatDateEs = (isoValue, fallback = "Sin fecha") => {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString("es-ES");
  };

  const getTaskRiskInfo = (task, options = {}) => {
    const safeTask = task || {};
    const status = text(safeTask.status).toLowerCase();
    const priority = text(safeTask.priority).toLowerCase() || "medium";
    const endIso = isValidIsoDate(safeTask.end_date) ? text(safeTask.end_date) : "";
    const todayIso = text(options.todayIso) || getTodayIso();
    const deadlineLabel = endIso ? formatDateEs(endIso, endIso) : "";
    const blockedByDependency = options.blockedByDependency === true;
    const criticalPath = options.criticalPath === true;
    const criticalThresholdDays = Math.max(1, Number(options.criticalThresholdDays) || 3);
    const criticalPriorityWindow = Math.max(0, Number(options.criticalPriorityWindow) || 2);
    const daysLeft = endIso && todayIso ? diffIsoDays(todayIso, endIso) : null;

    if (!endIso) {
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
        criticalPath,
        isCritical: false,
      };
    }

    if (status === "done") {
      if (daysLeft != null && daysLeft < 0) {
        return {
          state: "done-late",
          label: "Cerrada tarde",
          detail: `Se cerro ${formatDayCount(Math.abs(daysLeft))} despues del plazo${deadlineLabel ? ` (${deadlineLabel})` : ""}.`,
          daysLeft,
          severity: -1,
          deadlineLabel,
          baseState: "done-late",
          reason: "done-late",
          blockedByDependency: false,
          criticalPath,
          isCritical: false,
        };
      }

      return {
        state: "done",
        label: "Completada",
        detail: deadlineLabel ? `Cerrada dentro del plazo (${deadlineLabel}).` : "Cerrada sin fecha limite.",
        daysLeft,
        severity: -2,
        deadlineLabel,
        baseState: "done",
        reason: "done",
        blockedByDependency: false,
        criticalPath,
        isCritical: false,
      };
    }

    if (daysLeft == null) {
      return {
        state: "no-date",
        label: "Sin fecha limite",
        detail: "No se pudo calcular la fecha final.",
        daysLeft: null,
        severity: -1,
        deadlineLabel: "",
        baseState: "no-date",
        reason: "no-date",
        blockedByDependency: false,
        criticalPath,
        isCritical: false,
      };
    }

    let baseState = "on-track";
    let label = `Quedan ${formatDayCount(daysLeft)}`;
    let detail = deadlineLabel ? `Fecha limite ${deadlineLabel}.` : "Fecha limite programada.";
    let severity = 0;

    if (daysLeft < 0) {
      baseState = "overdue";
      label = `Retrasada ${formatDayCount(Math.abs(daysLeft))}`;
      detail = `Vencio hace ${formatDayCount(Math.abs(daysLeft))}${deadlineLabel ? ` (${deadlineLabel})` : ""}.`;
      severity = 3;
    } else if (daysLeft === 0) {
      baseState = "due-today";
      label = "Vence hoy";
      detail = deadlineLabel ? `La fecha limite es hoy (${deadlineLabel}).` : "La fecha limite es hoy.";
      severity = 2;
    } else if (daysLeft <= 2) {
      baseState = "due-soon";
      label = `Vence en ${formatDayCount(daysLeft)}`;
      detail = deadlineLabel ? `Quedan ${formatDayCount(daysLeft)} (${deadlineLabel}).` : `Quedan ${formatDayCount(daysLeft)}.`;
      severity = 1;
    }

    const isCriticalOverdue = daysLeft < 0 && Math.abs(daysLeft) >= criticalThresholdDays;
    const isCriticalPriority = priority === "critical" && daysLeft <= criticalPriorityWindow;
    const isDependencyCritical = blockedByDependency === true;
    const criticalReason = isDependencyCritical
      ? "dependency"
      : isCriticalOverdue
        ? "overdue"
        : isCriticalPriority
          ? "priority"
          : "";

    if (criticalReason) {
      baseState = "critical";
      severity = 4;
      if (criticalReason === "dependency") {
        label = "Critica por dependencia";
        detail = deadlineLabel
          ? `Una dependencia atrasada bloquea esta tarea (${deadlineLabel}).`
          : "Una dependencia atrasada bloquea esta tarea.";
      } else if (criticalReason === "priority") {
        label = "Critica";
        detail = deadlineLabel
          ? `La prioridad critica deja poco margen (${deadlineLabel}).`
          : "La prioridad critica deja poco margen.";
      } else {
        label = `Critica ${formatDayCount(Math.abs(daysLeft))}`;
        detail = `Vencio hace ${formatDayCount(Math.abs(daysLeft))}${deadlineLabel ? ` (${deadlineLabel})` : ""}.`;
      }
    }

    if (criticalPath) {
      detail = `${detail} Forma parte de la ruta critica.`;
    }

    return {
      state: baseState,
      label,
      detail,
      daysLeft,
      severity,
      deadlineLabel,
      baseState,
      reason: criticalReason || baseState,
      blockedByDependency,
      criticalPath,
      isCritical: baseState === "critical",
    };
  };

  const setStatus = (element, message, type = "info") => {
    if (!element) return;
    element.textContent = String(message || "");
    element.classList.remove(...STATUS_CLASS_NAMES);
    const safeType = ["info", "success", "warning", "error"].includes(type) ? type : "info";
    element.classList.add(`is-${safeType}`);
  };

  window.KanbanUtils = Object.freeze({
    text,
    normalizeKey,
    pad2,
    isValidIsoDate,
    parseIsoDate,
    toIsoDate,
    addDaysToIso,
    createLocalId,
    sanitizeAssignees,
    formatDateEs,
    getTodayIso,
    diffIsoDays,
    getTaskRiskInfo,
    setStatus,
  });
})();
