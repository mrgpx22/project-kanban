const http = require("http");
const path = require("path");
const fs = require("fs").promises;

const loadDotEnv = () => {
  const envPath = path.join(__dirname, ".env");
  try {
    const raw = require("fs").readFileSync(envPath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex <= 0) return;
      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] == null) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      console.warn("No se pudo leer .env:", error.message || error);
    }
  }
};

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "");
const USERS_TABLE = String(process.env.SUPABASE_USERS_TABLE || "kanban_users");
const N8N_AI_WEBHOOK_URL = String(process.env.N8N_AI_WEBHOOK_URL || "").trim();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const buildSafePath = (pathname) => {
  const decoded = decodeURIComponent(pathname);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, "");
  const target = normalized || "index.html";
  const absolutePath = path.join(PUBLIC_DIR, target);
  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    return null;
  }
  return absolutePath;
};

const send = (res, statusCode, body, contentType = "text/plain; charset=utf-8") => {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
};

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload || {});
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
};

const envValue = (key, fallback = "") => String(process.env[key] || fallback).trim();

const getPublicSupabaseConfig = () => ({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  table: envValue("SUPABASE_TASKS_TABLE", "kanban_tasks"),
  linksTable: envValue("SUPABASE_LINKS_TABLE", "kanban_task_links"),
  commentsTable: envValue("SUPABASE_COMMENTS_TABLE", "kanban_task_comments"),
  attachmentsTable: envValue("SUPABASE_ATTACHMENTS_TABLE", "kanban_task_attachments"),
  notesTable: envValue("SUPABASE_NOTES_TABLE", "kanban_quick_notes"),
  delayTasksTable: envValue("SUPABASE_DELAY_TASKS_TABLE", "n8n_delay_tasks"),
  projectsTable: envValue("SUPABASE_PROJECTS_TABLE", "kanban_projects"),
  projectMembersTable: envValue("SUPABASE_PROJECT_MEMBERS_TABLE", "kanban_project_members"),
  usersTable: USERS_TABLE,
  attachmentsBucket: envValue("SUPABASE_ATTACHMENTS_BUCKET", "kanban-attachments"),
  autoAnonymousAuth: envValue("SUPABASE_AUTO_ANONYMOUS_AUTH", "false").toLowerCase() === "true",
});

const sendSupabaseConfig = (res) => {
  const configJson = JSON.stringify(getPublicSupabaseConfig(), null, 2);
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`window.SUPABASE_CONFIG = Object.freeze(${configJson});\n`);
};

const headerValue = (value) => {
  const text = String(value == null ? "" : value).trim();
  return text;
};

