// ==== Состояние ====
const state = {
  role: 'business',
  screen: 'draft',
  draft: '',
  answers: [],
  questions: [],
  card: null,
  rating: null,
  tasks: [],
  proposals: [],
  currentTaskId: null,
};

const app = document.getElementById('app');

// ==== Прогресс для бизнеса ====
const BUSINESS_STEPS = [
  { key: 'draft', label: 'Черновик' },
  { key: 'questions', label: 'Вопросы' },
  { key: 'card', label: 'Карточка' },
  { key: 'rating', label: 'Рейтинг' },
  { key: 'tasks', label: 'Публикация' },
];

function renderProgress(currentKey) {
  const idx = BUSINESS_STEPS.findIndex(s => s.key === currentKey);
  if (idx === -1) return '';
  return `
    <div class="progress">
      ${BUSINESS_STEPS.map((s, i) => {
        const cls = i === idx ? 'active' : (i < idx ? 'done' : '');
        const num = i < idx ? '✓' : (i + 1);
        return `
          <div class="progress-step ${cls}">
            <div class="progress-dot">${num}</div>
            <div class="progress-label">${s.label}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ==== Переключение ролей ====
document.querySelectorAll('#role-switcher button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#role-switcher button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.role = btn.dataset.role;
    state.screen = state.role === 'business' ? 'draft' : 'catalog';
    render();
  });
});

// ==== Уведомления ====
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

// ==== Рендер ====
function render() {
  if (state.role === 'business') renderBusiness();
  else renderStudent();
}

function renderBusiness() {
  switch (state.screen) {
    case 'draft':     renderDraft(); break;
    case 'questions': renderQuestions(); break;
    case 'card':      renderCard(); break;
    case 'rating':    renderRating(); break;
    case 'tasks':     renderMyTasks(); break;
    case 'responses': renderResponses(); break;
  }
}

function renderStudent() {
  switch (state.screen) {
    case 'catalog':  renderCatalog(); break;
    case 'detail':   renderTaskDetail(); break;
    case 'proposal': renderProposalForm(); break;
    case 'myprops':  renderMyProposals(); break;
  }
}

// ==== 1. Черновик ====
function renderDraft() {
  app.innerHTML = `
    ${renderProgress('draft')}
    <div class="card">
      <h2>Опишите задачу</h2>
      <p class="subtitle">Расскажите о потребности, проблеме или задаче бизнеса своими словами.</p>
      <textarea id="draft" rows="6" placeholder="Например: нужна система учёта заявок от клиентов с автоматической сортировкой по приоритету...">${state.draft}</textarea>
      <button class="primary" id="next">Продолжить →</button>
    </div>
  `;
  document.getElementById('next').addEventListener('click', () => {
    const text = document.getElementById('draft').value.trim();
    if (!text) { toast('Введите описание'); return; }
    state.draft = text;
    state.questions = generateQuestions(text);
    state.answers = state.questions.map(() => '');
    state.screen = 'questions';
    render();
  });
}

// ==== 2. Вопросы ====
function renderQuestions() {
  app.innerHTML = `
    ${renderProgress('questions')}
    <div class="card">
      <h2>Уточняющие вопросы</h2>
      <p class="subtitle">Ответьте, чтобы система собрала полную карточку задачи.</p>
      ${state.questions.map((q, i) => `
        <label>${q}</label>
        <textarea rows="2" data-i="${i}" placeholder="Ваш ответ...">${state.answers[i]}</textarea>
      `).join('')}
      <div class="actions">
        <button class="secondary" id="back">← Назад</button>
        <button class="primary" id="build">Сформировать карточку →</button>
      </div>
    </div>
  `;
  app.querySelectorAll('textarea[data-i]').forEach(t => {
    t.addEventListener('input', e => {
      state.answers[+e.target.dataset.i] = e.target.value;
    });
  });
  document.getElementById('back').addEventListener('click', () => {
    state.screen = 'draft'; render();
  });
  document.getElementById('build').addEventListener('click', () => {
    state.card = buildCard(state.draft, state.answers);
    state.screen = 'card';
    render();
  });
}

