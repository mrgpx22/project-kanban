(() => {
  const projectGrid = document.querySelector("#projectGrid");
  if (!projectGrid) return;

  const syncStatus = document.querySelector("#syncStatus");
  const dashboardSection = document.querySelector("#dashboardSection");
  const dashboardTotalTasks = document.querySelector("#dashboardTotalTasks");
  const dashboardPendingTasks = document.querySelector("#dashboardPendingTasks");
  const dashboardDoneTasks = document.querySelector("#dashboardDoneTasks");
  const dashboardHighPriorityTasks = document.querySelector("#dashboardHighPriorityTasks");
  const workloadByPerson = document.querySelector("#workloadByPerson");
  const workloadByDepartment = document.querySelector("#workloadByDepartment");
  const currentUserLabel = document.querySelector("#currentUserLabel");
  const currentRoleLabel = document.querySelector("#currentRoleLabel");
  const emptyProjects = document.querySelector("#emptyProjects");
  const openCreateProjectBtn = document.querySelector("#openCreateProject");
  const openPeopleDirectoryBtn = document.querySelector("#openPeopleDirectory");
  const signOutBtn = document.querySelector("#signOutBtn");
  const createProjectModal = document.querySelector("#createProjectModal");
  const cancelCreateProjectBtn = document.querySelector("#cancelCreateProject");
  const createProjectForm = document.querySelector("#createProjectForm");
  const createProjectTitle = document.querySelector("#createProjectTitle");
  const createProjectSubmitBtn = createProjectForm ? createProjectForm.querySelector('button[type="submit"]') : null;
  const projectNameInput = document.querySelector("#projectName");
  const projectDescriptionInput = document.querySelector("#projectDescription");
  const projectTypeSelect = document.querySelector("#projectType");
  const projectDepartmentsField = document.querySelector("#projectDepartmentsField");
  const projectDepartmentsChecklist = document.querySelector("#projectDepartmentsChecklist");
  const projectPeopleField = document.querySelector("#projectPeopleField");
  const projectPeopleChecklist = document.querySelector("#projectPeopleChecklist");
  const projectSearchInput = document.querySelector("#projectSearchInput");
  const projectTagButtons = [...document.querySelectorAll(".project-tag-btn")];

  const manageMembersModal = document.querySelector("#manageMembersModal");
  const manageMembersTitle = document.querySelector("#manageMembersTitle");
  const membersProjectName = document.querySelector("#membersProjectName");
  const closeMembersModalBtn = document.querySelector("#closeMembersModal");
  const addMemberForm = document.querySelector("#addMemberForm");
  const memberUserSelect = document.querySelector("#memberUserSelect");
  const memberPermissionSelect = document.querySelector("#memberPermission");
  const membersStatus = document.querySelector("#membersStatus");
  const membersList = document.querySelector("#membersList");
  const availableUsersList = document.querySelector("#availableUsersList");
  const peopleDirectoryModal = document.querySelector("#peopleDirectoryModal");
  const closePeopleDirectoryBtn = document.querySelector("#closePeopleDirectory");
  const peopleForm = document.querySelector("#peopleForm");
  const peopleFormResetBtn = document.querySelector("#peopleFormReset");
  const personUserIdInput = document.querySelector("#personUserId");
  const personNameInput = document.querySelector("#personName");
  const personLast1Input = document.querySelector("#personLast1");
  const personLast2Input = document.querySelector("#personLast2");
  const personJobInput = document.querySelector("#personJob");
  const personDeptInput = document.querySelector("#personDept");
  const peopleStatus = document.querySelector("#peopleStatus");
  const peopleTableBody = document.querySelector("#peopleTableBody");
  const createAuthUserForm = document.querySelector("#createAuthUserForm");
  const authCreateFormResetBtn = document.querySelector("#authCreateFormReset");
  const authEmailInput = document.querySelector("#authEmailInput");
  const authPasswordInput = document.querySelector("#authPasswordInput");
  const authRoleSelect = document.querySelector("#authRoleSelect");
  const authDisplayNameInput = document.querySelector("#authDisplayNameInput");
  const authFirstNameInput = document.querySelector("#authFirstNameInput");
  const authLast1Input = document.querySelector("#authLast1Input");
  const authLast2Input = document.querySelector("#authLast2Input");
  const authJobTitleInput = document.querySelector("#authJobTitleInput");
  const authDepartmentInput = document.querySelector("#authDepartmentInput");
  const authCreateStatus = document.querySelector("#authCreateStatus");

  const app = window.KanbanApp;
  const utils = window.KanbanUtils;
  const COMPLETE_STAMP_SRC = (() => {
    const script = document.querySelector('script[src*="main.js"]');
    if (script && script.src) {
      try {
        return new URL("../img/completed.png", script.src).href;
      } catch (error) {
        console.warn(error);
      }
    }
    return "assets/img/completed.png";
  })();

  const MEMBER_PERMISSIONS = Object.freeze(["viewer", "editor", "manager"]);

  const state = {
    supabase: null,
    user: null,
    profile: null,
    mode: "user",
    projects: [],
    projectStatsByProjectId: new Map(),
    projectSearchQuery: "",
    projectTopic: "all",
    realtimeChannels: [],
    refreshTimer: null,
    activeMembersProject: null,
    assignableUsers: [],
    peopleRows: [],
    dashboardTaskRows: [],
    editingProjectId: "",
    projectDepartmentOptions: [],
    projectPeopleOptions: [],
  };

  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || "").trim()
    );

  const roleLabel = (role) => (app && app.roleToLabel ? app.roleToLabel(role) : role);

  const permissionLabel = (permission) =>
    app && app.projectPermissionToLabel ? app.projectPermissionToLabel(permission) : String(permission || "editor");

  const normalizePermission = (permission) =>
    app && app.normalizeProjectPermission ? app.normalizeProjectPermission(permission) : "editor";
  const canManageMembers = () => !!(state.profile && state.profile.role === "jefe");

  const setStatus = (element, message, type = "info") => {
    if (utils && typeof utils.setStatus === "function") {
      utils.setStatus(element, message, type);
      return;
    }
    if (!element) return;
    element.textContent = message;
    element.classList.remove("is-info", "is-success", "is-warning", "is-error");
    element.classList.add(`is-${type}`);
  };

  const setSyncStatus = (message, type = "info") => {
    setStatus(syncStatus, message, type);
  };

  const setMembersStatus = (message, type = "info") => {
    setStatus(membersStatus, message, type);
  };

  const setPeopleStatus = (message, type = "info") => {
    setStatus(peopleStatus, message, type);
  };

  const setAuthCreateStatus = (message, type = "info") => {
    setStatus(authCreateStatus, message, type);
  };

  const textValue = (value) =>
    utils && typeof utils.text === "function" ? utils.text(value) : String(value || "").trim();
  const normalizeSearchText = (value) =>
    utils && typeof utils.normalizeKey === "function"
      ? utils.normalizeKey(value)
      : String(value || "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
  const normalizeAppRole = (value) => (String(value || "").trim().toLowerCase() === "jefe" ? "jefe" : "user");
  const PROJECT_TYPE_LABELS = Object.freeze({
    ia: "IA",
    idi: "I+D+i",
    web: "Web",
  });
  const PROJECT_TYPE_TOKEN = /^\[TYPE:(ia|idi|web)\]\s*/i;

  const normalizeProjectType = (value) => {
    const safe = normalizeSearchText(value);
    if (safe === "ia") return "ia";
    if (safe === "idi" || safe === "i+d+i" || safe === "i d i") return "idi";
    return "web";
  };

  const projectTypeLabel = (type) => PROJECT_TYPE_LABELS[normalizeProjectType(type)] || PROJECT_TYPE_LABELS.web;

  const inferProjectType = (name, description) => {
    const bag = normalizeSearchText(`${textValue(name)} ${textValue(description)}`);
    if (/\bia\b/.test(bag) || /(^|[^a-z0-9])ai([^a-z0-9]|$)/.test(bag) || bag.includes("inteligencia artificial")) {
      return "ia";
    }
    if (
      bag.includes("i+d+i") ||
      bag.includes("i d i") ||
      /(^|[^a-z0-9])idi([^a-z0-9]|$)/.test(bag) ||
      bag.includes("investigacion") ||
      bag.includes("desarrollo") ||
      bag.includes("innovacion")
    ) {
      return "idi";
    }
    return "web";
  };

  const getProjectMeta = (project) => {
    const rawName = textValue(project && project.name);
    const rawDescription = textValue(project && project.description);
    const match = rawDescription.match(PROJECT_TYPE_TOKEN);
    const explicitType = match ? normalizeProjectType(match[1]) : "";
    const cleanDescription = match ? rawDescription.slice(match[0].length).trim() : rawDescription;
    const type = explicitType || inferProjectType(rawName, cleanDescription);

    return {
      type,
      typeLabel: projectTypeLabel(type),
      description: cleanDescription,
    };
  };

  const normalizeDepartmentKey = (value) => normalizeSearchText(value);
  const splitDepartments = (value) =>
    String(value || "")
      .split(/[,\n;|/]+/)
      .map((part) => textValue(part))
      .filter(Boolean);

  const setProjectCreateAssignVisibility = (visible) => {
    if (projectDepartmentsField) {
      projectDepartmentsField.classList.toggle("hidden", !visible);
    }
    if (projectPeopleField) {
      projectPeopleField.classList.toggle("hidden", !visible);
    }
    if (visible) return;
    if (projectDepartmentsChecklist) {
      const checks = projectDepartmentsChecklist.querySelectorAll('input[type="checkbox"]');
      checks.forEach((check) => {
        check.checked = false;
      });
    }
    if (projectPeopleChecklist) {
      const checks = projectPeopleChecklist.querySelectorAll('input[type="checkbox"]');
      checks.forEach((check) => {
        check.checked = false;
      });
    }
  };

  const renderProjectDepartmentsChecklist = () => {
    if (!projectDepartmentsChecklist) return;
    projectDepartmentsChecklist.innerHTML = "";

    if (!Array.isArray(state.projectDepartmentOptions) || state.projectDepartmentOptions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "project-dept-empty";
      empty.textContent = "No hay departamentos disponibles en kanban_users.";
      projectDepartmentsChecklist.appendChild(empty);
      return;
    }

    state.projectDepartmentOptions.forEach((row) => {
      const label = document.createElement("label");
      label.className = "project-dept-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "project_departments";
      input.value = row.key;
      input.dataset.departmentLabel = row.label;

      const text = document.createElement("span");
      text.textContent = `${row.label} (${row.count})`;

      label.appendChild(input);
      label.appendChild(text);
      projectDepartmentsChecklist.appendChild(label);
    });
  };

  const renderProjectPeopleChecklist = () => {
    if (!projectPeopleChecklist) return;
    projectPeopleChecklist.innerHTML = "";

    if (!Array.isArray(state.projectPeopleOptions) || state.projectPeopleOptions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "project-dept-empty";
      empty.textContent = "No hay personas disponibles en kanban_users.";
      projectPeopleChecklist.appendChild(empty);
      return;
    }

    state.projectPeopleOptions.forEach((person) => {
      const label = document.createElement("label");
      label.className = "project-dept-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "project_people";
      input.value = person.user_id;

      const text = document.createElement("span");
      text.textContent = person.full_name;
      const sub = document.createElement("small");
      sub.className = "project-person-sub";
      sub.textContent = person.department || "Sin departamento";
      text.appendChild(sub);

      label.appendChild(input);
      label.appendChild(text);
      projectPeopleChecklist.appendChild(label);
    });
  };

  const loadProjectCreateAssignOptions = async () => {
    if (!state.supabase || !app || !app.tables || !app.tables.users) return;

    const { data, error } = await state.supabase
      .from(app.tables.users)
      .select("user_id,display_name,first_name,last_name_1,last_name_2,department");
    if (error) throw error;

    const departmentMap = new Map();
    const people = [];
    (Array.isArray(data) ? data : []).forEach((row) => {
      const userId = textValue(row && row.user_id);
      if (!userId) return;

      const fullName = personDisplayName(row || { user_id: userId });
      const departments = splitDepartments(row && row.department);
      departments.forEach((department) => {
        const key = normalizeDepartmentKey(department);
        if (!key) return;
        const current = departmentMap.get(key) || { key, label: department, count: 0 };
        current.count += 1;
        departmentMap.set(key, current);
      });

      people.push({
        user_id: userId,
        full_name: fullName,
        department: departments.join(", "),
      });
    });

    state.projectDepartmentOptions = [...departmentMap.values()].sort((a, b) =>
      String(a.label || "").localeCompare(String(b.label || ""), "es", { sensitivity: "base" })
    );
    state.projectPeopleOptions = people.sort((a, b) =>
      String(a.full_name || "").localeCompare(String(b.full_name || ""), "es", { sensitivity: "base" })
    );
  };

  const getSelectedProjectDepartments = () => {
    if (!projectDepartmentsChecklist) return [];
    const checks = [...projectDepartmentsChecklist.querySelectorAll('input[type="checkbox"]:checked')];
    return checks.map((check) => textValue(check.dataset.departmentLabel || check.value)).filter(Boolean);
  };

  const getSelectedProjectPeople = () => {
    if (!projectPeopleChecklist) return [];
    const checks = [...projectPeopleChecklist.querySelectorAll('input[type="checkbox"]:checked')];
    return checks.map((check) => textValue(check.value)).filter(Boolean);
  };

  const addSelectedMembersToProject = async (projectId, selectedDepartments, selectedPeople) => {
    const safeProjectId = textValue(projectId);
    if (!safeProjectId) return 0;

    const departmentKeys = new Set(
      (Array.isArray(selectedDepartments) ? selectedDepartments : [])
        .flatMap((department) => splitDepartments(department))
        .map((department) => normalizeDepartmentKey(department))
        .filter(Boolean)
    );
    const selectedUserIds = new Set((Array.isArray(selectedPeople) ? selectedPeople : []).map((id) => textValue(id)).filter(Boolean));
    if (departmentKeys.size === 0 && selectedUserIds.size === 0) return 0;

    const { data, error } = await state.supabase.from(app.tables.users).select("user_id,department");
    if (error) throw error;

    const rows = [];
    const seen = new Set();
    (Array.isArray(data) ? data : []).forEach((user) => {
      const userId = textValue(user && user.user_id);
      if (!userId || seen.has(userId)) return;

      const includeByPerson = selectedUserIds.has(userId);
      const userDepartmentKeys = splitDepartments(user && user.department).map((value) => normalizeDepartmentKey(value));
      const includeByDepartment =
        departmentKeys.size > 0 && userDepartmentKeys.some((departmentKey) => departmentKeys.has(departmentKey));
      if (!includeByPerson && !includeByDepartment) return;

      seen.add(userId);
      rows.push({
        project_id: safeProjectId,
        user_id: userId,
        permission: "editor",
      });
    });

    if (rows.length === 0) return 0;

    const { error: upsertError } = await state.supabase
      .from(app.tables.members)
      .upsert(rows, { onConflict: "project_id,user_id" });
    if (upsertError) throw upsertError;

    return rows.length;
  };

  const personDisplayName = (person) => {
    const fullName = [person.first_name, person.last_name_1, person.last_name_2]
      .map((value) => textValue(value))
      .filter(Boolean)
      .join(" ");
    if (fullName) return fullName;
    if (textValue(person.display_name)) return textValue(person.display_name);
    const userId = textValue(person.user_id);
    return userId ? `Usuario ${userId.slice(0, 8)}` : "Usuario";
  };

  const formatDate = (isoValue) =>
    utils && typeof utils.formatDateEs === "function"
      ? utils.formatDateEs(isoValue, "Sin fecha")
      : (() => {
          const date = new Date(isoValue);
          if (Number.isNaN(date.getTime())) return "Sin fecha";
          return date.toLocaleDateString("es-ES");
        })();

  const sanitizeAssignees = (assigneesValue) =>
    utils && typeof utils.sanitizeAssignees === "function"
      ? utils.sanitizeAssignees(assigneesValue, { normalizeFn: (value) => textValue(value).toLowerCase() })
      : (() => {
          const values = Array.isArray(assigneesValue) ? assigneesValue : String(assigneesValue || "").split(/[,;\n]/);
          const unique = [];
          const seen = new Set();
          values.forEach((value) => {
            const safe = textValue(value);
            if (!safe) return;
            const key = safe.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            unique.push(safe);
          });
          return unique;
        })();

  const renderWorkloadList = (element, groups, emptyLabel) => {
    if (!element) return;
    element.innerHTML = "";

    if (!Array.isArray(groups) || groups.length === 0) {
      const empty = document.createElement("li");
      empty.className = "workload-empty";
      empty.textContent = emptyLabel;
      element.appendChild(empty);
      return;
    }

    groups.forEach((group) => {
      const header = document.createElement("li");
      header.className = "workload-group-title";
      header.textContent = group.projectName;
      element.appendChild(header);

      group.rows.forEach((row) => {
        const item = document.createElement("li");
        item.className = "workload-item";

        const name = document.createElement("span");
        name.textContent = row.label;

        const value = document.createElement("strong");
        value.textContent = `${row.pending} pendientes / ${row.total}`;

        item.appendChild(name);
        item.appendChild(value);
        element.appendChild(item);
      });
    });
  };

  const computeDashboardMetrics = (taskRows) => {
    const tasks = Array.isArray(taskRows) ? taskRows : [];
    const projectNameById = new Map(
      (Array.isArray(state.projects) ? state.projects : []).map((project) => [
        String(project.id),
        textValue(project.name) || `Proyecto ${String(project.id).slice(0, 8)}`,
      ])
    );
    const total = tasks.length;
    const done = tasks.filter((task) => String(task.status) === "done").length;
    const pending = total - done;
    const highPriority = tasks.filter((task) => {
      const priority = String(task.priority || "").toLowerCase();
      return priority === "high" || priority === "critical";
    }).length;

    const personByProject = new Map();
    const departmentByProject = new Map();

    tasks.forEach((task) => {
      const status = String(task.status || "");
      const dept = textValue(task.department) || "General";
      const projectId = String(task.project_id || "");
      const projectName = projectNameById.get(projectId) || `Proyecto ${projectId.slice(0, 8) || "N/A"}`;
      const isPending = status !== "done";

      if (!departmentByProject.has(projectId)) {
        departmentByProject.set(projectId, { projectName, rows: new Map() });
      }
      const departmentGroup = departmentByProject.get(projectId);
      if (!departmentGroup.rows.has(dept)) {
        departmentGroup.rows.set(dept, { label: dept, total: 0, pending: 0 });
      }
      const departmentBucket = departmentGroup.rows.get(dept);
      departmentBucket.total += 1;
      if (isPending) departmentBucket.pending += 1;

      const assignees = sanitizeAssignees(task.assignees);
      const safeAssignees = assignees.length > 0 ? assignees : ["Sin asignar"];
      safeAssignees.forEach((assignee) => {
        if (!personByProject.has(projectId)) {
          personByProject.set(projectId, { projectName, rows: new Map() });
        }
        const personGroup = personByProject.get(projectId);
        if (!personGroup.rows.has(assignee)) {
          personGroup.rows.set(assignee, { label: assignee, total: 0, pending: 0 });
        }
        const personBucket = personGroup.rows.get(assignee);
        personBucket.total += 1;
        if (isPending) personBucket.pending += 1;
      });
    });

    const sortRows = (rows) =>
      rows.sort((a, b) => {
        if (b.pending !== a.pending) return b.pending - a.pending;
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
      });

    const toGroups = (groupMap) =>
      [...groupMap.values()]
        .sort((a, b) => a.projectName.localeCompare(b.projectName, "es", { sensitivity: "base" }))
        .map((group) => ({
          projectName: group.projectName,
          rows: sortRows([...group.rows.values()]),
        }));

    return {
      total,
      done,
      pending,
      highPriority,
      byPerson: toGroups(personByProject),
      byDepartment: toGroups(departmentByProject),
    };
  };

  const renderDashboard = (taskRows) => {
    const canViewDashboard = canManageMembers();
    if (dashboardSection) {
      dashboardSection.classList.toggle("hidden", !canViewDashboard);
    }
    if (!canViewDashboard) return;

    const metrics = computeDashboardMetrics(taskRows);
    if (dashboardTotalTasks) dashboardTotalTasks.textContent = String(metrics.total);
    if (dashboardPendingTasks) dashboardPendingTasks.textContent = String(metrics.pending);
    if (dashboardDoneTasks) dashboardDoneTasks.textContent = String(metrics.done);
    if (dashboardHighPriorityTasks) dashboardHighPriorityTasks.textContent = String(metrics.highPriority);

    renderWorkloadList(workloadByPerson, metrics.byPerson, "No hay carga por persona.");
    renderWorkloadList(workloadByDepartment, metrics.byDepartment, "No hay carga por departamento.");
  };

  const fetchTaskRowsForProjects = async (projectIds) => {
    if (!Array.isArray(projectIds) || projectIds.length === 0) return [];
    const { data, error } = await state.supabase
      .from(app.tables.tasks)
      .select("id,project_id,status,priority,department,assignees")
      .in("project_id", projectIds);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const resetCreateProjectDialogState = () => {
    state.editingProjectId = "";
    if (createProjectTitle) createProjectTitle.textContent = "Crear proyecto";
    if (createProjectSubmitBtn) createProjectSubmitBtn.textContent = "Crear proyecto";
    setProjectCreateAssignVisibility(true);
  };

  const openCreateProjectModal = async () => {
    if (!createProjectModal) return;
    resetCreateProjectDialogState();
    if (createProjectForm) createProjectForm.reset();
    try {
      await loadProjectCreateAssignOptions();
      renderProjectDepartmentsChecklist();
      renderProjectPeopleChecklist();
    } catch (error) {
      console.error(error);
      if (projectDepartmentsChecklist) {
        projectDepartmentsChecklist.innerHTML = "";
        const empty = document.createElement("p");
        empty.className = "project-dept-empty";
        empty.textContent = "No se pudo cargar departamentos desde kanban_users.";
        projectDepartmentsChecklist.appendChild(empty);
      }
      if (projectPeopleChecklist) {
        projectPeopleChecklist.innerHTML = "";
        const empty = document.createElement("p");
        empty.className = "project-dept-empty";
        empty.textContent = "No se pudo cargar personas desde kanban_users.";
        projectPeopleChecklist.appendChild(empty);
      }
      setSyncStatus("No se pudo cargar checklist de departamentos/personas.", "warning");
    }
    createProjectModal.classList.remove("hidden");
    createProjectModal.setAttribute("aria-hidden", "false");
    if (projectNameInput) projectNameInput.focus();
  };

  const openEditProjectModal = (project) => {
    if (!createProjectModal || !project) return;
    const projectId = textValue(project.id);
    if (!projectId) return;

    const meta = getProjectMeta(project);
    state.editingProjectId = projectId;
    if (createProjectTitle) createProjectTitle.textContent = "Editar proyecto";
    if (createProjectSubmitBtn) createProjectSubmitBtn.textContent = "Guardar cambios";

    if (createProjectForm) createProjectForm.reset();
    if (projectNameInput) projectNameInput.value = textValue(project.name);
    if (projectDescriptionInput) projectDescriptionInput.value = textValue(meta.description);
    if (projectTypeSelect) projectTypeSelect.value = normalizeProjectType(meta.type);
    setProjectCreateAssignVisibility(false);

    createProjectModal.classList.remove("hidden");
    createProjectModal.setAttribute("aria-hidden", "false");
    if (projectNameInput) projectNameInput.focus();
  };

  const closeCreateProjectModal = () => {
    if (!createProjectModal) return;
    createProjectModal.classList.add("hidden");
    createProjectModal.setAttribute("aria-hidden", "true");
    if (createProjectForm) createProjectForm.reset();
    resetCreateProjectDialogState();
  };

  const updateSessionStrip = () => {
    if (!state.user || !state.profile) return;
    if (currentUserLabel) {
      currentUserLabel.textContent = `Usuario: ${state.profile.display_name} (${String(state.user.id).slice(0, 8)})`;
    }
    if (currentRoleLabel) {
      currentRoleLabel.textContent = `Rol real: ${roleLabel(state.profile.role)}`;
    }
  };

  const updateJefeControls = () => {
    if (openPeopleDirectoryBtn) {
      if (canManageMembers()) {
        openPeopleDirectoryBtn.classList.remove("hidden");
      } else {
        openPeopleDirectoryBtn.classList.add("hidden");
      }
    }
    renderDashboard(state.dashboardTaskRows);
  };

  const createProjectLink = (href, text) => {
    const link = document.createElement("a");
    link.className = "project-link";
    link.href = href;
    link.textContent = text;
    return link;
  };

  const createManagePeopleButton = (project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-link project-action-btn";
    button.textContent = "Gestionar personas";
    button.addEventListener("click", () => {
      openManageMembersModal(project);
    });
    return button;
  };

  const canEditProject = (project) => {
    if (!project || !state.user || !state.profile) return false;
    if (normalizeAppRole(state.profile.role) === "jefe") return true;
    return String(project.created_by || "") === String(state.user.id || "");
  };

  const createEditProjectButton = (project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-mini project-action-btn";
    button.textContent = "Editar";
    button.addEventListener("click", () => {
      openEditProjectModal(project);
    });
    return button;
  };

  const createDeleteProjectButton = (project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-mini btn-danger project-action-btn";
    button.textContent = "Eliminar";
    button.addEventListener("click", async () => {
      const projectName = textValue(project && project.name) || "este proyecto";
      const confirmed = window.confirm(
        `Se eliminara "${projectName}" junto con sus tareas, dependencias, comentarios y adjuntos. Esta accion no se puede deshacer. Continuar?`
      );
      if (!confirmed) return;
      try {
        await deleteProject(project);
      } catch (error) {
        console.error(error);
        setSyncStatus("No se pudo eliminar el proyecto.", "error");
      }
    });
    return button;
  };

  const normalizeProjectTopic = (value) => {
    const safe = normalizeSearchText(value);
    if (safe === "ia" || safe === "idi" || safe === "web") return safe;
    return "all";
  };

  const hasProjectFilters = () =>
    normalizeSearchText(state.projectSearchQuery).length > 0 || normalizeProjectTopic(state.projectTopic) !== "all";

  const updateProjectTopicButtons = () => {
    projectTagButtons.forEach((button) => {
      const topic = normalizeProjectTopic(button.dataset.topic);
      button.classList.toggle("is-active", topic === state.projectTopic);
    });
  };

  const matchesProjectTopic = (project, topic) => {
    const normalizedTopic = normalizeProjectTopic(topic);
    if (normalizedTopic === "all") return true;
    const meta = getProjectMeta(project);
    return meta.type === normalizedTopic;
  };

  const applyProjectFilters = (projects) => {
    const list = Array.isArray(projects) ? projects : [];
    const queryKey = normalizeSearchText(state.projectSearchQuery);
    const topic = normalizeProjectTopic(state.projectTopic);

    return list.filter((project) => {
      const nameKey = normalizeSearchText(project && project.name);
      if (queryKey && !nameKey.includes(queryKey)) return false;
      return matchesProjectTopic(project, topic);
    });
  };

  const rerenderProjects = () => {
    renderProjects(applyProjectFilters(state.projects), state.projectStatsByProjectId);
  };

  const renderProjects = (projects, statsByProjectId) => {
    projectGrid.innerHTML = "";

    if (!projects.length) {
      if (emptyProjects) {
        emptyProjects.textContent = hasProjectFilters()
          ? "No hay proyectos que coincidan con los filtros."
          : "No hay proyectos disponibles para tu usuario.";
        emptyProjects.classList.remove("hidden");
      }
      return;
    }

    if (emptyProjects) {
      emptyProjects.textContent = "No hay proyectos disponibles para tu usuario.";
      emptyProjects.classList.add("hidden");
    }

    projects.forEach((project) => {
      const stats = statsByProjectId.get(String(project.id)) || { total: 0, done: 0, progress_percent: 0 };
      const projectProgressPercent = Number.isFinite(Number(stats.progress_percent))
        ? Math.max(0, Math.min(100, Math.round(Number(stats.progress_percent))))
        : (stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0);
      const links = app.getProjectLinks(String(project.id));

      const card = document.createElement("article");
      card.className = "project-card";
      const projectMeta = getProjectMeta(project);

      const title = document.createElement("h2");
      title.className = "project-title";
      title.textContent = project.name || "Proyecto sin nombre";

      const description = document.createElement("p");
      description.className = "project-description";
      description.textContent = projectMeta.description || "Sin descripcion.";

      const meta = document.createElement("div");
      meta.className = "project-meta";
      meta.innerHTML = `
        <span>Tipo: ${projectMeta.typeLabel}</span>
        <span>Creado: ${formatDate(project.created_at)}</span>
        <span>Tareas: ${stats.total}</span>
        <span>Completadas: ${stats.done}</span>
      `;

      const progress = document.createElement("div");
      progress.className = "project-progress";
      progress.innerHTML = `
        <span class="project-progress-label">Progreso: ${projectProgressPercent}%</span>
        <div class="project-progress-track">
          <div class="project-progress-bar" style="width:${projectProgressPercent}%"></div>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "project-actions";
      actions.appendChild(createProjectLink(links.kanban, "Abrir Kanban"));
      actions.appendChild(createProjectLink(links.calendar, "Abrir Calendar"));
      actions.appendChild(createProjectLink(links.gantt, "Abrir Gantt"));
      actions.appendChild(createProjectLink(links.notes, "Abrir Notas"));

      if (state.profile && state.profile.role === "jefe") {
        actions.appendChild(createManagePeopleButton(project));
      }
      if (canEditProject(project)) {
        actions.appendChild(createEditProjectButton(project));
      }
      if (canManageMembers()) {
        actions.appendChild(createDeleteProjectButton(project));
      }

      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(meta);
      card.appendChild(progress);
      card.appendChild(actions);

      const showCompleteStamp = stats.total > 0 && projectProgressPercent === 100;
      const stamp = document.createElement("div");
      stamp.className = "project-complete-stamp";
      stamp.innerHTML = `<img src="${COMPLETE_STAMP_SRC}" alt="Proyecto completado" loading="lazy" decoding="async">`;
      card.appendChild(stamp);

      if (showCompleteStamp) {
        card.classList.add("project-complete");
      }

      projectGrid.appendChild(card);
    });
  };

  const loadProjects = async () => {
    if (!state.supabase || !state.user || !state.profile) return;
    setSyncStatus("Cargando proyectos...", "info");

    try {
      const projects = await app.fetchProjectsForMode({
        supabaseClient: state.supabase,
        userId: state.user.id,
        profileRole: state.profile.role,
        mode: state.mode,
      });

      state.projects = projects;
      const projectIds = projects.map((project) => String(project.id));
      const statsByProjectId = await app.fetchProjectTaskStats(state.supabase, projectIds);
      state.projectStatsByProjectId = statsByProjectId;
      state.dashboardTaskRows = canManageMembers() ? await fetchTaskRowsForProjects(projectIds) : [];
      const filteredProjects = applyProjectFilters(projects);
      renderProjects(filteredProjects, statsByProjectId);
      renderDashboard(state.dashboardTaskRows);
      if (hasProjectFilters()) {
        setSyncStatus(`Proyectos cargados: ${projects.length}. Mostrando ${filteredProjects.length} por filtros.`, "success");
      } else {
        setSyncStatus(`Proyectos cargados: ${projects.length}.`, "success");
      }
    } catch (error) {
      console.error(error);
      setSyncStatus("No se pudieron cargar los proyectos.", "error");
      renderDashboard([]);
    }
  };

  const scheduleProjectReload = () => {
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
    }
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      loadProjects();
    }, 140);
  };

  const closeManageMembersModal = () => {
    if (!manageMembersModal) return;
    manageMembersModal.classList.add("hidden");
    manageMembersModal.setAttribute("aria-hidden", "true");
    state.activeMembersProject = null;
    state.assignableUsers = [];
    if (addMemberForm) addMemberForm.reset();
    if (membersList) membersList.innerHTML = "";
    if (availableUsersList) availableUsersList.innerHTML = "";
    setMembersStatus("", "info");
  };

  const fetchProjectMembers = async (projectId) => {
    const { data: rows, error } = await state.supabase
      .from(app.tables.members)
      .select("project_id,user_id,permission,joined_at")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true });
    if (error) throw error;

    const members = Array.isArray(rows) ? rows : [];
    if (members.length === 0) {
      return [];
    }

    const userIds = [...new Set(members.map((row) => String(row.user_id || "")).filter(Boolean))];
    const { data: profiles, error: profilesError } = await state.supabase
      .from(app.tables.users)
      .select("user_id,display_name,role,first_name,last_name_1,last_name_2,job_title,department")
      .in("user_id", userIds);
    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((profile) => [String(profile.user_id), profile]));
    return members.map((member) => {
      const userId = String(member.user_id || "");
      const profile = profileMap.get(userId) || null;
      return {
        user_id: userId,
        project_id: String(member.project_id || projectId),
        permission: normalizePermission(member.permission),
        joined_at: member.joined_at || null,
        display_name: personDisplayName(profile || { user_id: userId }),
        first_name: profile ? textValue(profile.first_name) : "",
        last_name_1: profile ? textValue(profile.last_name_1) : "",
        last_name_2: profile ? textValue(profile.last_name_2) : "",
        job_title: profile ? textValue(profile.job_title) : "",
        department: profile ? textValue(profile.department) : "",
        role: profile && profile.role ? roleLabel(profile.role) : "Sin rol",
      };
    });
  };

  const fetchAssignableUsers = async () => {
    const { data, error } = await state.supabase
      .from(app.tables.users)
      .select("user_id,display_name,role,first_name,last_name_1,last_name_2,job_title,department")
      .order("display_name", { ascending: true });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const renderAvailableUsers = (members) => {
    if (!availableUsersList) return;
    availableUsersList.innerHTML = "";

    if (!Array.isArray(state.assignableUsers) || state.assignableUsers.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "member-empty";
      emptyItem.textContent = "No hay usuarios disponibles.";
      availableUsersList.appendChild(emptyItem);
      return;
    }

    const currentMemberIds = new Set((members || []).map((member) => String(member.user_id)));

    state.assignableUsers.forEach((user) => {
      const userId = String(user.user_id || "");
      if (!userId) return;

      const item = document.createElement("li");
      item.className = "available-user-item";

      const name = document.createElement("div");
      name.className = "available-user-name";
      name.textContent = personDisplayName(user);

      const details = document.createElement("div");
      details.className = "available-user-role";
      const cargo = textValue(user.job_title) || "-";
      const dept = textValue(user.department) || "-";
      details.textContent = `Cargo: ${cargo} | Departamento: ${dept}`;

      const actions = document.createElement("div");
      actions.className = "available-user-actions";

      const role = document.createElement("span");
      role.className = "available-user-role";
      role.textContent = `Rol: ${roleLabel(user.role || "user")}`;

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn-mini";
      addBtn.textContent = currentMemberIds.has(userId) ? "Ya en proyecto" : "Anadir";
      addBtn.disabled = currentMemberIds.has(userId);
      addBtn.addEventListener("click", async () => {
        const permission = String(memberPermissionSelect ? memberPermissionSelect.value : "editor");
        try {
          await addMemberToProject(userId, permission);
        } catch (error) {
          console.error(error);
          setMembersStatus("No se pudo anadir la persona seleccionada.", "error");
        }
      });

      actions.appendChild(role);
      actions.appendChild(addBtn);
      item.appendChild(name);
      item.appendChild(details);
      item.appendChild(actions);
      availableUsersList.appendChild(item);
    });
  };

  const renderMemberUserSelect = (members) => {
    if (!memberUserSelect) return;
    memberUserSelect.innerHTML = "";

    const currentMemberIds = new Set((members || []).map((member) => String(member.user_id)));
    const availableUsers = (state.assignableUsers || []).filter((user) => {
      const userId = String(user && user.user_id || "");
      return userId && !currentMemberIds.has(userId);
    });

    if (availableUsers.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No hay personas disponibles para anadir.";
      option.disabled = true;
      option.selected = true;
      memberUserSelect.appendChild(option);
      memberUserSelect.disabled = true;
      return;
    }

    availableUsers.forEach((user) => {
      const option = document.createElement("option");
      const userId = String(user.user_id || "");
      option.value = userId;
      const fullName = personDisplayName(user);
      const dept = textValue(user.department);
      option.textContent = dept ? `${fullName} | ${dept}` : fullName;
      memberUserSelect.appendChild(option);
    });
    memberUserSelect.disabled = false;
  };

  const createPermissionSelect = (selectedValue) => {
    const select = document.createElement("select");
    MEMBER_PERMISSIONS.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = permissionLabel(value);
      if (value === normalizePermission(selectedValue)) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    return select;
  };

  const createMoveTargetSelect = (currentProjectId) => {
    const select = document.createElement("select");
    const destinations = state.projects.filter((project) => String(project.id) !== String(currentProjectId));
    if (destinations.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Sin destino";
      select.appendChild(option);
      select.disabled = true;
      return select;
    }

    destinations.forEach((project) => {
      const option = document.createElement("option");
      option.value = String(project.id);
      option.textContent = project.name || `Proyecto ${String(project.id).slice(0, 8)}`;
      select.appendChild(option);
    });
    return select;
  };

  const renderMembersList = (members) => {
    if (!membersList) return;
    membersList.innerHTML = "";

    if (!Array.isArray(members) || members.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "member-empty";
      emptyItem.textContent = "Este proyecto no tiene personas asignadas.";
      membersList.appendChild(emptyItem);
      return;
    }

    members.forEach((member) => {
      const item = document.createElement("li");
      item.className = "member-item";

      const head = document.createElement("div");
      head.className = "member-head";

      const name = document.createElement("span");
      name.className = "member-name";
      name.textContent = `${member.display_name} (${member.role})`;

      head.appendChild(name);

      const memberDetails = document.createElement("div");
      memberDetails.className = "available-user-role";
      const cargo = textValue(member.job_title) || "-";
      const dept = textValue(member.department) || "-";
      memberDetails.textContent = `Cargo: ${cargo} | Departamento: ${dept}`;

      const controls = document.createElement("div");
      controls.className = "member-controls";

      const permissionSelect = createPermissionSelect(member.permission);
      const savePermissionBtn = document.createElement("button");
      savePermissionBtn.type = "button";
      savePermissionBtn.className = "btn-mini";
      savePermissionBtn.textContent = "Guardar permiso";

      const moveSelect = createMoveTargetSelect(member.project_id);
      const moveBtn = document.createElement("button");
      moveBtn.type = "button";
      moveBtn.className = "btn-mini";
      moveBtn.textContent = "Mover";
      moveBtn.disabled = moveSelect.disabled;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-mini btn-danger";
      removeBtn.textContent = "Eliminar";

      savePermissionBtn.addEventListener("click", async () => {
        try {
          await updateMemberPermission(member.user_id, permissionSelect.value);
        } catch (error) {
          console.error(error);
          setMembersStatus("No se pudo actualizar el permiso.", "error");
        }
      });

      moveBtn.addEventListener("click", async () => {
        const targetProjectId = String(moveSelect.value || "");
        if (!targetProjectId) return;
        try {
          await moveMemberToProject(member.user_id, targetProjectId, permissionSelect.value);
        } catch (error) {
          console.error(error);
          setMembersStatus("No se pudo mover la persona.", "error");
        }
      });

      removeBtn.addEventListener("click", async () => {
        const shouldDelete = window.confirm(`Se eliminara a ${member.display_name} del proyecto actual. Continuar?`);
        if (!shouldDelete) return;
        try {
          await removeMemberFromProject(member.user_id);
        } catch (error) {
          console.error(error);
          setMembersStatus("No se pudo eliminar la persona.", "error");
        }
      });

      controls.appendChild(permissionSelect);
      controls.appendChild(savePermissionBtn);
      controls.appendChild(moveSelect);
      controls.appendChild(moveBtn);
      controls.appendChild(removeBtn);

      item.appendChild(head);
      item.appendChild(memberDetails);
      item.appendChild(controls);
      membersList.appendChild(item);
    });
  };

  const loadActiveProjectMembers = async () => {
    if (!state.activeMembersProject) return;
    setMembersStatus("Cargando personas del proyecto...", "info");
    const [members, users] = await Promise.all([
      fetchProjectMembers(state.activeMembersProject.id),
      fetchAssignableUsers(),
    ]);
    state.assignableUsers = users;
    renderMembersList(members);
    renderAvailableUsers(members);
    renderMemberUserSelect(members);
    setMembersStatus(`Personas cargadas: ${members.length}.`, "success");
  };

  const openManageMembersModal = async (project) => {
    if (!canManageMembers()) {
      setMembersStatus("Solo un usuario jefe puede gestionar personas.", "warning");
      return;
    }
    if (!manageMembersModal || !project) return;
    state.activeMembersProject = project;

    if (manageMembersTitle) {
      manageMembersTitle.textContent = "Gestionar personas";
    }
    if (membersProjectName) {
      membersProjectName.textContent = `Proyecto: ${project.name}`;
    }

    manageMembersModal.classList.remove("hidden");
    manageMembersModal.setAttribute("aria-hidden", "false");
    if (memberUserSelect) memberUserSelect.focus();

    try {
      await loadActiveProjectMembers();
    } catch (error) {
      console.error(error);
      setMembersStatus("No se pudo cargar la lista de personas.", "error");
    }
  };

  const updateMemberPermission = async (userId, permission) => {
    if (!canManageMembers()) return;
    if (!state.activeMembersProject) return;
    const safePermission = normalizePermission(permission);
    setMembersStatus("Actualizando permiso...", "info");
    const { error } = await state.supabase
      .from(app.tables.members)
      .update({ permission: safePermission })
      .eq("project_id", state.activeMembersProject.id)
      .eq("user_id", userId);
    if (error) throw error;
    await loadActiveProjectMembers();
    setMembersStatus("Permiso actualizado.", "success");
  };

  const removeMemberFromProject = async (userId) => {
    if (!canManageMembers()) return;
    if (!state.activeMembersProject) return;
    setMembersStatus("Eliminando persona del proyecto...", "info");
    const { error } = await state.supabase
      .from(app.tables.members)
      .delete()
      .eq("project_id", state.activeMembersProject.id)
      .eq("user_id", userId);
    if (error) throw error;
    await loadActiveProjectMembers();
    setMembersStatus("Persona eliminada del proyecto.", "success");
  };

  const moveMemberToProject = async (userId, targetProjectId, permission) => {
    if (!canManageMembers()) return;
    if (!state.activeMembersProject) return;
    const safePermission = normalizePermission(permission);

    setMembersStatus("Moviendo persona de proyecto...", "info");
    const { error: insertError } = await state.supabase.from(app.tables.members).upsert(
      {
        project_id: targetProjectId,
        user_id: userId,
        permission: safePermission,
      },
      { onConflict: "project_id,user_id" }
    );
    if (insertError) throw insertError;

    const { error: deleteError } = await state.supabase
      .from(app.tables.members)
      .delete()
      .eq("project_id", state.activeMembersProject.id)
      .eq("user_id", userId);
    if (deleteError) throw deleteError;

    await loadActiveProjectMembers();
    await loadProjects();
    setMembersStatus("Persona movida al proyecto de destino.", "success");
  };

  const addMembersToProject = async (userIds, permission) => {
    if (!canManageMembers()) return;
    if (!state.activeMembersProject) return;
    const safePermission = normalizePermission(permission);
    const safeUserIds = [...new Set((Array.isArray(userIds) ? userIds : []).map((userId) => String(userId || "").trim()).filter(Boolean))];
    if (safeUserIds.length === 0) return;

    setMembersStatus("Anadiendo persona al proyecto...", "info");
    const rows = safeUserIds.map((userId) => ({
      project_id: state.activeMembersProject.id,
      user_id: userId,
      permission: safePermission,
    }));
    const { error } = await state.supabase.from(app.tables.members).upsert(rows, { onConflict: "project_id,user_id" });
    if (error) throw error;

    if (addMemberForm) addMemberForm.reset();
    await loadActiveProjectMembers();
    await loadProjects();
    setMembersStatus(
      safeUserIds.length > 1 ? `Personas anadidas: ${safeUserIds.length}.` : "Persona anadida al proyecto.",
      "success"
    );
  };

  const addMemberToProject = async (userId, permission) => {
    const safeUserId = String(userId || "").trim();
    if (!safeUserId) return;
    await addMembersToProject([safeUserId], permission);
  };

  const resetPeopleForm = () => {
    if (!peopleForm) return;
    peopleForm.reset();
    if (personUserIdInput) {
      personUserIdInput.readOnly = false;
      personUserIdInput.focus();
    }
  };

  const resetAuthCreateForm = () => {
    if (!createAuthUserForm) return;
    createAuthUserForm.reset();
    if (authRoleSelect) authRoleSelect.value = "user";
    if (authEmailInput) authEmailInput.focus();
  };

  const fetchPeopleRows = async () => {
    const { data, error } = await state.supabase
      .from(app.tables.users)
      .select("user_id,display_name,role,first_name,last_name_1,last_name_2,job_title,department,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const fillPeopleForm = (person) => {
    if (!person) return;
    if (personUserIdInput) {
      personUserIdInput.value = String(person.user_id || "");
      personUserIdInput.readOnly = true;
    }
    if (personNameInput) personNameInput.value = textValue(person.first_name);
    if (personLast1Input) personLast1Input.value = textValue(person.last_name_1);
    if (personLast2Input) personLast2Input.value = textValue(person.last_name_2);
    if (personJobInput) personJobInput.value = textValue(person.job_title);
    if (personDeptInput) personDeptInput.value = textValue(person.department);
  };

  const renderPeopleDirectoryTable = () => {
    if (!peopleTableBody) return;
    peopleTableBody.innerHTML = "";

    if (!Array.isArray(state.peopleRows) || state.peopleRows.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "member-empty";
      cell.textContent = "No hay fichas de personas disponibles.";
      row.appendChild(cell);
      peopleTableBody.appendChild(row);
      return;
    }

    state.peopleRows.forEach((person, index) => {
      const row = document.createElement("tr");
      const first = textValue(person.first_name);
      const last1 = textValue(person.last_name_1);
      const last2 = textValue(person.last_name_2);
      const job = textValue(person.job_title);
      const dept = textValue(person.department);

      const cells = [
        String(index + 1),
        first || "-",
        last1 || "-",
        last2 || "-",
        job || "-",
        dept || "-",
      ];

      cells.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      const actionsCell = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-mini";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => {
        fillPeopleForm(person);
        setPeopleStatus(`Editando ficha de ${personDisplayName(person)}.`, "info");
      });
      actionsCell.appendChild(editBtn);
      row.appendChild(actionsCell);

      peopleTableBody.appendChild(row);
    });
  };

  const loadPeopleDirectory = async () => {
    if (!canManageMembers()) return;
    setPeopleStatus("Cargando fichas de personas...", "info");
    state.peopleRows = await fetchPeopleRows();
    renderPeopleDirectoryTable();
    setPeopleStatus(`Fichas cargadas: ${state.peopleRows.length}.`, "success");
  };

  const openPeopleDirectoryModal = async () => {
    if (!canManageMembers()) {
      setPeopleStatus("Solo un usuario jefe puede abrir el directorio.", "warning");
      return;
    }
    if (!peopleDirectoryModal) return;
    peopleDirectoryModal.classList.remove("hidden");
    peopleDirectoryModal.setAttribute("aria-hidden", "false");
    setAuthCreateStatus("", "info");
    resetAuthCreateForm();
    resetPeopleForm();
    await loadPeopleDirectory();
  };

  const closePeopleDirectoryModal = () => {
    if (!peopleDirectoryModal) return;
    peopleDirectoryModal.classList.add("hidden");
    peopleDirectoryModal.setAttribute("aria-hidden", "true");
    state.peopleRows = [];
    if (peopleTableBody) peopleTableBody.innerHTML = "";
    setPeopleStatus("", "info");
    setAuthCreateStatus("", "info");
    resetAuthCreateForm();
    resetPeopleForm();
  };

  const savePeopleRecord = async (input) => {
    const userId = textValue(input.user_id);
    if (!isUuid(userId)) {
      throw new Error("UUID_INVALID");
    }

    const firstName = textValue(input.first_name);
    const lastName1 = textValue(input.last_name_1);
    const lastName2 = textValue(input.last_name_2);
    const jobTitle = textValue(input.job_title);
    const department = textValue(input.department);

    const existing = state.peopleRows.find((row) => String(row.user_id) === userId);
    const composedDisplayName = [firstName, lastName1, lastName2].filter(Boolean).join(" ");
    const displayName = composedDisplayName || textValue(existing ? existing.display_name : "") || `Usuario ${userId.slice(0, 8)}`;
    const role = textValue(existing ? existing.role : "") || "user";

    const { error } = await state.supabase.from(app.tables.users).upsert(
      {
        user_id: userId,
        display_name: displayName,
        role,
        first_name: firstName,
        last_name_1: lastName1,
        last_name_2: lastName2,
        job_title: jobTitle,
        department,
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
  };

  const createAuthUserFromPanel = async (input) => {
    if (!state.supabase) throw new Error("SUPABASE_NOT_READY");

    const email = textValue(input.email).toLowerCase();
    const password = String(input.password || "");
    const displayName = textValue(input.display_name);
    const role = normalizeAppRole(input.role);
    const firstName = textValue(input.first_name);
    const lastName1 = textValue(input.last_name_1);
    const lastName2 = textValue(input.last_name_2);
    const jobTitle = textValue(input.job_title);
    const department = textValue(input.department);

    if (!email || !email.includes("@")) {
      throw new Error("EMAIL_INVALID");
    }
    if (password.length < 8) {
      throw new Error("PASSWORD_INVALID");
    }

    const { data: sessionData, error: sessionError } = await state.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData && sessionData.session ? sessionData.session.access_token : "";
    if (!accessToken) {
      throw new Error("AUTH_REQUIRED");
    }

    const response = await fetch("/api/admin/create-auth-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email,
        password,
        role,
        display_name: displayName,
        first_name: firstName,
        last_name_1: lastName1,
        last_name_2: lastName2,
        job_title: jobTitle,
        department,
      }),
    });

    let responseBody = {};
    try {
      responseBody = await response.json();
    } catch (_) {
      responseBody = {};
    }

    if (!response.ok) {
      const message = textValue(responseBody && responseBody.error) || "No se pudo crear el usuario auth.";
      throw new Error(message);
    }

    return responseBody;
  };

  const startRealtime = () => {
    if (!state.supabase) return;
    if (state.realtimeChannels.length > 0) return;

    const watch = (name, table) =>
      state.supabase
        .channel(name)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          scheduleProjectReload();
          if (
            state.activeMembersProject &&
            (table === app.tables.members || table === app.tables.users)
          ) {
            loadActiveProjectMembers().catch((error) => console.error(error));
          }
          if (table === app.tables.users && peopleDirectoryModal && !peopleDirectoryModal.classList.contains("hidden")) {
            loadPeopleDirectory().catch((error) => console.error(error));
          }
        })
        .subscribe();

    state.realtimeChannels = [
      watch("kanban-main-projects-sync", app.tables.projects),
      watch("kanban-main-members-sync", app.tables.members),
      watch("kanban-main-tasks-sync", app.tables.tasks),
      watch("kanban-main-users-sync", app.tables.users),
    ];
  };

  const saveProject = async (name, description, projectType, selectedDepartments = [], selectedPeople = []) => {
    const normalizedType = normalizeProjectType(projectType);
    const cleanDescription = String(description || "").trim();
    const encodedDescription = cleanDescription
      ? `[TYPE:${normalizedType}] ${cleanDescription}`
      : `[TYPE:${normalizedType}]`;
    const payload = {
      name: String(name || "").trim(),
      description: encodedDescription,
    };
    if (!payload.name) return;

    const editingProjectId = textValue(state.editingProjectId);
    setSyncStatus(editingProjectId ? "Actualizando proyecto..." : "Creando proyecto...", "info");

    let error = null;
    let savedProjectId = editingProjectId;
    const safeDepartments = Array.isArray(selectedDepartments) ? selectedDepartments : [];
    const safePeople = Array.isArray(selectedPeople) ? selectedPeople : [];
    if (editingProjectId) {
      const response = await state.supabase
        .from(app.tables.projects)
        .update(payload)
        .eq("id", editingProjectId);
      error = response.error;
    } else {
      const response = await state.supabase
        .from(app.tables.projects)
        .insert(payload)
        .select("id")
        .single();
      error = response.error;
      savedProjectId = textValue(response.data && response.data.id);
    }

    if (error) throw error;

    let membersAdded = 0;
    let membersWarning = false;
    if (!editingProjectId && (safeDepartments.length > 0 || safePeople.length > 0) && savedProjectId) {
      try {
        membersAdded = await addSelectedMembersToProject(savedProjectId, safeDepartments, safePeople);
      } catch (membersError) {
        console.error(membersError);
        membersWarning = true;
      }
    }

    if (editingProjectId) {
      setSyncStatus("Proyecto actualizado.", "success");
    } else if ((safeDepartments.length > 0 || safePeople.length > 0) && membersWarning) {
      setSyncStatus("Proyecto creado. No se pudieron anadir algunos miembros.", "warning");
    } else if (safeDepartments.length > 0 || safePeople.length > 0) {
      setSyncStatus(`Proyecto creado. Miembros anadidos: ${membersAdded}.`, "success");
    } else {
      setSyncStatus("Proyecto creado.", "success");
    }

    closeCreateProjectModal();
    await loadProjects();
  };

  const deleteProject = async (project) => {
    if (!canManageMembers()) {
      setSyncStatus("Solo un usuario jefe puede eliminar proyectos.", "warning");
      return;
    }
    const projectId = textValue(project && project.id);
    if (!projectId) return;

    if (state.activeMembersProject && String(state.activeMembersProject.id) === projectId) {
      closeManageMembersModal();
    }

    setSyncStatus("Eliminando proyecto...", "info");
    const { error } = await state.supabase.from(app.tables.projects).delete().eq("id", projectId);
    if (error) throw error;
    setSyncStatus("Proyecto eliminado.", "success");
    await loadProjects();
  };

  const signOut = async () => {
    if (!state.supabase) return;
    setSyncStatus("Cerrando sesion...", "info");
    const { error } = await state.supabase.auth.signOut();
    if (error) throw error;
    app.setStoredMode("user");
    window.location.href = app.buildLoginUrl("index.html");
  };

  const init = async () => {
    if (!app || !app.hasSupabaseConfig()) {
      setSyncStatus("Configura .env para activar MAIN.", "warning");
      return;
    }

    state.supabase = app.createSupabaseClient();
    if (!state.supabase) {
      setSyncStatus("No se pudo crear el cliente Supabase.", "error");
      return;
    }

    try {
      await app.ensureAuthSession(state.supabase);
      state.user = await app.getCurrentUser(state.supabase);
      state.profile = await app.ensureProfile(state.supabase, state.user.id);
      state.mode = app.resolveMode(state.profile.role);
      updateSessionStrip();
      updateJefeControls();
      renderDashboard([]);
      await loadProjects();
      startRealtime();
    } catch (error) {
      if (app.isAuthRequiredError(error)) {
        app.redirectToLogin();
        return;
      }
      console.error(error);
      setSyncStatus("Error de inicio: revisa la sesion y la configuracion de Supabase.", "error");
    }
  };

  if (openCreateProjectBtn) {
    openCreateProjectBtn.addEventListener("click", async () => {
      try {
        await openCreateProjectModal();
      } catch (error) {
        console.error(error);
        setSyncStatus("No se pudo abrir el modal de proyecto.", "error");
      }
    });
  }

  if (openPeopleDirectoryBtn) {
    openPeopleDirectoryBtn.addEventListener("click", async () => {
      try {
        await openPeopleDirectoryModal();
      } catch (error) {
        console.error(error);
        setPeopleStatus("No se pudo abrir el directorio.", "error");
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        await signOut();
      } catch (error) {
        console.error(error);
        setSyncStatus("No se pudo cerrar sesion.", "error");
      }
    });
  }

  if (projectSearchInput) {
    projectSearchInput.addEventListener("input", () => {
      state.projectSearchQuery = String(projectSearchInput.value || "");
      rerenderProjects();
    });
  }

  if (projectTagButtons.length > 0) {
    projectTagButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const topic = normalizeProjectTopic(button.dataset.topic);
        if (topic === state.projectTopic) return;
        state.projectTopic = topic;
        updateProjectTopicButtons();
        rerenderProjects();
      });
    });
  }

  if (cancelCreateProjectBtn) {
    cancelCreateProjectBtn.addEventListener("click", closeCreateProjectModal);
  }

  if (createProjectModal) {
    createProjectModal.addEventListener("click", (event) => {
      if (event.target === createProjectModal) {
        closeCreateProjectModal();
      }
    });
  }

  if (createProjectForm) {
    createProjectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const selectedDepartments = textValue(state.editingProjectId) ? [] : getSelectedProjectDepartments();
        const selectedPeople = textValue(state.editingProjectId) ? [] : getSelectedProjectPeople();
        await saveProject(
          projectNameInput ? projectNameInput.value : "",
          projectDescriptionInput ? projectDescriptionInput.value : "",
          projectTypeSelect ? projectTypeSelect.value : "web",
          selectedDepartments,
          selectedPeople
        );
      } catch (error) {
        console.error(error);
        setSyncStatus(state.editingProjectId ? "No se pudo actualizar el proyecto." : "No se pudo crear el proyecto.", "error");
      }
    });
  }

  if (closeMembersModalBtn) {
    closeMembersModalBtn.addEventListener("click", closeManageMembersModal);
  }

  if (manageMembersModal) {
    manageMembersModal.addEventListener("click", (event) => {
      if (event.target === manageMembersModal) {
        closeManageMembersModal();
      }
    });
  }

  if (closePeopleDirectoryBtn) {
    closePeopleDirectoryBtn.addEventListener("click", closePeopleDirectoryModal);
  }

  if (peopleDirectoryModal) {
    peopleDirectoryModal.addEventListener("click", (event) => {
      if (event.target === peopleDirectoryModal) {
        closePeopleDirectoryModal();
      }
    });
  }

  if (peopleFormResetBtn) {
    peopleFormResetBtn.addEventListener("click", () => {
      setPeopleStatus("Formulario limpio.", "info");
      resetPeopleForm();
    });
  }

  if (authCreateFormResetBtn) {
    authCreateFormResetBtn.addEventListener("click", () => {
      setAuthCreateStatus("Formulario de acceso limpio.", "info");
      resetAuthCreateForm();
    });
  }

  if (createAuthUserForm) {
    createAuthUserForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canManageMembers()) {
        setAuthCreateStatus("Solo un usuario jefe puede crear accesos.", "warning");
        return;
      }

      const payload = {
        email: String(authEmailInput ? authEmailInput.value : ""),
        password: String(authPasswordInput ? authPasswordInput.value : ""),
        role: String(authRoleSelect ? authRoleSelect.value : "user"),
        display_name: String(authDisplayNameInput ? authDisplayNameInput.value : ""),
        first_name: String(authFirstNameInput ? authFirstNameInput.value : ""),
        last_name_1: String(authLast1Input ? authLast1Input.value : ""),
        last_name_2: String(authLast2Input ? authLast2Input.value : ""),
        job_title: String(authJobTitleInput ? authJobTitleInput.value : ""),
        department: String(authDepartmentInput ? authDepartmentInput.value : ""),
      };

      try {
        setAuthCreateStatus("Creando usuario auth y enlazando ficha...", "info");
        const result = await createAuthUserFromPanel(payload);
        await loadPeopleDirectory();
        if (state.activeMembersProject) {
          await loadActiveProjectMembers();
        }

        if (result && result.user_id && personUserIdInput) {
          personUserIdInput.value = String(result.user_id);
          personUserIdInput.readOnly = true;
        }
        if (personNameInput) personNameInput.value = textValue(payload.first_name);
        if (personLast1Input) personLast1Input.value = textValue(payload.last_name_1);
        if (personLast2Input) personLast2Input.value = textValue(payload.last_name_2);
        if (personJobInput) personJobInput.value = textValue(payload.job_title);
        if (personDeptInput) personDeptInput.value = textValue(payload.department);
        if (authPasswordInput) authPasswordInput.value = "";

        const userId = textValue(result && result.user_id);
        const email = textValue(result && result.email);
        setAuthCreateStatus(`Usuario creado: ${email || "email"} (${userId.slice(0, 8)}).`, "success");
      } catch (error) {
        console.error(error);
        const message = textValue(error && error.message ? error.message : "");
        const lower = message.toLowerCase();
        if (message === "EMAIL_INVALID") {
          setAuthCreateStatus("El email no es valido.", "error");
        } else if (message === "PASSWORD_INVALID") {
          setAuthCreateStatus("La contrasena debe tener al menos 8 caracteres.", "error");
        } else if (message === "AUTH_REQUIRED") {
          setAuthCreateStatus("Tu sesion expiro. Inicia sesion de nuevo.", "error");
        } else if (lower.includes("already") || lower.includes("registered")) {
          setAuthCreateStatus("Ese email ya esta registrado en Authentication.", "warning");
        } else if (lower.includes("solo un usuario jefe")) {
          setAuthCreateStatus("Tu usuario no es jefe en kanban_users.", "error");
        } else if (lower.includes("falta configurar") || lower.includes("supabase_service_role_key")) {
          setAuthCreateStatus("Faltan variables en Railway: SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.", "error");
        } else if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
          setAuthCreateStatus("No se pudo conectar con el backend de Railway.", "error");
        } else if (message) {
          setAuthCreateStatus(message, "error");
        } else {
          setAuthCreateStatus("No se pudo crear el usuario auth.", "error");
        }
      }
    });
  }

  if (peopleForm) {
    peopleForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        user_id: String(personUserIdInput ? personUserIdInput.value : ""),
        first_name: String(personNameInput ? personNameInput.value : ""),
        last_name_1: String(personLast1Input ? personLast1Input.value : ""),
        last_name_2: String(personLast2Input ? personLast2Input.value : ""),
        job_title: String(personJobInput ? personJobInput.value : ""),
        department: String(personDeptInput ? personDeptInput.value : ""),
      };

      try {
        setPeopleStatus("Guardando ficha de persona...", "info");
        await savePeopleRecord(payload);
        await loadPeopleDirectory();
        if (state.activeMembersProject) {
          await loadActiveProjectMembers();
        }
        resetPeopleForm();
        setPeopleStatus("Ficha guardada correctamente.", "success");
      } catch (error) {
        console.error(error);
        if (String(error && error.message) === "UUID_INVALID") {
          setPeopleStatus("El User ID debe ser un UUID valido.", "error");
        } else {
          setPeopleStatus("No se pudo guardar la ficha. Verifica que el User ID exista en auth.users.", "error");
        }
      }
    });
  }

  if (addMemberForm) {
    addMemberForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const selectedUserIds = memberUserSelect
        ? [...memberUserSelect.selectedOptions].map((option) => String(option.value || "").trim()).filter(Boolean)
        : [];
      const permission = String(memberPermissionSelect ? memberPermissionSelect.value : "editor");

      if (selectedUserIds.length === 0) {
        setMembersStatus("Selecciona al menos una persona para anadir.", "warning");
        if (memberUserSelect) memberUserSelect.focus();
        return;
      }
      try {
        await addMembersToProject(selectedUserIds, permission);
      } catch (error) {
        console.error(error);
        setMembersStatus("No se pudieron anadir las personas seleccionadas.", "error");
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (peopleDirectoryModal && !peopleDirectoryModal.classList.contains("hidden")) {
      closePeopleDirectoryModal();
      return;
    }
    if (manageMembersModal && !manageMembersModal.classList.contains("hidden")) {
      closeManageMembersModal();
      return;
    }
    if (createProjectModal && !createProjectModal.classList.contains("hidden")) {
      closeCreateProjectModal();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
    if (!state.supabase) return;
    state.realtimeChannels.forEach((channel) => {
      state.supabase.removeChannel(channel);
    });
    state.realtimeChannels = [];
  });

  state.projectTopic = normalizeProjectTopic(state.projectTopic);
  if (projectSearchInput) {
    state.projectSearchQuery = String(projectSearchInput.value || "");
  }
  updateProjectTopicButtons();

  init();
})();
