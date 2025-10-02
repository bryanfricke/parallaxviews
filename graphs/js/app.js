const JSON_PATH = 'data/theistic-arguments.json';

const sel = (q, el = document) => el.querySelector(q);
const create = (tag, cls) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
};

async function loadArguments() {
  const res = await fetch(JSON_PATH, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${JSON_PATH}: ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.arguments)) throw new Error("Invalid JSON format: expected { arguments: [...] }");
  return data.arguments;
}

function populateSelect(args) {
  const select = sel('#argumentSelect');
  select.innerHTML = '';
  args.forEach(arg => {
    const opt = create('option');
    opt.value = arg.id;
    opt.textContent = arg.title;
    select.appendChild(opt);
  });
}

function renderArgument(arg) {
  const content = sel('#argumentContent');
  if (!content) return;
  content.innerHTML = '';

  const h2 = create('h2', 'arg-title');
  h2.textContent = arg.title;

  const ol = create('ol', 'steps');

  const hasExplanations = Array.isArray(arg.explanations);
  arg.steps.forEach((s, idx) => {
    const li = create('li', 'step' + (s.conclusion ? ' conclusion' : ''));
    li.textContent = s.text;

    if (hasExplanations && arg.explanations[idx]) {
      const exp = createExplanation(arg.explanations[idx]);
      li.appendChild(exp);
    }
    ol.appendChild(li);
  });

  content.appendChild(h2);
  content.appendChild(ol);
}

// Build a collapsible explanation element
function createExplanation(text) {
  const wrap = create('div', 'explain');
  const btn = create('button', 'explain-toggle');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = 'Explain';
  const body = create('div', 'explain-body');
  body.textContent = text;
  body.hidden = true;

  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    body.hidden = open;
  });

  wrap.appendChild(btn);
  wrap.appendChild(body);
  return wrap;
}

function setupCopy() {
  const btn = sel('#copyBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const content = sel('#argumentContent');
    if (!content || !content.textContent.trim()) return;
    const text = content.textContent
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      // show success state on the button and a transient toast
      btn.classList.add('success');
      showToast('Copied');
      setTimeout(() => btn.classList.remove('success'), 1200);
    } catch {
      // Fallback
      const ta = create('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      btn.classList.add('success');
      showToast('Copied');
      setTimeout(() => btn.classList.remove('success'), 1200);
    }
  });
}

// Transient toast notification (non-blocking)
function showToast(message, timeout = 1200) {
  let container = document.getElementById('dedeo-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dedeo-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.style.position = 'fixed';
    container.style.zIndex = 9999;
    container.style.right = '1rem';
    container.style.bottom = '1rem';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'dedeo-toast';
  toast.textContent = message;
  container.appendChild(toast);

  // auto-remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => toast.remove(), 300);
  }, timeout);
}

(async function init() {
  try {
    const args = await loadArguments();
    populateSelect(args);

    const select = sel('#argumentSelect');
    const show = () => {
      const current = args.find(a => a.id === select.value) || args[0];
      renderArgument(current);
    };
    select.addEventListener('change', show);
    show();

    setupCopy();
    setupTheme();
  } catch (err) {
    const container = sel('#argumentContainer');
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
    console.error(err);
  }
})();

// Theme utilities: respect saved preference, fall back to system, and allow toggle
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const btn = sel('#themeToggle');
  if (btn) {
    // Keep the button content as icons; set aria-pressed and update sr-only label for screen readers.
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    const label = sel('#themeToggleLabel');
    if (label) label.textContent = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}

function setupTheme() {
  const btn = sel('#themeToggle');
  const saved = localStorage.getItem('dedeo-theme');
  let theme = saved;
  if (!theme) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }
  applyTheme(theme);

  if (btn) {
    btn.addEventListener('click', () => {
      const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      localStorage.setItem('dedeo-theme', newTheme);
      applyTheme(newTheme);
    });
  }
}