// ==== 3. Карточка ====
function renderCard() {
  const c = state.card;
  const fields = [
    ['title', 'Название'],
    ['context', 'Контекст'],
    ['need', 'Потребность'],
    ['users', 'Пользователи'],
    ['data', 'Данные и материалы'],
    ['constraints', 'Ограничения'],
    ['expectedResult', 'Ожидаемый результат'],
    ['successCriteria', 'Критерии успеха'],
    ['contact', 'Контакт'],
    ['interactionFormat', 'Формат взаимодействия'],
  ];
  app.innerHTML = `
    ${renderProgress('card')}
    <div class="card">
      <h2>Карточка задачи</h2>
      <p class="subtitle">Проверьте и отредактируйте все поля перед подтверждением.</p>
      ${fields.map(([f, label]) => `
        <label>${label}</label>
        <textarea rows="2" data-field="${f}" placeholder="Заполните поле...">${c[f] || ''}</textarea>
      `).join('')}
      <div class="actions">
        <button class="secondary" id="back">← Назад</button>
        <button class="primary" id="confirm">Подтвердить →</button>
      </div>
    </div>
  `;
  app.querySelectorAll('textarea[data-field]').forEach(t => {
    t.addEventListener('input', e => {
      state.card[e.target.dataset.field] = e.target.value;
    });
  });
  document.getElementById('back').addEventListener('click', () => {
    state.screen = 'questions'; render();
  });
  document.getElementById('confirm').addEventListener('click', () => {
    state.rating = calcRating(state.card);
    state.screen = 'rating';
    render();
  });
}

// ==== 4. Рейтинг ====
function renderRating() {
  const r = state.rating;
  const levelNames = {
    draft: 'Черновик', working: 'Рабочая',
    ready: 'Готовая', priority: 'Приоритетная'
  };
  const scoreColors = {
    draft: '#ef4444', working: '#f59e0b',
    ready: '#3b82f6', priority: '#10b981'
  };
  app.innerHTML = `
    ${renderProgress('rating')}
    <div class="card">
      <h2>Рейтинг готовности</h2>
      <div class="rating-hero">
        <div class="rating-score" style="color:${scoreColors[r.level]}">${r.score}</div>
        <span class="rating-level level-${r.level}">${levelNames[r.level]}</span>
      </div>
      <div>
        ${r.breakdown.map(b => `
          <div class="breakdown-row">
            <span style="min-width:180px">${b.field}</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width:${(b.points/b.max)*100}%"></div>
            </div>
            <span style="min-width:60px;text-align:right;font-weight:600">${b.points}/${b.max}</span>
          </div>
        `).join('')}
      </div>
      ${r.missing.length ? `
        <div class="missing-list">
          <strong>💡 Что улучшит рейтинг:</strong>
          <ul>${r.missing.map(m => `<li>${m}</li>`).join('')}</ul>
        </div>
      ` : ''}
      <div class="actions">
        <button class="secondary" id="back">← Редактировать карточку</button>
        <button class="primary" id="publish">Опубликовать в каталог →</button>
      </div>
    </div>
  `;
  document.getElementById('back').addEventListener('click', () => {
    state.screen = 'card'; render();
  });
  document.getElementById('publish').addEventListener('click', () => {
    const task = { ...state.card, rating: r.score, level: r.level, id: Date.now() };
    state.tasks.push(task);
    toast('Задача опубликована!');
    state.screen = 'tasks';
    render();
  });
}

// ==== 5. Мои задачи ====
function renderMyTasks() {
  app.innerHTML = `
    ${renderProgress('tasks')}
    <div class="card">
      <h2>Мои задачи</h2>
      <p class="subtitle">Опубликованные задачи и отклики команд.</p>
      ${state.tasks.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">📋</div>
          <p>Пока нет опубликованных задач</p>
        </div>
      ` : state.tasks.map(t => `
        <div class="task-card">
          <div class="task-header">
            <div class="task-title">${t.title || 'Без названия'}</div>
            <span class="badge level-${t.level}">${t.rating}</span>
          </div>
          <div class="task-desc">${t.need || 'Без описания'}</div>
          <button class="secondary" onclick="viewResponses(${t.id})">
            Отклики (${state.proposals.filter(p => p.taskId === t.id).length})
          </button>
        </div>
      `).join('')}
      <div class="actions">
        <button class="secondary" onclick="newTask()">+ Новая задача</button>
      </div>
    </div>
  `;
}

window.viewResponses = (taskId) => {
  state.currentTaskId = taskId;
  state.screen = 'responses';
  render();
};

window.newTask = () => {
  state.screen = 'draft';
  state.draft = '';
  state.answers = [];
  state.card = null;
  state.rating = null;
  render();
};

// ==== 6. Отклики ====
function renderResponses() {
  const taskProposals = state.proposals.filter(p => p.taskId === state.currentTaskId);
  app.innerHTML = `
    <div class="card">
      <h2>Отклики команд</h2>
      <p class="subtitle">Сравните предложения и выберите подходящие.</p>
      ${taskProposals.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <p>Пока нет откликов</p>
        </div>
      ` : taskProposals.map(p => `
        <div class="task-card">
          <div class="task-header">
            <div class="task-title">${p.team}</div>
            <span class="badge ${p.status === 'принят' ? 'level-priority' : p.status === 'отклонён' ? 'level-draft' : 'level-working'}">${p.status}</span>
          </div>
          <p style="margin:8px 0"><b>Идея:</b> ${p.idea}</p>
          ${p.plan ? `<p style="margin:4px 0"><b>План:</b> ${p.plan}</p>` : ''}
          ${p.deadline ? `<p style="margin:4px 0"><b>Срок:</b> ${p.deadline}</p>` : ''}
          ${p.link ? `<p style="margin:4px 0"><b>Прототип:</b> <a href="${p.link}" target="_blank">${p.link}</a></p>` : ''}
          ${p.status === 'ожидает' ? `
            <div class="actions">
              <button class="primary" onclick="decide(${p.id}, 'принят')">✓ Выбрать</button>
              <button class="secondary" onclick="decide(${p.id}, 'отклонён')">✕ Отклонить</button>
            </div>
          ` : ''}
        </div>
      `).join('')}
      <div class="actions">
        <button class="secondary" onclick="backToTasks()">← Назад</button>
      </div>
    </div>
  `;
}

