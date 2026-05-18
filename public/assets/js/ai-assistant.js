(() => {
  const DEFAULT_ENDPOINT = "/api/ai/n8n";
  const GUEST_SESSION_STORAGE_KEY = "kanban_ai_guest_session_id";
  let currentUserIdPromise = null;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizeKey = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const tryParseJson = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return null;
    }
  };

  const pickStringFromObject = (value) => {
    if (!value || typeof value !== "object") return "";

    if (typeof value.html === "string" && value.html.trim()) return value.html.trim();
    if (typeof value.output === "string" && value.output.trim()) return value.output.trim();
    if (typeof value.text === "string" && value.text.trim()) return value.text.trim();

    if (value.json && typeof value.json === "object") {
      const nestedJson = pickStringFromObject(value.json);
      if (nestedJson) return nestedJson;
    }

    if (value.data && typeof value.data === "object") {
      const nestedData = pickStringFromObject(value.data);
      if (nestedData) return nestedData;
    }

    const stringEntries = Object.entries(value).filter(([, entryValue]) => typeof entryValue === "string" && entryValue.trim());
    if (stringEntries.length === 1) return stringEntries[0][1].trim();

    const htmlEntry = stringEntries.find(([, entryValue]) => /<\/?[a-z][\s\S]*>/i.test(entryValue));
    if (htmlEntry) return htmlEntry[1].trim();

    if (stringEntries.length > 1) return stringEntries[0][1].trim();

    return "";
  };

  const unwrapHtmlSource = (value) => {
    let current = String(value ?? "").trim();
    if (!current) return "";

    for (let depth = 0; depth < 4; depth += 1) {
      const withoutFences = current
        .replace(/^```(?:html|json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = tryParseJson(withoutFences);
      if (parsed && typeof parsed === "object") {
        const nested = pickStringFromObject(parsed);
        if (nested && nested !== current) {
          current = nested.trim();
          continue;
        }
      }

      current = withoutFences;
      break;
    }

    return current;
  };

  const compactAiHtml = (html) => {
    const source = unwrapHtmlSource(html);
    if (!source) return "";

    const container = document.createElement("div");
    container.innerHTML = source;

    const report = container.querySelector(".ai-report");
    if (!report) {
      const firstTagIndex = source.indexOf("<");
      const lastTagIndex = source.lastIndexOf(">");

      if (firstTagIndex >= 0 && lastTagIndex > firstTagIndex) {
        return source.slice(firstTagIndex, lastTagIndex + 1).trim();
      }

      return container.innerHTML.trim();
    }

    const compactReport = document.createElement(report.tagName.toLowerCase());
    compactReport.className = report.className;

    const header = report.querySelector(".ai-report__header");
    if (header) {
      const headerClone = document.createElement(header.tagName.toLowerCase());
      headerClone.className = "ai-report__header";

      const title = header.querySelector("h3");
      if (title) {
        headerClone.appendChild(title.cloneNode(true));
      }

      if (headerClone.childNodes.length > 0) {
        compactReport.appendChild(headerClone);
      }
    }

    const kpis = report.querySelector(".ai-kpis");
    if (kpis) {
      compactReport.appendChild(kpis.cloneNode(true));
    }

    const table = report.querySelector(".ai-table");
    if (table) {
      compactReport.appendChild(table.cloneNode(true));
    } else {
      const empty = report.querySelector(".ai-empty");
      if (empty) {
        compactReport.appendChild(empty.cloneNode(true));
      }
    }

    return compactReport.outerHTML;
  };

  const getProjectId = () => {
    const app = window.KanbanApp;
    if (app && typeof app.getProjectIdFromUrl === "function") {
      return app.getProjectIdFromUrl() || "";
    }
    return new URLSearchParams(window.location.search).get("project") || "";
  };

  const getSupabaseClient = () => {
    const app = window.KanbanApp;
    if (app && typeof app.createSupabaseClient === "function") {
      return app.createSupabaseClient();
    }
    return null;
  };

  const getGuestSessionId = () => {
    try {
      const stored = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
      if (stored) return stored;
      const created =
        window.crypto && typeof window.crypto.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, created);
      return created;
    } catch (_) {
      return `guest-${Date.now()}`;
    }
  };

  const getCurrentUserId = async () => {
    if (currentUserIdPromise) return currentUserIdPromise;

    currentUserIdPromise = (async () => {
      const app = window.KanbanApp;
      const supabaseClient = getSupabaseClient();

      if (!app || typeof app.getCurrentUser !== "function" || !supabaseClient) {
        return "";
      }

      try {
        const user = await app.getCurrentUser(supabaseClient);
        return String(user && user.id ? user.id : "");
      } catch (error) {
        console.warn("No se pudo resolver el usuario para la memoria de n8n.", error);
        return "";
      }
    })();

    return currentUserIdPromise;
  };

  const getSessionId = async (widget) => {
    const page = String(widget.dataset.aiPage || document.title || "Kanban").trim() || "Kanban";
    const projectId = getProjectId();
    const userId = await getCurrentUserId();
    const scope = String(projectId || page || "main").trim() || "main";

    if (userId) {
      return `user:${userId}:${scope}`;
    }

    return `guest:${getGuestSessionId()}:${scope}`;
  };

  const extractHtml = async (response) => {
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (data && typeof data === "object") {
        if (Array.isArray(data) && data.length > 0) {
          const nestedArrayValue = pickStringFromObject(data[0]);
          if (nestedArrayValue) {
            const parsedArrayValue = tryParseJson(nestedArrayValue);
            if (parsedArrayValue && typeof parsedArrayValue === "object") {
              const nestedParsedArrayValue = pickStringFromObject(parsedArrayValue);
              if (nestedParsedArrayValue) return nestedParsedArrayValue;
            }
            return nestedArrayValue;
          }
        }

        const directValue = pickStringFromObject(data);
        if (directValue) {
          const parsedDirectValue = tryParseJson(directValue);
          if (parsedDirectValue && typeof parsedDirectValue === "object") {
            const nestedParsedDirectValue = pickStringFromObject(parsedDirectValue);
            if (nestedParsedDirectValue) return nestedParsedDirectValue;
          }
          return directValue;
        }
      }
      return "";
    }

    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed) return "";

    const parsed = tryParseJson(trimmed);
    if (parsed && typeof parsed === "object") {
      const directValue = pickStringFromObject(parsed);
      if (directValue) return directValue;
    }

    return trimmed;
  };

  const buildPayload = async (widget, question) => {
    const page = widget.dataset.aiPage || document.title || "Kanban";
    const projectId = getProjectId();
    const sessionId = await getSessionId(widget);
    const userId = await getCurrentUserId();

    return {
      chatInput: question,
      page,
      project_id: projectId || null,
      user_id: userId || null,
      sessionId,
      memorySessionId: sessionId,
      session_scope: projectId || page || "main",
    };
  };

  const renderFallback = (outputEl, message, tone = "info") => {
    outputEl.innerHTML = `<div class="ai-empty ${tone === "error" ? "ai-empty--error" : ""}">${escapeHtml(message)}</div>`;
  };

  const initWidget = (widget) => {
    // Evitar inicializar el mismo widget dos veces (SPA re-mount)
    if (widget.dataset.aiMounted === '1') return;
    widget.dataset.aiMounted = '1';

    const form = widget.querySelector("[data-ai-form]");
    const input = widget.querySelector("[data-ai-input]");
    const submit = widget.querySelector("[data-ai-submit]");
    const output = widget.querySelector("[data-ai-output]");
    const endpoint = widget.dataset.aiEndpoint || DEFAULT_ENDPOINT;

    if (!form || !input || !submit || !output) return;

    let busy = false;

    const setBusy = (value) => {
      busy = value;
      submit.disabled = value;
      widget.dataset.loading = value ? "1" : "0";
      submit.textContent = value ? "Pensando..." : "Preguntar";
    };

    const renderResponse = async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `HTTP ${response.status}`);
      }

      const html = await extractHtml(response);
      const compactHtml = compactAiHtml(html);
      if (!compactHtml) {
        renderFallback(output, "La IA no devolvio contenido util.", "error");
        return;
      }

      output.innerHTML = compactHtml;
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = String(input.value || "").trim();
      if (!question || busy) return;

      setBusy(true);
      renderFallback(output, "Consultando la IA...", "info");

      try {
        const payload = await buildPayload(widget, question);
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/html, text/plain;q=0.9, */*;q=0.8",
          },
          body: JSON.stringify(payload),
        });

        await renderResponse(response);
      } catch (error) {
        console.error(error);
        renderFallback(output, "No se pudo conectar con la IA de n8n.", "error");
      } finally {
        setBusy(false);
      }
    });

    if (!output.dataset.initialized) {
      renderFallback(output, "Escribe una pregunta para consultar la IA de n8n.", "info");
      output.dataset.initialized = "1";
    }
  };

  const mount = () => {
    const widgets = document.querySelectorAll("[data-ai-widget]");
    widgets.forEach((widget) => initWidget(widget));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  // Exponer para que el router pueda re-inicializar tras cada navegacion SPA
  window.KanbanAI = Object.freeze({ mount });
})();
