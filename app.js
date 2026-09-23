const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ==== Глобальное состояние ====
let role = 'guest';
let user = { name: 'Аружан С.', university: 'КазНУ', skills: 'Python, аналитика' };
let verification = 'pending';
let verificationMethod = 'Документ';
let current = 1;

const names = ['Контекст и потребность', 'Данные и материалы', 'Ожидаемый результат', 'Критерии успеха', 'Ограничения', 'Пользователи', 'Связь с бизнесом'];
const weights = [20, 20, 15, 15, 10, 10, 10];

// ==== Данные из общего модуля ====
const { previewRating, analyzeDraft, FIELD_DEFS, FIELD_KEYS, RULES, emptyFields, PARTICIPANT_CARDS, SEED_DRAFTS, K1_ANSWERS, k1AnswerPatch } = window.SanaCore;
const model = window.qalamModel;
let tasks = [], offers = [];
function syncData() { model.refresh(); tasks = model.tasks; offers = model.offers; }
syncData();
let editorId = null;
let editorRevision = 0;
let aiRun = 0;
let lastQuestions = [];
let aiCandidate = null;
let toastTimer;

// ==== Утилиты ====
const level = n => n < 40 ? 'Черновик' : n < 70 ? 'Рабочая' : n < 90 ? 'Готовая' : 'Приоритетная';

function toast(s) {
  $('#toast').textContent = s;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').hidden = true, 7000);
}

function open(html) {
  $('#modal').innerHTML = '<button class="close" aria-label="Закрыть" onclick="closeModal()">×</button>' + html;
  if (!$('#modal').open) $('#modal').showModal();
}

function closeModal() { $('#modal').close(); }
function go(v) { history.pushState(null, '', '#' + v); render(); }
function setRole(r) { role = r; $('#role').value = r; render(); }

$('#role').onchange = e => setRole(e.target.value);
window.onhashchange = render;
window.onpopstate = render;

// ==== Роутер ====
function render() {
  syncData();
  const route = location.hash.slice(1) || 'catalog';

  $('#nav').innerHTML = [
    ['catalog', 'Каталог задач'],
    ['businesses', 'Бизнесы'],
    ['cabinet', role === 'business' ? 'Мои задачи' : 'Мой кабинет']
  ].map(([id, n]) => `<button class="${route === id ? 'active' : ''}" onclick="go('${id}')">${n}</button>`).join('');

  $('#account').textContent =
    role === 'guest' ? 'Войти / Регистрация' :
    role === 'business' ? 'Бизнес · Демо' :
    role === 'moderator' ? 'Модератор' :
    user.name;

  if (route.startsWith('task-')) detail(Number(route.split('-')[1]));
  else if (route === 'businesses') businesses();
  else if (route === 'cabinet') cabinet();
  else if (route === 'editor') editor();
  else catalog();
}

