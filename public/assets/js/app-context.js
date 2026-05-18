(() => {
  const config = window.SUPABASE_CONFIG || {};

  const TABLES = Object.freeze({
    tasks: config.table || "kanban_tasks",
    links: config.linksTable || "kanban_task_links",
    comments: config.commentsTable || "kanban_task_comments",
    attachments: config.attachmentsTable || "kanban_task_attachments",
    notes: config.notesTable || "kanban_quick_notes",
    delayTasks: config.delayTasksTable || "n8n_delay_tasks",
    projects: config.projectsTable || "kanban_projects",
    members: config.projectMembersTable || "kanban_project_members",
    users: config.usersTable || "kanban_users",
  });
  const ATTACHMENTS_BUCKET = config.attachmentsBucket || "kanban-attachments";

  const MODE_STORAGE_KEY = "kanban_app_mode";
  const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED";
  const DEFAULT_RETURN_PATH = "index.html";
  const SUPABASE_URL = config.url || "";
  const SUPABASE_ANON_KEY = config.anonKey || "";
  const AUTO_ANON_AUTH = config.autoAnonymousAuth === true;
  const TASK_STATUS_PROGRESS_MAP = Object.freeze({
    open: 0,
    "on-hold": 10,
    "pending-approval": 80,
    done: 100,
  });

  const hasSupabaseConfig = () =>
    !!window.supabase &&
    !!SUPABASE_URL &&
    !!SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_PROJECT") &&
    !SUPABASE_ANON_KEY.includes("YOUR_PUBLIC");

  const createSupabaseClient = () => {
    if (!hasSupabaseConfig()) return null;
    try {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const createAuthRequiredError = () => {
    const error = new Error(AUTH_REQUIRED_ERROR);
    error.code = AUTH_REQUIRED_ERROR;
    return error;
  };

  const isAuthRequiredError = (error) => {
    if (!error) return false;
    if (error.code === AUTH_REQUIRED_ERROR) return true;
    const message = String(error.message || error).toUpperCase();
    return message.includes(AUTH_REQUIRED_ERROR);
  };

  const sanitizeReturnPath = (value, fallback = DEFAULT_RETURN_PATH) => {
    const candidate = String(value || "").trim();
    if (!candidate) return fallback;
    if (candidate.startsWith("//")) return fallback;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) return fallback;
    if (candidate.startsWith("/")) return fallback;
    if (candidate.includes("..")) return fallback;
    if (candidate.includes("\\")) return fallback;
    return candidate.replace(/^\.\/+/, "");
  };

  const getCurrentReturnPath = () => {
    const pathname = window.location.pathname || "";
    const segments = pathname.split("/").filter(Boolean);
    const fileName = segments.length > 0 ? segments[segments.length - 1] : DEFAULT_RETURN_PATH;
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    return sanitizeReturnPath(`${fileName}${search}${hash}`);
  };

  const getRequestedReturnPath = () =>
    sanitizeReturnPath(new URLSearchParams(window.location.search).get("returnTo"), DEFAULT_RETURN_PATH);

  const buildLoginUrl = (returnTo = getCurrentReturnPath()) => {
    const safeReturnTo = sanitizeReturnPath(returnTo, DEFAULT_RETURN_PATH);
    const params = new URLSearchParams();
    if (safeReturnTo && safeReturnTo !== DEFAULT_RETURN_PATH) {
      params.set("returnTo", safeReturnTo);
    }
    const query = params.toString();
    return query ? `login.html?${query}` : "login.html";
  };

  const spaNavigate = (url) => {
    if (window.KanbanRouter && typeof window.KanbanRouter.navigate === 'function') {
      window.KanbanRouter.navigate(url);
    } else {
      window.location.href = url;
    }
  };

  const redirectToLogin = (returnTo) => {
    spaNavigate(buildLoginUrl(returnTo || getCurrentReturnPath()));
  };

  const redirectAfterLogin = (fallbackPath = DEFAULT_RETURN_PATH) => {
    const target = getRequestedReturnPath() || sanitizeReturnPath(fallbackPath, DEFAULT_RETURN_PATH);
    spaNavigate(target);
  };

  const isValidSession = (session) => {
    if (!session || !session.user || !session.user.id) return false;
    if (!AUTO_ANON_AUTH && session.user.is_anonymous === true) {
      return false;
    }
    return true;
  };

  const ensureAuthSession = async (supabaseClient) => {
    if (!supabaseClient) return null;
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData && isValidSession(sessionData.session)) return sessionData.session;

    if (sessionData && sessionData.session && sessionData.session.user && sessionData.session.user.is_anonymous) {
      const { error: signOutError } = await supabaseClient.auth.signOut();
      if (signOutError) {
        console.warn(signOutError);
      }
    }

    if (!AUTO_ANON_AUTH) {
      throw createAuthRequiredError();
    }

    const { data: signInData, error: signInError } = await supabaseClient.auth.signInAnonymously();
    if (signInError) throw signInError;
    const session = signInData ? signInData.session || null : null;
    if (!isValidSession(session)) {
      throw createAuthRequiredError();
    }
    return session;
  };

  const getCurrentUser = async (supabaseClient) => {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    if (!data || !data.user || !data.user.id) {
      throw new Error("No se pudo obtener el usuario autenticado.");
    }
    if (!AUTO_ANON_AUTH && data.user.is_anonymous === true) {
      throw createAuthRequiredError();
    }
    return data.user;
  };

  const getStoredMode = () => {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    return raw === "jefe" ? "jefe" : "user";
  };

  const setStoredMode = (mode) => {
    const safe = mode === "jefe" ? "jefe" : "user";
    window.localStorage.setItem(MODE_STORAGE_KEY, safe);
    return safe;
  };

  const resolveMode = (profileRole) => {
    if (profileRole === "jefe") {
      return setStoredMode("jefe");
    }
    return setStoredMode("user");
  };

  const normalizeRole = (role) => (String(role || "").trim().toLowerCase() === "jefe" ? "jefe" : "user");
  const normalizeTaskStatus = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "on-hold" || normalized === "pending-approval" || normalized === "done") {
      return normalized;
    }
    return "open";
  };
  const taskStatusProgress = (status) => TASK_STATUS_PROGRESS_MAP[normalizeTaskStatus(status)] || 0;
  const roleToLabel = (role) => (normalizeRole(role) === "jefe" ? "Jefe" : "User (Trabajador)");
  const normalizeProjectPermission = (permission) => {
    const normalized = String(permission || "").trim().toLowerCase();
    if (normalized === "viewer" || normalized === "manager") return normalized;
    return "editor";
  };
  const projectPermissionToLabel = (permission) => {
    const normalized = normalizeProjectPermission(permission);
    if (normalized === "viewer") return "Solo lectura";
    if (normalized === "manager") return "Manager";
    return "Editor";
  };
  const canEditProjectData = ({ profileRole, mode, permission }) => {
    if (normalizeRole(profileRole) === "jefe" && mode === "jefe") return true;
    return normalizeProjectPermission(permission) !== "viewer";
  };

  const ensureProfile = async (supabaseClient, userId) => {
    const { data: profile, error: profileError } = await supabaseClient
      .from(TABLES.users)
      .select("user_id,display_name,role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile && profile.user_id) {
      return {
        user_id: profile.user_id,
        display_name: profile.display_name || `Usuario ${String(userId).slice(0, 8)}`,
        role: normalizeRole(profile.role),
      };
    }

    const fallbackName = `Usuario ${String(userId).slice(0, 8)}`;
    const { error: insertError } = await supabaseClient.from(TABLES.users).insert({
      user_id: userId,
      display_name: fallbackName,
      role: "user",
    });

    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }

    const { data: createdProfile, error: createdError } = await supabaseClient
      .from(TABLES.users)
      .select("user_id,display_name,role")
      .eq("user_id", userId)
      .single();

    if (createdError) throw createdError;
    return {
      user_id: createdProfile.user_id,
      display_name: createdProfile.display_name || fallbackName,
      role: normalizeRole(createdProfile.role),
    };
  };

  const getProjectIdFromUrl = () => new URLSearchParams(window.location.search).get("project");

  const buildProjectUrl = (path, projectId, extraParams = {}) => {
    const params = new URLSearchParams(extraParams);
    if (projectId) {
      params.set("project", projectId);
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  const getProjectLinks = (projectId) => ({
    main: "index.html",
    kanban: buildProjectUrl("kanban.html", projectId),
    calendar: buildProjectUrl("calendar.html", projectId),
    gantt: buildProjectUrl("gantt.html", projectId),
    notes: buildProjectUrl("notas.html", projectId),
  });

  const fetchMyMembershipProjectIds = async (supabaseClient, userId) => {
    const { data, error } = await supabaseClient
      .from(TABLES.members)
      .select("project_id")
      .eq("user_id", userId);
    if (error) throw error;
    return new Set((data || []).map((row) => String(row.project_id)));
  };

  const fetchProjectsForMode = async ({ supabaseClient, userId, profileRole, mode }) => {
    const { data, error } = await supabaseClient
      .from(TABLES.projects)
      .select("id,name,description,created_by,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const projects = Array.isArray(data) ? data : [];
    if (mode === "jefe" && profileRole === "jefe") {
      return projects;
    }

    const myMembershipIds = await fetchMyMembershipProjectIds(supabaseClient, userId);
    return projects.filter((project) => myMembershipIds.has(String(project.id)));
  };

  const ensureProjectAccess = async ({ supabaseClient, projectId, userId, profileRole, mode }) => {
    if (!projectId) {
      return { allowed: false, reason: "missing-project", project: null };
    }

    const { data: project, error: projectError } = await supabaseClient
      .from(TABLES.projects)
      .select("id,name,description,created_by,created_at")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) {
      return { allowed: false, reason: "project-not-found", project: null };
    }

    if (mode === "jefe" && profileRole === "jefe") {
      return { allowed: true, reason: "jefe-mode", project, permission: "manager" };
    }

    const { data: membershipRows, error: membershipError } = await supabaseClient
      .from(TABLES.members)
      .select("project_id,permission")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .limit(1);

    if (membershipError) throw membershipError;
    const isMember = Array.isArray(membershipRows) && membershipRows.length > 0;
    const permission = isMember ? normalizeProjectPermission(membershipRows[0].permission) : null;

    return {
      allowed: isMember,
      reason: isMember ? "member" : "no-membership",
      project,
      permission,
    };
  };

  const fetchProjectTaskStats = async (supabaseClient, projectIds) => {
    const result = new Map();
    if (!Array.isArray(projectIds) || projectIds.length === 0) return result;

    const { data, error } = await supabaseClient
      .from(TABLES.tasks)
      .select("project_id,status")
      .in("project_id", projectIds);

    if (error) throw error;

    (data || []).forEach((row) => {
      const projectId = String(row.project_id || "");
      if (!projectId) return;
      if (!result.has(projectId)) {
        result.set(projectId, { total: 0, done: 0, weighted_points: 0, progress_percent: 0 });
      }
      const bucket = result.get(projectId);
      bucket.total += 1;
      bucket.weighted_points += taskStatusProgress(row.status);
      if (row.status === "done") {
        bucket.done += 1;
      }
    });

    result.forEach((bucket) => {
      bucket.progress_percent = bucket.total > 0 ? Math.round(bucket.weighted_points / bucket.total) : 0;
    });

    return result;
  };

  window.KanbanApp = Object.freeze({
    tables: TABLES,
    attachmentsBucket: ATTACHMENTS_BUCKET,
    hasSupabaseConfig,
    createSupabaseClient,
    isAuthRequiredError,
    sanitizeReturnPath,
    getCurrentReturnPath,
    getRequestedReturnPath,
    buildLoginUrl,
    redirectToLogin,
    redirectAfterLogin,
    ensureAuthSession,
    getCurrentUser,
    normalizeTaskStatus,
    taskStatusProgress,
    roleToLabel,
    normalizeProjectPermission,
    projectPermissionToLabel,
    canEditProjectData,
    ensureProfile,
    getStoredMode,
    setStoredMode,
    resolveMode,
    getProjectIdFromUrl,
    buildProjectUrl,
    getProjectLinks,
    fetchProjectsForMode,
    fetchMyMembershipProjectIds,
    ensureProjectAccess,
    fetchProjectTaskStats,
  });
})();
