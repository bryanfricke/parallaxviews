const JSON_PATH = 'data/arguments.json';

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
  const container = sel('#argumentContainer');
  container.innerHTML = '';

  const h2 = create('h2', 'arg-title');
  h2.textContent = arg.title;

  const ul = create('ul', 'steps');

  arg.steps.forEach(s => {
    const li = create('li', 'step' + (s.conclusion ? ' conclusion' : ''));
    li.textContent = s.text;
    ul.appendChild(li);
  });

  container.appendChild(h2);
  container.appendChild(ul);
}

function setupCopy() {
  sel('#copyBtn').addEventListener('click', async () => {
    const container = sel('#argumentContainer');
    if (!container.textContent.trim()) return;
    const text = container.textContent
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flash(sel('#copyBtn'));
    } catch {
      // Fallback
      const ta = create('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      flash(sel('#copyBtn'));
    }
  });
}

function flash(btn) {
  const original = btn.textContent;
  btn.textContent = 'Copied';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 900);
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
  } catch (err) {
    const container = sel('#argumentContainer');
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
    console.error(err);
  }
})();
