const STORAGE_KEY = 'luthier-finishing-tracker-v1';

const today = new Date().toISOString().slice(0, 10);

const state = loadState();

const inventoryForm = document.querySelector('#inventory-form');
const buildForm = document.querySelector('#build-form');
const dailyLogForm = document.querySelector('#daily-log-form');
const buildList = document.querySelector('#build-list');
const wipList = document.querySelector('#wip-list');
const buildSelect = dailyLogForm.elements.buildId;
const dailyStatus = document.querySelector('#daily-status');
const gate = document.querySelector('#daily-gate');
const closeGate = document.querySelector('#close-gate');

bootstrap();

function bootstrap() {
  hydrateInventoryForm();
  renderBuildOptions();
  renderBuilds();
  renderWipEntries();
  enforceDailyGate();
}

inventoryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(inventoryForm);
  state.inventory = {
    bodies: Number(formData.get('bodies')),
    necks: Number(formData.get('necks')),
    electronics: Number(formData.get('electronics')),
    switching: Number(formData.get('switching')),
  };

  persist();
});

buildForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(buildForm);
  const name = String(formData.get('name')).trim();
  if (!name) return;

  const existing = state.builds.find((build) => build.name.toLowerCase() === name.toLowerCase());
  const payload = {
    name,
    stage: String(formData.get('stage')),
    finishStage: String(formData.get('finishStage')),
    targetDate: String(formData.get('targetDate') || ''),
    notes: String(formData.get('notes') || ''),
    updatedAt: today,
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.builds.unshift({ id: crypto.randomUUID(), ...payload });
  }

  persist();
  renderBuildOptions();
  renderBuilds();
  buildForm.reset();
});

dailyLogForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!buildSelect.value) {
    dailyStatus.textContent = 'Add a build first so you can log work.';
    return;
  }

  const formData = new FormData(dailyLogForm);

  const newEntry = {
    id: crypto.randomUUID(),
    date: today,
    buildId: String(formData.get('buildId')),
    minutes: Number(formData.get('minutes')),
    workDone: String(formData.get('workDone')),
    nextStep: String(formData.get('nextStep')),
  };

  state.wip = state.wip.filter((entry) => !(entry.date === today && entry.buildId === newEntry.buildId));
  state.wip.unshift(newEntry);

  persist();
  renderWipEntries();
  enforceDailyGate();
  dailyStatus.textContent = 'Saved. Tomorrow you will be prompted again.';
  dailyLogForm.reset();
});

closeGate.addEventListener('click', () => gate.close());

function hydrateInventoryForm() {
  for (const [key, value] of Object.entries(state.inventory)) {
    if (inventoryForm.elements[key]) {
      inventoryForm.elements[key].value = value;
    }
  }
}

function renderBuildOptions() {
  buildSelect.innerHTML = '';

  for (const build of state.builds) {
    const option = document.createElement('option');
    option.value = build.id;
    option.textContent = `${build.name} — ${build.finishStage}`;
    buildSelect.append(option);
  }
}

function renderBuilds() {
  buildList.innerHTML = '';

  if (state.builds.length === 0) {
    buildList.innerHTML = '<li>No builds yet. Add one above.</li>';
    return;
  }

  for (const build of state.builds) {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${escapeHtml(build.name)}</strong><br />
      Stage: ${escapeHtml(build.stage)} / ${escapeHtml(build.finishStage)}<br />
      Target: ${escapeHtml(build.targetDate || 'Not set')}<br />
      <em>${escapeHtml(build.notes || 'No notes')}</em>`;
    buildList.append(item);
  }
}

function renderWipEntries() {
  wipList.innerHTML = '';
  const buildsById = new Map(state.builds.map((build) => [build.id, build]));

  const entries = [...state.wip].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);

  if (entries.length === 0) {
    wipList.innerHTML = '<li>No WIP entries yet.</li>';
    return;
  }

  for (const entry of entries) {
    const item = document.createElement('li');
    const build = buildsById.get(entry.buildId);
    item.innerHTML = `<strong>${escapeHtml(entry.date)} — ${escapeHtml(build?.name || 'Unknown build')}</strong><br />
      ${escapeHtml(String(entry.minutes))} min<br />
      Done: ${escapeHtml(entry.workDone)}<br />
      Next: ${escapeHtml(entry.nextStep)}`;
    wipList.append(item);
  }
}

function enforceDailyGate() {
  const hasEntryToday = state.wip.some((entry) => entry.date === today);

  if (!hasEntryToday) {
    dailyStatus.textContent = `No entry for ${today} yet. Please log your session.`;
    gate.showModal();
  } else {
    dailyStatus.textContent = `Today's log complete (${today}).`;
    gate.close();
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const fallback = {
    inventory: {
      bodies: 0,
      necks: 0,
      electronics: 0,
      switching: 0,
    },
    builds: [],
    wip: [],
  };

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      ...fallback,
      ...parsed,
      inventory: { ...fallback.inventory, ...parsed.inventory },
      builds: Array.isArray(parsed.builds) ? parsed.builds : [],
      wip: Array.isArray(parsed.wip) ? parsed.wip : [],
    };
  } catch {
    return fallback;
  }
}

function escapeHtml(input) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
