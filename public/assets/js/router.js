/**
 * KanbanRouter — SPA client-side router
 *
 * Intercepts navegacion entre paginas (.tab-btn a y redirecciones de app-context),
 * hace fetch del HTML destino, extrae <main>, lo inyecta sin recarga completa,
 * gestiona CSS especifico de pagina, libs externas (FullCalendar, dhtmlxGantt)
 * y re-ejecuta el script de pagina correspondiente.
 */
(() => {
  'use strict';

  // ─── Registro de paginas ───────────────────────────────────────────────────
  const PAGE_CONFIG = {
    'index.html': {
      script: 'assets/js/main.js',
      css:    'assets/css/main.css',
    },
    'kanban.html': {
      script: 'assets/js/script.js',
      css:    'assets/css/styles.css',
    },
    'calendar.html': {
      script:  'assets/js/calendar.js',
      css:     'assets/css/calendar.css',
      extCss:  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.17/main.min.css',
      extJs:   'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.17/index.global.min.js',
    },
    'gantt.html': {
      script:  'assets/js/gantt.js',
      css:     'assets/css/gantt.css',
      extCss:  'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.css',
      extJs:   'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.js',
    },
    'notas.html': {
      script: 'assets/js/notas.js',
      css:    'assets/css/notas.css',
    },
    'login.html': {
      script: 'assets/js/login.js',
      css:    'assets/css/login.css',
    },
  };

  // ─── Estado ────────────────────────────────────────────────────────────────
  const loadedExternal = new Set(); // libs externas ya cargadas (no recargar)
  let isNavigating = false;

  // ─── Utilidades ───────────────────────────────────────────────────────────
  const getPageName = (url) => {
    try {
      const pathname = new URL(url, window.location.origin).pathname;
      return pathname.split('/').filter(Boolean).pop() || 'index.html';
    } catch (_) {
      return (String(url || '').split('?')[0].split('/').pop()) || 'index.html';
    }
  };

  // ─── CSS de pagina ─────────────────────────────────────────────────────────
  const swapPageCss = (pageName) => {
    document.querySelectorAll('link[data-spa-css]').forEach((el) => el.remove());
    const cssUrl = PAGE_CONFIG[pageName] && PAGE_CONFIG[pageName].css;
    if (!cssUrl) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${cssUrl}?_r=${Date.now()}`;
    link.setAttribute('data-spa-css', pageName);
    document.head.appendChild(link);
  };

  const ensureExternalCss = (href) => {
    if (!href || loadedExternal.has(href)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-spa-extcss', '1');
    document.head.appendChild(link);
    loadedExternal.add(href);
  };

  // ─── Scripts externos (FullCalendar, dhtmlxGantt) ─────────────────────────
  const loadExternalJs = (src) => {
    if (!src || loadedExternal.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { loadedExternal.add(src); resolve(); };
      s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
      document.head.appendChild(s);
    });
  };

  // ─── Script de pagina (re-ejecucion en cada navegacion) ───────────────────
  const executePageScript = (src) => {
    return new Promise((resolve, reject) => {
      // Eliminar script anterior del router para forzar re-ejecucion
      document.querySelectorAll('script[data-spa-page]').forEach((el) => el.remove());
      const s = document.createElement('script');
      // Cache-bust con timestamp para que el navegador vuelva a ejecutar el IIFE
      s.src = `${src}?_spa=${Date.now()}`;
      s.setAttribute('data-spa-page', '1');
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo ejecutar: ${src}`));
      document.body.appendChild(s);
    });
  };

  // ─── Navegacion principal ─────────────────────────────────────────────────
  const navigate = async (url, { pushState = true } = {}) => {
    if (isNavigating) return;
    isNavigating = true;

    try {
      const absUrl  = new URL(url, window.location.origin).href;
      const pageName = getPageName(absUrl);
      const config   = PAGE_CONFIG[pageName];

      // Fetch sin cache (queremos HTML fresco)
      const res = await fetch(absUrl, {
        cache: 'no-store',
        headers: { 'X-SPA': '1' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} al cargar "${url}"`);

      const html = await res.text();
      const parser = new DOMParser();
      const doc    = parser.parseFromString(html, 'text/html');

      const newMain  = doc.querySelector('main');
      const currMain = document.querySelector('main');
      if (!newMain || !currMain) {
        throw new Error('<main> no encontrado en la respuesta.');
      }

      // Actualizar clase de <body> (necesario para login-body, etc.)
      document.body.className = doc.body ? (doc.body.className || '') : '';

      // Swap CSS de pagina
      swapPageCss(pageName);

      // Cargar libs externas si la pagina las necesita
      if (config) {
        ensureExternalCss(config.extCss);
        await loadExternalJs(config.extJs);
      }

      // Reemplazar <main>
      currMain.replaceWith(newMain);

      // Actualizar <title>
      const newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent;

      // History API
      if (pushState) {
        history.pushState({ url: absUrl, page: pageName }, document.title, url);
      }

      // Ejecutar script de pagina
      if (config && config.script) {
        await executePageScript(config.script);
      }

      // Re-inicializar widgets de AI en la nueva pagina
      if (window.KanbanAI && typeof window.KanbanAI.mount === 'function') {
        window.KanbanAI.mount();
      }

    } catch (err) {
      console.error('[KanbanRouter]', err);
      // Fallback: navegacion normal para no dejar la app rota
      window.location.href = url;
    } finally {
      isNavigating = false;
    }
  };

  // ─── Interceptar clics en enlaces ─────────────────────────────────────────
  const isRouteable = (href) => {
    if (!href) return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return false;
    try {
      const u = new URL(href, window.location.origin);
      if (u.origin !== window.location.origin) return false;
      return getPageName(u.href) in PAGE_CONFIG;
    } catch (_) {
      return false;
    }
  };

  document.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!isRouteable(href)) return;
    e.preventDefault();
    navigate(href);
  }, { capture: true });

  // ─── Boton atras / adelante del navegador ─────────────────────────────────
  window.addEventListener('popstate', (e) => {
    const url = (e.state && e.state.url) || window.location.href;
    navigate(url, { pushState: false });
  });

  // Registrar pagina inicial en el historial
  history.replaceState(
    { url: window.location.href, page: getPageName(window.location.href) },
    document.title,
    window.location.href,
  );

  // ─── API publica ──────────────────────────────────────────────────────────
  window.KanbanRouter = Object.freeze({ navigate });
})();