window.decide = (id, decision) => {
  const p = state.proposals.find(p => p.id === id);
  if (p) p.status = decision;
  toast(decision === 'принят' ? 'Команда выбрана' : 'Отклик отклонён');
  render();
};

window.backToTasks = () => {
  state.screen = 'tasks'; render();
};

// ==== Каталог ====
function renderCatalog() {
  app.innerHTML = `
    <div class="card">
      <h2>Каталог задач</h2>
      <p class="subtitle">Задачи отсортированы по рейтингу готовности.</p>
      <div class="filters">
        <select id="filter-level">
          <option value="">Все уровни</option>
          <option value="draft">Черновик</option>
          <option value="working">Рабочая</option>
          <option value="ready">Готовая</option>
          <option value="priority">Приоритетная</option>
        </select>
        <input id="filter-text" placeholder="🔍 Поиск по названию..." />
      </div>
      <div id="tasks-list"></div>
    </div>
  `;
  renderTaskList();
  document.getElementById('filter-level').addEventListener('change', renderTaskList);
  document.getElementById('filter-text').addEventListener('input', renderTaskList);
}

function renderTaskList() {
  const level = document.getElementById('filter-level')?.value || '';
  const text = (document.getElementById('filter-text')?.value || '').toLowerCase();
  let list = [...state.tasks].sort((a, b) => b.rating - a.rating);
  if (level) list = list.filter(t => t.level === level);
  if (text) list = list.filter(t => (t.title || '').toLowerCase().includes(text));

  const container = document.getElementById('tasks-list');
  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🔍</div>
        <p>Задач пока нет</p>
      </div>`;
    return;
  }
  container.innerHTML = list.map(t => `
    <div class="task-card" onclick="openTask(${t.id})">
      <div class="task-header">
        <div class="task-title">${t.title || 'Без названия'}</div>
        <span class="badge level-${t.level}">${t.rating}</span>
      </div>
      <div class="task-desc">${t.need || 'Без описания'}</div>
    </div>
  `).join('');
}

window.openTask = (id) => {
  state.currentTaskId = id;
  state.screen = 'detail';
  render();
};

// ==== Детали задачи ====
function renderTaskDetail() {
  const t = state.tasks.find(t => t.id === state.currentTaskId);
  if (!t) { state.screen = 'catalog'; render(); return; }
  app.innerHTML = `
    <div class="card">
      <div class="task-header">
        <h2>${t.title || 'Без названия'}</h2>
        <span class="badge level-${t.level}">${t.rating} / 100</span>
      </div>
      <p style="margin:16px 0"><b>Контекст:</b><br>${t.context || '—'}</p>
      <p style="margin:12px 0"><b>Потребность:</b><br>${t.need || '—'}</p>
      <p style="margin:12px 0"><b>Пользователи:</b><br>${t.users || '—'}</p>
      <p style="margin:12px 0"><b>Данные:</b><br>${t.data || '—'}</p>
      <p style="margin:12px 0"><b>Ограничения:</b><br>${t.constraints || '—'}</p>
      <p style="margin:12px 0"><b>Ожидаемый результат:</b><br>${t.expectedResult || '—'}</p>
      <p style="margin:12px 0"><b>Критерии успеха:</b><br>${t.successCriteria || '—'}</p>
      <div class="actions">
        <button class="secondary" onclick="backToCatalog()">← В каталог</button>
        <button class="primary" onclick="goToProposal()">Отправить предложение →</button>
      </div>
    </div>
  `;
}

window.goToProposal = () => { state.screen = 'proposal'; render(); };
window.backToCatalog = () => { state.screen = 'catalog'; render(); };

// ==== Форма отклика ====
function renderProposalForm() {
  app.innerHTML = `
    <div class="card">
      <h2>Ваше предложение</h2>
      <p class="subtitle">Заполните информацию о вашей команде и решении.</p>
      <label>Название команды *</label>
      <input id="team" placeholder="Например, Team Alpha" />
      <label>Идея решения *</label>
      <textarea id="idea" rows="3" placeholder="Как вы предлагаете решить задачу?"></textarea>
      <label>План работы</label>
      <textarea id="plan" rows="3" placeholder="Основные этапы..."></textarea>
      <label>Срок</label>
      <input id="deadline" placeholder="Например, 2 недели" />
      <label>Ссылка на прототип</label>
      <input id="link" placeholder="https://..." />
      <div class="actions">
        <button class="secondary" onclick="backToCatalog()">← Назад</button>
        <button class="primary" id="send">Отправить отклик →</button>
      </div>
    </div>
  `;
  document.getElementById('send').addEventListener('click', () => {
    const team = document.getElementById('team').value.trim();
    const idea = document.getElementById('idea').value.trim();
    if (!team || !idea) { toast('Заполните обязательные поля'); return; }
    state.proposals.push({
      id: Date.now(),
      taskId: state.currentTaskId,
      team, idea,
      plan: document.getElementById('plan').value,
      deadline: document.getElementById('deadline').value,
      link: document.getElementById('link').value,
      status: 'ожидает'
    });
    toast('Отклик отправлен!');
    state.screen = 'myprops';
    render();
  });
}

// ==== Мои отклики ====
function renderMyProposals() {
  app.innerHTML = `
    <div class="card">
      <h2>Мои отклики</h2>
      <p class="subtitle">Статус ваших предложений бизнесу.</p>
      ${state.proposals.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">📮</div>
          <p>Пока нет откликов</p>
        </div>
      ` : state.proposals.map(p => `
        <div class="task-card">
          <div class="task-header">
            <div class="task-title">${p.team}</div>
            <span class="badge ${p.status === 'принят' ? 'level-priority' : p.status === 'отклонён' ? 'level-draft' : 'level-working'}">${p.status}</span>
          </div>
          <p style="margin-top:8px;color:var(--muted)">${p.idea}</p>
        </div>
      `).join('')}
      <div class="actions">
        <button class="secondary" onclick="backToCatalog()">← В каталог</button>
      </div>
    </div>
  `;
}

// ==== Заглушки ====
function generateQuestions(draft) {
  return [
    'Какую проблему вы хотите решить?',
    'Кто будет пользоваться решением?',
    'Какие данные или материалы у вас есть?',
    'Какой результат вы ожидаете?',
    'Какие ограничения по срокам и технологиям?',
  ];
}

function buildCard(draft, answers) {
  return {
    title: draft.slice(0, 60),
    context: draft,
    need: answers[0] || '',
    users: answers[1] || '',
    data: answers[2] || '',
    expectedResult: answers[3] || '',
    constraints: answers[4] || '',
    successCriteria: '',
    contact: '',
    interactionFormat: '',
  };
}
function calcRating(card) {
  const weights = [
    { field: 'Контекст и потребность', key: 'context', max: 20 },
    { field: 'Данные и материалы', key: 'data', max: 20 },
    { field: 'Ожидаемый результат', key: 'expectedResult', max: 15 },
    { field: 'Критерии успеха', key: 'successCriteria', max: 15 },
    { field: 'Ограничения', key: 'constraints', max: 10 },
    { field: 'Пользователи', key: 'users', max: 10 },
    { field: 'Связь с бизнесом', key: 'contact', max: 10 },
  ];
  let score = 0;
  const breakdown = [];
  const missing = [];
  weights.forEach(w => {
    const val = (card[w.key] || '').trim();
    const points = val.length > 10 ? w.max : val.length > 0 ? Math.round(w.max / 2) : 0;
    score += points;
    breakdown.push({ field: w.field, points, max: w.max });
    if (points < w.max) missing.push(w.field);
  });
  let level = 'draft';
  if (score >= 90) level = 'priority';
  else if (score >= 70) level = 'ready';
  else if (score >= 40) level = 'working';
  return { score, breakdown, missing, level };
}

// ==== Старт ====
render();