// ==== Каталог ====
function catalog() {
  $('#app').innerHTML = `
    <div class="top">
      <div>
        <div class="eyebrow">ПРАКТИКА С РЕАЛЬНЫМ БИЗНЕСОМ</div>
        <h1>Найдите свою задачу</h1>
        <p class="muted">Выбирайте проект по интересам. Предлагайте решение самостоятельно.</p>
      </div>
      <button class="primary" onclick="role==='business'?go('editor'):auth('business')">+ Разместить задачу</button>
    </div>
    <div class="layout">
      <aside class="panel sidebar">
        <div>
          <label for="search">Поиск задачи или бизнеса</label>
          <input id="search" placeholder="Например, Python" oninput="drawCards()">
        </div>
        <div>
          <label for="topic">Направление</label>
          <select id="topic" onchange="drawCards()">
            <option value="">Все направления</option>
            ${[...new Set(tasks.map(t => t.topic))].map(s => `<option>${esc(s)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="level">Готовность задачи</label>
          <select id="level" onchange="drawCards()">
            <option value="">Все уровни</option>
            <option>Черновик</option>
            <option>Рабочая</option>
            <option>Готовая</option>
            <option>Приоритетная</option>
          </select>
        </div>
        <hr>
        <div class="hint">
          <b>Что значит рейтинг?</b>
          <p style="margin:8px 0 0">Это полнота постановки задачи. Даже на черновик можно откликнуться.</p>
        </div>
      </aside>
      <section>
        <div class="toolbar">
          <span id="results" class="muted small"></span>
          <span class="small">Сначала самые готовые ↓</span>
        </div>
        <div id="cards" class="cards"></div>
      </section>
    </div>
  `;
  drawCards();
}

function drawCards() {
  const q = $('#search').value.toLowerCase();
  const topic = $('#topic').value;
  const l = $('#level').value;

  let list = tasks
    .filter(t => t.published
      && (!topic || t.topic === topic)
      && (!l || level(t.score) === l)
      && [t.title, t.company, ...t.tags].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.score - a.score || a.id - b.id);

  $('#results').textContent = `Найдено задач: ${list.length}`;

  $('#cards').innerHTML = list.map(t => `
    <article class="card">
      <div class="company">
        <span class="avatar">${esc(t.mark)}</span>
        <div>
          <b>${esc(t.company)}</b>
          <div class="muted small">${esc(t.topic)}</div>
        </div>
      </div>
      <h3>${esc(t.title)}</h3>
      <p>${esc(t.desc)}</p>
      <div class="tags">${t.tags.map(v => `<span class="tag">${esc(v)}</span>`).join('')}</div>
      <div class="score">
        <b>${t.score}/100</b>
        <div class="bar"><span style="width:${t.score}%"></span></div>
        <span class="badge ${t.score < 40 ? 'low' : ''}">${level(t.score)}</span>
      </div>
      <footer>
        <span class="count">Откликов: ${offers.filter(o => o.task === t.id).length}</span>
        <button onclick="go('task-${t.id}')">Открыть задачу ↗</button>
      </footer>
    </article>
  `).join('') || '<div class="panel empty">Ничего не найдено. Измените фильтры.</div>';
}

// ==== Детали задачи ====
function detail(id) {
  let t = tasks.find(t => t.id === id);
  if (!t || !t.published) { go('catalog'); return; }
  current = id;

  $('#app').innerHTML = `
    <button class="quiet back" onclick="go('catalog')">← Каталог</button>
    <div class="top">
      <div>
        <div class="eyebrow">${esc(t.company)} · ${esc(t.topic)}</div>
        <h1>${esc(t.title)}</h1>
      </div>
      <button class="primary" onclick="apply(${id})">Откликнуться</button>
    </div>
    <div class="two">
      <div class="stack">
        <section class="panel">
          <h2>Постановка задачи</h2>
          ${names.map((n, i) => `
            <div class="detailrow">
              <b>${n}</b>
              <p class="${!t.fields[i] ? 'muted' : ''}">${esc(t.fields[i] || 'Бизнес ещё не уточнил это поле')}</p>
            </div>
          `).join('')}
        </section>
        <section class="panel">
          <h2>Кто откликнулся</h2>
          <p class="muted small">Публичные профили участников. Документы и контакты здесь не отображаются.</p>
          ${offers.filter(o => o.task === id).map(o => `
            <div class="profile">
              <div class="company">
                <span class="avatar">${esc(o.name[0])}</span>
                <div>
                  <b>${esc(o.name === o.team ? o.team : o.name + ' · ' + o.team)}</b>
                  <p>${esc(o.university)} · ${esc(o.skills)}</p>
                  <span class="badge">Демонстрационный профиль команды</span>
                </div>
              </div>
              <button onclick="profile(${o.id})">Профиль</button>
            </div>
          `).join('') || '<p class="muted">Пока нет откликов. Станьте первым.</p>'}
        </section>
      </div>
      <aside class="stack" style="align-self:start">
        <section class="panel">
          <span class="muted small">Готовность к работе</span>
          <div class="number">${t.score}<span style="font-size:20px;color:#8894a5"> / 100</span></div>
          <p><span class="badge ${t.score < 40 ? 'low' : ''}">${level(t.score)}</span></p>
          ${names.map((n, i) => `
            <div class="score">
              <span style="flex:1">${n}</span>
              <b>${t.parts[i]}/${weights[i]}</b>
            </div>
          `).join('')}
          <div class="hint">
            ${t.score < 100
              ? 'Не все условия определены. Задайте вопросы бизнесу в своём отклике.'
              : 'Постановка заполнена. Оцените свои навыки и предложите план.'}
          </div>
        </section>
        <section class="panel">
          <h3>Вы выбираете проект</h3>
          <p class="muted small">Можно откликаться на задачи разных компаний. Исполнителей выбирает представитель бизнеса.</p>
          ${role === 'business' ? '<button onclick="go(\'cabinet\')">Управлять откликами</button>' : ''}
        </section>
      </aside>
    </div>
  `;
}

function profile(id) {
  const o = offers.find(x => x.id === id);
  open(`
    <h2>${esc(o.name)}</h2>
    <p>${esc(o.university)} · ${esc(o.team)}</p>
    <span class="badge">Демонстрационный профиль команды</span>
    <h3>Навыки</h3>
    <p>${esc(o.skills)}</p>
    <p class="muted small">Публичный профиль. Проверка документов в этом MVP имитируется.</p>
  `);
}

// ==== Отклик ====
function apply(id) {
  if (role === 'guest' || role === 'business' || role === 'moderator') {
    auth('student', id); return;
  }
  if (role === 'pending') {
    go('cabinet');
    toast('Для отклика нужно подтвердить статус студента');
    return;
  }
  if (offers.some(o => o.task === id && o.mine)) {
    toast('Вы уже отправили отклик на эту задачу');
    return;
  }
  open(`
    <h2>Предложить решение</h2>
    <p class="muted">${esc(tasks.find(t => t.id === id).title)}</p>
    <form onsubmit="submitOffer(event,${id})">
      <label>Идея решения
        <textarea name="idea" required minlength="10" placeholder="Что предлагаете сделать?"></textarea>
      </label>
      <label>План работы
        <textarea name="plan" required placeholder="Основные шаги"></textarea>
      </label>
      <div class="formgrid">
        <label>Срок<input name="days" required placeholder="Например, 3 дня"></label>
        <label>Команда<input name="team" placeholder="Или работаю самостоятельно"></label>
      </div>
      <label>Ссылка на прототип
        <input name="link" type="url" required placeholder="https://...">
      </label>
      <label class="checkline">
        <input type="checkbox" required>
        Согласен показать мой публичный профиль в списке откликнувшихся.
      </label>
      <button class="primary">Отправить отклик</button>
    </form>
  `);
}

function submitOffer(e, id) {
  e.preventDefault();
  if (role !== 'student') { toast('Выберите подтверждённого студента в демонстрации'); return; }
  try {
    const d = Object.fromEntries(new FormData(e.target));
    if (offers.some(o => o.task === id && o.mine)) throw new Error('Ваш отклик уже отправлен.');
    model.submit(id, d, user);
    syncData();
    closeModal(); go('task-' + id);
    toast('Отклик сохранён. Решение принимает бизнес.');
  } catch (error) { toast(error.message); }
}

// ==== Auth ====
function auth(type = 'student', next = null) {
  if (role !== 'guest' && arguments.length === 0) {
    open(`
      <h2>Ваш профиль</h2>
      <p>${role === 'business' ? 'Бизнес · Демо' : esc(user.name)}</p>
      <div class="actions">
        <button onclick="closeModal();go('cabinet')">Открыть кабинет</button>
        <button onclick="closeModal();setRole('guest');go('catalog')">Выйти</button>
      </div>
    `);
    return;
  }
  open(`
    <h2>${next ? 'Войдите как студент' : 'Присоединиться к Alem'}</h2>
    <p class="muted">${next ? 'Откликаться могут подтверждённые студенты. Бизнес может просматривать задачи и участников.' : 'Выберите, как вы будете участвовать в проектах.'}</p>
    <div class="tabs">
      <button class="${type === 'student' ? 'primary' : ''}" onclick="auth('student',${next})">Я студент</button>
      <button class="${type === 'business' ? 'primary' : ''}" onclick="auth('business',${next})">Я бизнес</button>
    </div>
    <form onsubmit="register(event,'${type}')">
      <div class="formgrid">
        <label>Имя<input name="first" required autocomplete="given-name"></label>
        <label>Фамилия<input name="last" required autocomplete="family-name"></label>
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Телефон<input name="phone" type="tel" required placeholder="+7 7xx xxx xx xx" pattern="[+0-9 ()-]{10,20}"></label>
        <label class="span2">${type === 'student' ? 'Вуз или колледж' : 'Название компании'}<input name="org" required></label>
        ${type === 'student' ? '<label class="span2">Навыки<input name="skills" placeholder="Python, дизайн, аналитика"></label>' : ''}
      </div>
      <div class="notice">Макет: вводите только вымышленные данные. Email и SMS не отправляются, аккаунт на сервере не создаётся.</div>
      <label class="checkline">
        <input type="checkbox" required>
        Я понимаю, что это демонстрационный режим.
      </label>
      <button class="primary">${type === 'student' ? 'Продолжить к проверке' : 'Открыть кабинет бизнеса'}</button>
    </form>
    <hr style="border:0;border-top:1px solid #dde4ee;margin:22px 0">
    <p class="small muted">Уже есть аккаунт? Для просмотра макета:</p>
    <button onclick="closeModal();setRole('${type}');${next && type === 'student' ? `go('task-${next}')` : `go('cabinet')`}">Войти в тестовый аккаунт</button>
  `);
}

function register(e, type) {
  e.preventDefault();
  let d = Object.fromEntries(new FormData(e.target));
  user = { name: d.first + ' ' + d.last, university: d.org, skills: d.skills || 'Навыки не указаны' };
  verification = 'none';
  closeModal();
  setRole(type === 'student' ? 'pending' : 'business');
  go('cabinet');
  toast('Демонстрационный профиль создан');
}

// ==== Бизнесы ====
function businesses() {
  $('#app').innerHTML = `
    <div class="top">
      <div class="eyebrow">ОТКРЫТОЕ СООБЩЕСТВО</div>
    </div>
    <h1>Бизнесы на платформе</h1>
    <p class="muted">Изучайте задачи компаний и публичные профили участников.</p>
    <div class="cards">
      ${tasks.filter(t => t.published).map(t => `
        <article class="card">
          <div class="company">
            <span class="avatar">${esc(t.mark)}</span>
            <h3>${esc(t.company)}</h3>
          </div>
          <p>${esc(t.topic)}</p>
          <h3>${esc(t.title)}</h3>
          <div class="actions">
            <button onclick="go('task-${t.id}')">Задача и участники</button>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

// ==== Кабинет ====
function cabinet() {
  if (role === 'guest') {
    auth();
    $('#app').innerHTML = '<div class="panel empty"><h2>Личный кабинет</h2><p>Войдите, чтобы управлять профилем и откликами.</p><button onclick="auth()">Войти</button></div>';
    return;
  }
  if (role === 'moderator') { moderator(); return; }
  if (role === 'business') { businessCabinet(); return; }

  $('#app').innerHTML = `
    <div class="top">
      <div>
        <div class="eyebrow">КАБИНЕТ СТУДЕНТА</div>
        <h1>${esc(user.name)}</h1>
        <p class="muted">${esc(user.university)} · ${esc(user.skills)}</p>
      </div>
      <button onclick="go('catalog')">Найти задачу</button>
    </div>
    <div class="two">
      <section class="panel">
        <h2>Мои отклики</h2>
        ${offers.filter(o => o.mine).map(o => `
          <div class="detailrow">
            <b>${esc(tasks.find(t => t.id === o.task).title)}</b>
            <p class="status">${esc(o.status)}</p>
            <button onclick="go('task-${o.task}')">Открыть задачу</button>
          </div>
        `).join('') || '<div class="empty">Пока нет откликов. Выберите задачу из каталога.</div>'}
      </section>
      <aside class="panel">
        <h2>Статус студента</h2>
        ${role === 'student'
          ? '<div class="success">Подтверждён · учебный период 2026/27</div><p class="muted small">Повторная проверка в следующем учебном году.</p>'
          : verification === 'pending'
            ? '<div class="notice">На проверке</div><p>Документ отправлен на демонстрационную проверку. Решение можно посмотреть в роли модератора.</p>'
            : verification === 'rejected'
              ? '<div class="notice">Нужно исправить: не виден текущий учебный период. Добавьте актуальную справку или подтверждение вуза.</div>'
              : '<p>Чтобы отправлять отклики, подтвердите, что вы учитесь.</p>'}
        ${role !== 'student' && verification !== 'pending'
          ? '<button class="primary" onclick="verifyForm()">Подтвердить статус</button>'
          : ''}
        <p class="small muted">Документ не виден бизнесам или другим студентам. В публичном профиле отображается только результат проверки.</p>
      </aside>
    </div>
  `;
}

// ==== Верификация ====
function verifyForm() {
  open(`
    <h2>Подтверждение студента</h2>
    <p class="muted">Выберите удобный способ. В этом макете решение принимает тестовый модератор.</p>
    <form onsubmit="sendVerification(event)">
      <label>Способ проверки
        <select name="method" onchange="$('#docbox').hidden=this.value==='Подтверждение вузом'">
          <option>Студенческий билет или справка</option>
          <option>Подтверждение вузом</option>
        </select>
      </label>
      <div id="docbox">
        <label>Тестовый документ<input name="doc" type="file" accept=".pdf,.png,.jpg,.jpeg"></label>
        <p class="small muted">PDF, JPG или PNG, до 5 МБ. Не загружайте настоящий документ: файл остаётся в браузере, на сервер не передаётся.</p>
      </div>
      <label>Вуз или колледж<input name="university" value="${esc(user.university)}" required></label>
      <label>Учебный период<input required placeholder="2026/27"></label>
      <label class="checkline">
        <input type="checkbox" required>
        Я использую тестовые данные и понимаю условия демонстрации.
      </label>
      <button class="primary">Отправить на проверку</button>
    </form>
    <p class="small muted">Для реального запуска: проверка подлинности и текущего статуса, срок действия подтверждения, закрытое хранение документов и удаление после установленного срока.</p>
  `);
}

function sendVerification(e) {
  e.preventDefault();
  const f = e.target.doc.files[0];
  const m = e.target.elements['method'].value;
  if (m !== 'Подтверждение вузом' && !f) { toast('Выберите тестовый файл'); return; }
  if (f && (f.size > 5 * 1024 * 1024 || !(/\.(pdf|png|jpe?g)$/i.test(f.name)))) {
    toast('Нужен PDF, JPG или PNG до 5 МБ'); return;
  }
  verification = 'pending';
  verificationMethod = m;
  user.university = e.target.university.value;
  closeModal();
  cabinet();
  toast('Заявка создана в памяти макета');
}

// ==== Модератор ====
function moderator() {
  $('#app').innerHTML = `
    <div class="eyebrow">ДЕМОНСТРАЦИЯ ПРОВЕРКИ</div>
    <h1>Проверка статуса студента</h1>
    <p class="muted">В рабочем сервисе этот раздел доступен только уполномоченным сотрудникам.</p>
    <section class="panel">
      <h2>${esc(user.name)}</h2>
      <p>${esc(user.university)} · ${esc(verificationMethod)}</p>
      <p>Статус: <b>${
        verification === 'pending' ? 'На проверке' :
        verification === 'approved' ? 'Подтверждён' :
        verification === 'rejected' ? 'Нужно исправить' :
        'Заявка не подана'
      }</b></p>
      <div class="notice">Тестовое решение не означает проверку через государственную систему. Файлы и персональные данные на сервер не отправляются.</div>
      ${verification === 'pending' ? `
        <div class="actions">
          <button class="primary" onclick="verification='approved';toast('Статус подтверждён в макете');moderator()">Подтвердить</button>
          <button onclick="verification='rejected';moderator()">Вернуть: не виден учебный период</button>
        </div>
      ` : ''}
      <div class="actions">
        <button onclick="setRole(verification==='approved'?'student':'pending');go('cabinet')">Посмотреть результат как студент</button>
      </div>
    </section>
  `;
}

// ==== Кабинет бизнеса ====
function businessCabinet() {
  syncData();
  const own = tasks;

  $('#app').innerHTML = `
    <div class="top">
      <div>
        <div class="eyebrow">КАБИНЕТ БИЗНЕСА · ДЕМОНСТРАЦИЯ</div>
        <h1>Задачи и предложения</h1>
        <p class="muted">Вы решаете, с кем продолжить работу. В демонстрации доступны все учебные задачи.</p>
      </div>
      <button class="primary" onclick="go('editor')">+ Создать задачу</button>
    </div>
    <div class="stack">
      ${own.map(t => `
        <section class="panel">
          <div class="top">
            <div>
              <h2>${esc(t.title)}</h2>
              <span class="badge">${t.score}/100 · ${level(t.score)}</span>
              <span class="muted small">${t.published ? 'Опубликована' : 'Не опубликована'}${t.hasDraft ? ' · Есть неподтверждённые правки' : ''}</span>
            </div>
            <button onclick="editor(${t.id})">Дополнить задачу</button>
          </div>
          ${offers.filter(o => o.task === t.id).map(o => `
            <div class="detailrow">
              <h3>${esc(o.name === o.team ? o.team : o.name + ' · ' + o.team)}</h3>
              <p>${esc(o.idea)}</p>
              <p class="small muted">${esc(o.plan)} · ${esc(o.days)}</p>
              <p class="small">${o.isDemoLink ? 'Демонстрационная ссылка-заглушка' : 'Прототип'}: <a href="${esc(o.link)}" target="_blank" rel="noopener noreferrer">${esc(o.link)}</a></p>
              <p class="status">${esc(o.status)}</p>
              <div class="actions">
                ${o.completedAt ? `<span class="success">Выполнено · ${esc(new Date(o.completedAt).toLocaleDateString('ru'))}</span>` : `
                  <button class="primary" onclick="decision(${o.id},'Выбран')">Выбрать</button>
                  <button onclick="decision(${o.id},'Отклонён')">Отклонить</button>
                  ${o.status === 'Выбран' ? `<button onclick="progress(${o.id})">Отметить как выполнено</button>` : ''}
                `}
              </div>
            </div>
          `).join('') || '<p class="muted">Откликов пока нет.</p>'}
        </section>
      `).join('')}
    </div>
  `;
}

function decision(id, status) {
  if (role !== 'business') return;
  try { model.decide(id, status === 'Выбран' ? 'accepted' : 'rejected'); businessCabinet(); toast('Решение сохранено'); }
  catch (error) { toast(error.message); }
}

function progress(id) {
  if (role !== 'business') return;
  try { model.complete(id); businessCabinet(); toast('Выполнение подтверждено. Баллы за этапы не начисляются.'); }
  catch (error) { toast(error.message); }
}

// ==== Редактор: поля, AI и подтверждение из модуля участника 3 ====
function fieldControl(key, fields) {
  const def = FIELD_DEFS.find(f => f.key === key);
  return `<label>${esc(def.label)}<textarea name="${key}" maxlength="4000" oninput="editorChanged()">${esc(fields[key] || '')}</textarea></label>`;
}

function editor(id = null) {
  if (role !== 'business') { auth('business'); return; }
  syncData();
  const t = id === null ? null : tasks.find(t => t.id === id);
  if (id !== null && !t) { toast('Задача не найдена'); return; }
  editorId = id; editorRevision++; aiRun++; lastQuestions = []; aiCandidate = null;
  const fields = t?.draftFields || emptyFields();
  $('#app').innerHTML = `
    <button class="back" onclick="go('cabinet')">← Мои задачи</button>
    <div class="top">
      <div><div class="eyebrow">КОНСТРУКТОР БИЗНЕС-ЗАДАЧИ</div><h1>${t ? 'Дополните постановку' : 'Создайте задачу'}</h1></div>
      <div><div class="small muted">Предварительный рейтинг</div><span class="number" id="liveScore">0</span><span class="muted"> / 100</span></div>
    </div>
    <form id="editorform" onsubmit="saveTask(event)">
      <div class="two">
        <div class="stack">
          <section class="panel">
            <h2>Исходный запрос</h2>
            <label>Опишите задачу своими словами<textarea name="rawText" maxlength="12000" oninput="editorChanged()" placeholder="Что происходит сейчас и какую помощь вы ищете?">${esc(t?.rawText || '')}</textarea></label>
            ${!t ? `<div class="actions"><button type="button" onclick="loadExample(0)">Пример К1</button><button type="button" onclick="loadExample(3)">Пример К4</button></div>` : ''}
          </section>
          <section class="panel">
            <h2>Карточка задачи</h2>
            <label>Название<input name="title" minlength="3" maxlength="160" required value="${esc(fields.title)}" oninput="editorChanged()"></label>
            <label>Направление<input name="topic" maxlength="160" value="${esc(fields.topic)}" oninput="editorChanged()" placeholder="Например, Логистика"></label>
            ${RULES.map(r => `<div class="detailrow"><h3>${esc(r.label)}</h3>${[...new Set(r.parts.flatMap(p => p[2]))].map(key => fieldControl(key, fields)).join('')}</div>`).join('')}
          </section>
        </div>
        <aside class="stack editor-aside">
          <section class="panel">
            <h2>Помощник</h2>
            <label>Режим<select id="aiMode" onchange="invalidateAI()"><option value="demo">Демо — без модели</option><option value="openai">OpenAI — облачная модель</option><option value="ollama">Ollama — локальная модель</option></select></label>
            <p class="small muted">OpenAI использует API-ключ, настроенный на сервере, и кредиты вашего проекта. Отправка запроса передаст описание и заполненные поля в OpenAI. Демо работает без модели.</p>
            <button id="askAI" onclick="questions()" type="button">Разобрать запрос и задать вопросы</button>
            <div id="aiStatus" class="small muted" role="status"></div>
            <div id="questions"></div>
            <div id="aiCandidate"></div>
            ${(t?.sourceRef === 'К1' || !t) ? `<details class="example-answers"><summary>Ответы заказчика для примера К1</summary><p class="small muted">Учебные ответы из материалов участника 1.</p>${K1_ANSWERS.map((a, i) => `<button type="button" onclick="applyK1Answer(${i})">Ответ ${i + 1}</button>`).join('')}</details>` : ''}
          </section>
          <section class="panel">
            <h2>Рейтинг за содержание</h2>
            <p class="small muted">0 — пусто или менее 10 символов; половина веса с округлением вверх — общее описание; полный вес — распознаны число, роль, источник, срок или контакт. Проверьте смысл сведений самостоятельно.</p>
            <p>Подтверждённый рейтинг: <b id="confirmedScore">${t?.score || 0}/100</b></p>
            <div id="scoreDetails"></div>
            <label class="checkline"><input name="confirmed" type="checkbox" required>Я проверил поля и подтверждаю сведения.</label>
            ${t?.published ? '<p class="hint">Задача опубликована. Подтверждение обновит карточку и рейтинг в каталоге.</p>' : '<label class="checkline"><input name="publish" type="checkbox">Опубликовать в общем каталоге</label>'}
            <div class="actions"><button type="button" onclick="saveDraft()">Сохранить черновик</button><button class="primary">Подтвердить и сохранить</button></div>
            <p class="small muted">Черновик не меняет опубликованную карточку. Публиковать и откликаться можно при любом рейтинге.</p>
          </section>
        </aside>
      </div>
    </form>`;
  calcEditor();
}

function readEditor() {
  const form = $('#editorform');
  return Object.fromEntries(FIELD_KEYS.map(k => [k, form.elements[k].value]));
}
function invalidateAI() {
  aiRun++; aiCandidate = null;
  if ($('#aiCandidate')) $('#aiCandidate').replaceChildren();
  if ($('#askAI')) { $('#askAI').disabled = false; $('#askAI').textContent = 'Разобрать запрос и задать вопросы'; }
  if ($('#aiStatus')) $('#aiStatus').textContent = '';
}
function editorChanged() {
  editorRevision++; invalidateAI();
  $('#editorform').elements.confirmed.checked = false;
  calcEditor();
}
function calcEditor() {
  const rating = previewRating(readEditor());
  $('#liveScore').textContent = rating.score;
  $('#scoreDetails').innerHTML = rating.breakdown.map(r => `<details class="rating-detail"><summary>${esc(r.label)} <b>${r.points}/${r.max}</b></summary>${r.parts.map(p => `<p class="small">${esc(FIELD_DEFS.find(f => f.key === p.field).label)}: ${p.points}/${p.max}. ${esc(p.reason)}</p>`).join('')}</details>`).join('');
  return rating;
}
function loadExample(index) {
  const form = $('#editorform');
  const fields = { ...emptyFields(), ...PARTICIPANT_CARDS[index] };
  for (const key of FIELD_KEYS) form.elements[key].value = fields[key];
  form.elements.rawText.value = SEED_DRAFTS[index].text;
  editorChanged(); toast('Пример загружен в форму. Сохраните и подтвердите его вручную.');
}
function applyK1Answer(index) {
  const form = $('#editorform');
  if (form.elements.title.value !== PARTICIPANT_CARDS[0].title) { toast('Эти ответы относятся к примеру К1. Сначала откройте К1.'); return; }
  for (const [key, value] of Object.entries(k1AnswerPatch(index))) form.elements[key].value = value;
  editorChanged(); toast('Ответ заказчика внесён. Проверьте и подтвердите изменения.');
}

async function questions() {
  const form = $('#editorform');
  const revision = editorRevision, run = ++aiRun;
  const answers = Object.fromEntries(Object.entries(readEditor()).filter(([, value]) => value.trim()));
  const button = $('#askAI');
  button.disabled = true; button.textContent = 'Обработка…';
  $('#aiStatus').textContent = 'Подготавливаем вопросы…';
  try {
    const result = await analyzeDraft({ text: form.elements.rawText.value, answers, mode: $('#aiMode').value });
    if (run !== aiRun || revision !== editorRevision || $('#editorform') !== form) return;
    aiCandidate = result.card; lastQuestions = result.questions;
    $('#aiStatus').textContent = result.warning;
    $('#questions').innerHTML = lastQuestions.map((q, i) => `<label class="step small">${esc(q.question)}<textarea id="answer${i}" maxlength="${['title','topic'].includes(q.field) ? 160 : 4000}" placeholder="Ваш ответ" oninput="invalidateCandidateOnly()"></textarea></label>`).join('') + '<button type="button" onclick="applyAnswers()">Перенести заполненные ответы в карточку</button>';
    const additions = FIELD_KEYS.filter(k => !answers[k] && result.card[k]);
    $('#aiCandidate').innerHTML = additions.length ? `<details open><summary>Предложенные сведения</summary>${additions.map(k => `<p class="small"><b>${esc(FIELD_DEFS.find(f => f.key === k).label)}:</b> ${esc(result.card[k])}</p>`).join('')}<button type="button" onclick="applyAICard()">Перенести предложения в карточку</button></details>` : '';
  } catch (error) {
    if (run === aiRun && $('#editorform') === form) { $('#aiStatus').textContent = error.message; toast(error.message); }
  } finally {
    if (run === aiRun && $('#editorform') === form) { button.disabled = false; button.textContent = 'Разобрать запрос и задать вопросы'; }
  }
}
function invalidateCandidateOnly() { $('#editorform').elements.confirmed.checked = false; }
function applyAnswers() {
  const form = $('#editorform'); let count = 0;
  for (const [i, q] of lastQuestions.entries()) {
    const value = $('#answer' + i)?.value.trim();
    if (value) { form.elements[q.field].value = value; count++; }
  }
  if (count) { editorChanged(); toast('Ответы перенесены. Рейтинг предварительный до подтверждения.'); }
  else toast('Сначала заполните хотя бы один ответ.');
}
function applyAICard() {
  if (!aiCandidate) return;
  const form = $('#editorform');
  for (const key of FIELD_KEYS) if (!form.elements[key].value.trim() && aiCandidate[key]) form.elements[key].value = aiCandidate[key];
  editorChanged(); toast('Предложения внесены в форму. Проверьте их перед подтверждением.');
}
function persistEditor(confirm) {
  if (role !== 'business') return;
  const form = $('#editorform');
  try {
    if (confirm && !form.elements.confirmed.checked) throw new Error('Подтвердите сведения в карточке.');
    const task = model.save(editorId, readEditor(), form.elements.rawText.value, { confirm, publish: confirm && Boolean(form.elements.publish?.checked) });
    syncData(); editor(task.id);
    toast(confirm ? 'Сведения подтверждены. Рейтинг и опубликованная карточка обновлены.' : 'Черновик сохранён. Подтверждённая карточка не изменена.');
  } catch (error) { toast(error.message); }
}
function saveDraft() { persistEditor(false); }
function saveTask(event) { event.preventDefault(); persistEditor(true); }

// ==== Старт ====
window.addEventListener('storage', event => {
  if (event.key === model.store.key) toast('Данные изменились в другой вкладке. Сохраните свой ввод и обновите страницу.');
});
render();