const proxyAiWebhook = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!N8N_AI_WEBHOOK_URL) {
    sendJson(res, 503, { error: "Falta configurar N8N_AI_WEBHOOK_URL." });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const sessionId = headerValue(payload.sessionId || payload.memorySessionId);
    const userId = headerValue(payload.userId || payload.user_id);
    const projectId = headerValue(payload.projectId || payload.project_id);
    const page = headerValue(payload.page);
    const upstream = await fetch(N8N_AI_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/html, text/plain;q=0.9, */*;q=0.8",
        ...(sessionId ? { "X-Kanban-Session-Id": sessionId } : {}),
        ...(userId ? { "X-Kanban-User-Id": userId } : {}),
        ...(projectId ? { "X-Kanban-Project-Id": projectId } : {}),
        ...(page ? { "X-Kanban-Page": page } : {}),
      },
      body: JSON.stringify(payload || {}),
    });

    const responseText = await upstream.text();
    const contentType = String(upstream.headers.get("content-type") || "application/json; charset=utf-8");

    res.writeHead(upstream.status, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    res.end(responseText);
  } catch (error) {
    console.error(error);
    sendJson(res, 502, { error: "No se pudo contactar con n8n." });
  }
};

const tryReadFile = async (absolutePath) => {
  try {
    const data = await fs.readFile(absolutePath);
    return { found: true, data };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { found: false, data: null };
    }
    throw error;
  }
};

const readJsonBody = async (req, maxBytes = 256 * 1024) =>
  new Promise((resolve, reject) => {
    let size = 0;
    let chunks = "";
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("BODY_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (!chunks) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(chunks));
      } catch (_) {
        reject(new Error("BODY_INVALID_JSON"));
      }
    });
    req.on("error", (error) => reject(error));
  });

const getBearerToken = (req) => {
  const raw = String(req.headers.authorization || "");
  if (!raw.startsWith("Bearer ")) return "";
  return raw.slice("Bearer ".length).trim();
};

const normalizeRole = (value) => (String(value || "").trim().toLowerCase() === "jefe" ? "jefe" : "user");

const resolveDisplayName = (payload, userId, email) => {
  const displayName = String(payload.display_name || "").trim();
  if (displayName) return displayName;
  const parts = [payload.first_name, payload.last_name_1, payload.last_name_2]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (email.includes("@")) return email.split("@")[0];
  return `Usuario ${String(userId || "").slice(0, 8)}`;
};

const extractErrorMessage = (payload, fallback) => {
  if (!payload || typeof payload !== "object") return fallback;
  const candidates = [
    payload.error_description,
    payload.msg,
    payload.error,
    payload.message,
  ];
  const found = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return found || fallback;
};

const hasSupabaseAdminConfig = () =>
  SUPABASE_URL.length > 0 && SUPABASE_SERVICE_ROLE_KEY.length > 0 && SUPABASE_ANON_KEY.length > 0;

const verifyRequesterRole = async (accessToken) => {
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!authRes.ok) {
    throw new Error("AUTH_REQUIRED");
  }
  const authUser = await authRes.json();
  const requesterId = String(authUser && authUser.id ? authUser.id : "");
  if (!requesterId) {
    throw new Error("AUTH_REQUIRED");
  }

  const profileUrl =
    `${SUPABASE_URL}/rest/v1/${USERS_TABLE}` +
    `?select=role&user_id=eq.${encodeURIComponent(requesterId)}&limit=1`;

  const roleRes = await fetch(profileUrl, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!roleRes.ok) {
    throw new Error("PROFILE_READ_FAILED");
  }
  const rows = await roleRes.json();
  const role = normalizeRole(Array.isArray(rows) && rows.length > 0 ? rows[0].role : "user");
  if (role !== "jefe") {
    throw new Error("FORBIDDEN");
  }
  return { requesterId, role };
};

const createAuthUserAndProfile = async (payload) => {
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  if (!email || !email.includes("@")) {
    throw new Error("EMAIL_INVALID");
  }
  if (password.length < 8) {
    throw new Error("PASSWORD_INVALID");
  }

  const authCreateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });
  const authCreateBody = await authCreateRes.json().catch(() => ({}));
  if (!authCreateRes.ok) {
    const message = extractErrorMessage(authCreateBody, "No se pudo crear el usuario en Authentication.");
    throw new Error(message);
  }

  const createdUser = authCreateBody && authCreateBody.user ? authCreateBody.user : authCreateBody;
  const userId = String(createdUser && createdUser.id ? createdUser.id : "");
  if (!userId) {
    throw new Error("No se recibio user_id al crear auth.users.");
  }

  const firstName = String(payload.first_name || "").trim();
  const lastName1 = String(payload.last_name_1 || "").trim();
  const lastName2 = String(payload.last_name_2 || "").trim();
  const jobTitle = String(payload.job_title || "").trim();
  const department = String(payload.department || "").trim();
  const role = normalizeRole(payload.role);
  const displayName = resolveDisplayName(payload, userId, email);

  const profilePayload = {
    user_id: userId,
    display_name: displayName,
    role,
    first_name: firstName,
    last_name_1: lastName1,
    last_name_2: lastName2,
    job_title: jobTitle,
    department,
  };

  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/${USERS_TABLE}?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([profilePayload]),
  });
  const upsertBody = await upsertRes.json().catch(() => ({}));
  if (!upsertRes.ok) {
    const message = extractErrorMessage(upsertBody, "No se pudo enlazar la ficha en kanban_users.");
    throw new Error(message);
  }

  return {
    user_id: userId,
    email,
    profile: Array.isArray(upsertBody) && upsertBody.length > 0 ? upsertBody[0] : profilePayload,
  };
};

const handleCreateAuthUserRequest = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  if (!hasSupabaseAdminConfig()) {
    sendJson(res, 503, {
      error: "Falta configurar SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.",
    });
    return;
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    sendJson(res, 401, { error: "AUTH_REQUIRED" });
    return;
  }

  try {
    await verifyRequesterRole(accessToken);
    const payload = await readJsonBody(req);
    const created = await createAuthUserAndProfile(payload);
    sendJson(res, 200, created);
  } catch (error) {
    const code = String(error && error.message ? error.message : "");
    if (code === "BODY_INVALID_JSON") {
      sendJson(res, 400, { error: "Body JSON invalido." });
      return;
    }
    if (code === "BODY_TOO_LARGE") {
      sendJson(res, 413, { error: "Body demasiado grande." });
      return;
    }
    if (code === "AUTH_REQUIRED") {
      sendJson(res, 401, { error: "AUTH_REQUIRED" });
      return;
    }
    if (code === "FORBIDDEN") {
      sendJson(res, 403, { error: "Solo un usuario jefe puede crear usuarios auth." });
      return;
    }
    if (code === "EMAIL_INVALID" || code === "PASSWORD_INVALID") {
      sendJson(res, 400, { error: code });
      return;
    }
    sendJson(res, 400, { error: code || "No se pudo crear el usuario auth." });
  }
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/admin/create-auth-user") {
      await handleCreateAuthUserRequest(req, res);
      return;
    }

    if (requestUrl.pathname === "/assets/js/supabase-config.js") {
      sendSupabaseConfig(res);
      return;
    }

    if (requestUrl.pathname === "/api/ai/n8n") {
      await proxyAiWebhook(req, res);
      return;
    }

    const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const absolutePath = buildSafePath(pathname);

    if (!absolutePath) {
      send(res, 403, "Forbidden");
      return;
    }

    let lookupPath = absolutePath;
    let file = await tryReadFile(lookupPath);

    if (!file.found && !path.extname(lookupPath)) {
      lookupPath = `${lookupPath}.html`;
      file = await tryReadFile(lookupPath);
    }

    if (!file.found) {
      send(res, 404, "Not Found");
      return;
    }

    const ext = path.extname(lookupPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const cacheControl = ext === ".html" ? "no-cache" : "public, max-age=86400";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    });
    res.end(file.data);
  } catch (error) {
    console.error(error);
    send(res, 500, "Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Kanban server running on http://${HOST}:${PORT}`);
});
