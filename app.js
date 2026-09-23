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

// ==== Данные ====
let tasks = [
  { id: 1, company: 'Qadam Support', mark: 'Q', title: 'Ускорить обработку заявок поддержки', topic: 'Автоматизация', desc: 'Заявки обрабатываются вручную и долго. Помогите уточнить задачу и предложить решение.', tags: ['Python', 'NLP'], score: 10, parts: [10, 0, 0, 0, 0, 0, 0], fields: ['Заявки обрабатываются вручную, долго.', '', '', '', '', '', ''], published: true },
  { id: 2, company: 'Route KZ', mark: 'R', title: 'Собрать удобные маршруты для курьеров', topic: 'Логистика', desc: 'Диспетчеры ищут способ сократить время доставки. Есть CSV с заказами за три месяца.', tags: ['Алгоритмы', 'React'], score: 65, parts: [15, 15, 10, 5, 10, 5, 5], fields: ['Курьеры теряют время на маршрутах; нужно сократить время доставки.', 'CSV заказов за 3 месяца; доступ нужно уточнить.', 'Оптимизатор порядка остановок.', 'Среднее время маршрута; порог не указан.', '5 дней, без платных картографических API.', 'Диспетчеры.', 'Координатор логистики; формат встреч нужно уточнить.'], published: true },
  { id: 3, company: 'HireLab', mark: 'H', title: 'Извлекать профессиональные навыки из резюме', topic: 'HR', desc: 'Помогите HR быстро находить навыки в учебной базе резюме. Финальное решение принимает человек.', tags: ['Python', 'Парсинг'], score: 85, parts: [20, 20, 15, 10, 10, 5, 5], fields: ['Ручная проверка занимает день в неделю; нужно ускорить поиск навыков.', '400 синтетических PDF, локальная папка.', 'Прототип извлечения навыков, код и CSV.', 'Точность не ниже 85%; выборка не определена.', '4 дня, без чувствительных признаков.', 'HR-специалисты.', 'HR-координатор; срок ответа не указан.'], published: true },
  { id: 4, company: 'QazPack', mark: 'P', title: 'Находить дефекты упаковки по фотографии', topic: 'Производство', desc: 'Готовая постановка для команды с навыками компьютерного зрения. Без обучения собственной модели.', tags: ['OpenCV', 'Computer Vision'], score: 100, parts: [20, 20, 15, 15, 10, 10, 10], fields: ['Ручной контроль; брак вырос с 2% до 6%. Нужна автоматическая отметка дефектов.', '2000 размеченных JPG и регламент ОТК, локальный доступ.', 'Прототип с пояснением дефекта, код и инструкция.', '14 правильных классификаций из 20 отложенных фото по разметке ОТК.', '5 часов, без обучения или дообучения.', 'Операторы ОТК загружают фото и проверяют результат.', 'Начальник ОТК, qa@example.com; видеоконсультации по запросу, ответ за день.'], published: true },
  { id: 5, company: 'Sana Market', mark: 'S', title: 'Сделать рассылки полезнее для клиентов', topic: 'Маркетинг', desc: 'Одинаковые письма получают мало ответов. Бизнес открыт к предложениям и уточнениям.', tags: ['Аналитика', 'Маркетинг'], score: 45, parts: [10, 10, 5, 5, 5, 5, 5], fields: ['Одинаковые письма всем, низкий отклик.', 'CRM в CSV; объём и доступ не указаны.', 'Прототип; функции нужно уточнить.', 'Доля ответов; порог не указан.', '4 дня.', 'Маркетологи.', 'Руководитель маркетинга; порядок связи не указан.'], published: true }
];

let offers = [
  { id: 1, task: 1, name: 'Данияр К.', team: 'ByteForge', university: 'КБТУ', skills: 'Python · NLP', idea: 'Классификатор заявок по теме и приоритету.', plan: 'Примеры → классификация → проверка', days: '3 дня', link: 'https://example.com/demo/byteforge', status: 'Ожидает решения' },
  { id: 2, task: 2, name: 'Айдана М.', team: 'RouteMind', university: 'Satbayev University', skills: 'React · алгоритмы', idea: 'Оптимизация порядка остановок.', plan: 'CSV → алгоритм → список', days: '5 дней', link: 'https://example.com/demo/routemind', status: 'Ожидает решения' },
  { id: 3, task: 3, name: 'Алихан Т.', team: 'HireLens', university: 'КазНУ', skills: 'Python · парсинг', idea: 'Извлечение навыков для ручного решения HR.', plan: 'PDF → навыки → CSV', days: '4 дня', link: 'https://example.com/demo/hirelens', status: 'Ожидает решения' },
  { id: 4, task: 4, name: 'Мадина А.', team: 'VisionQA', university: 'Astana IT University', skills: 'OpenCV', idea: 'Готовая модель без обучения.', plan: 'Модель → загрузка → 20 фото', days: '5 часов', link: 'https://example.com/demo/visionqa', status: 'Ожидает решения' },
  { id: 5, task: 5, name: 'Ерасыл Н.', team: 'ReachAI', university: 'SDU', skills: 'Аналитика', idea: 'Уточнить цель и предложить сегментацию.', plan: 'Цель → данные → прототип', days: '4 дня', link: 'https://example.com/demo/reachai', status: 'Ожидает решения' }
];

// ==== Утилиты ====
const level = n => n < 40 ? 'Черновик' : n < 70 ? 'Рабочая' : n < 90 ? 'Готовая' : 'Приоритетная';

function toast(s) {
  $('#toast').textContent = s;
  $('#toast').hidden = false;
  setTimeout(() => $('#toast').hidden = true, 4000);
}

function open(html) {
  $('#modal').innerHTML = '<button class="close" aria-label="Закрыть" onclick="closeModal()">×</button>' + html;
  if (!$('#modal').open) $('#modal').showModal();
}

function closeModal() { $('#modal').close(); }
function go(v) { location.hash = v; render(); }
function setRole(r) { role = r; $('#role').value = r; render(); }

$('#role').onchange = e => setRole(e.target.value);
window.onhashchange = render;

// ==== Роутер ====
function render() {
  const route = location.hash.slice(1) || 'catalog';

  $('#nav').innerHTML = [
    ['catalog', 'Каталог задач'],
    ['businesses', 'Бизнесы'],
    ['cabinet', role === 'business' ? 'Мои задачи' : 'Мой кабинет']
  ].map(([id, n]) => `<button class="${route === id ? 'active' : ''}" onclick="go('${id}')">${n}</button>`).join('');

  $('#account').textContent =
    role === 'guest' ? 'Войти / Регистрация' :
    role === 'business' ? 'Qadam · Бизнес' :
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
        <span class="avatar">${t.mark}</span>
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
  if (!t) { go('catalog'); return; }
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
                  <b>${esc(o.name)} · ${esc(o.team)}</b>
                  <p>${esc(o.university)} · ${esc(o.skills)}</p>
                  <span class="badge">Студент подтверждён</span>
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
          ${role === 'business' && id === 1 ? '<button onclick="go(\'cabinet\')">Управлять откликами</button>' : ''}
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
    <span class="badge">Студент подтверждён</span>
    <h3>Навыки</h3>
    <p>${esc(o.skills)}</p>
    <p class="muted small">Публичный профиль. Документ о статусе студента доступен только модератору.</p>
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
  let d = Object.fromEntries(new FormData(e.target));
  if (!/^https?:\/\//i.test(d.link)) {
    toast('Используйте ссылку http или https');
    return;
  }
  offers.push({
    ...d,
    id: Date.now(),
    task: id,
    name: user.name,
    university: user.university,
    skills: user.skills,
    team: d.team || 'Самостоятельно',
    mine: true,
    status: 'Ожидает решения'
  });
  closeModal();
  go('task-' + id);
  toast('Отклик отправлен. Можно выбрать ещё одну задачу.');
}

// ==== Auth ====
function auth(type = 'student', next = null) {
  if (role !== 'guest' && arguments.length === 0) {
    open(`
      <h2>Ваш профиль</h2>
      <p>${role === 'business' ? 'Qadam · Бизнес' : esc(user.name)}</p>
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
      ${tasks.map(t => `
        <article class="card">
          <div class="company">
            <span class="avatar">${t.mark}</span>
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
  const own = tasks.filter(t => t.id === 1 || t.own);

  $('#app').innerHTML = `
    <div class="top">
      <div>
        <div class="eyebrow">КАБИНЕТ БИЗНЕСА · QADAM</div>
        <h1>Задачи и предложения</h1>
        <p class="muted">Вы решаете, с кем продолжить работу.</p>
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
              <span class="muted small">${t.published ? 'Опубликована' : 'Не опубликована'}</span>
            </div>
            <button onclick="editor(${t.id})">Дополнить задачу</button>
          </div>
          ${offers.filter(o => o.task === t.id).map(o => `
            <div class="detailrow">
              <h3>${esc(o.name)} · ${esc(o.team)}</h3>
              <p>${esc(o.idea)}</p>
              <p class="small muted">${esc(o.plan)} · ${esc(o.days)}</p>
              <p class="small">Прототип: <a href="${esc(o.link)}" target="_blank" rel="noopener">${esc(o.link)}</a></p>
              <p class="status">${esc(o.status)}</p>
              <div class="actions">
                <button class="primary" onclick="decision(${o.id},'Выбран')">Выбрать</button>
                <button onclick="decision(${o.id},'Отклонён')">Отклонить</button>
                ${o.status === 'Выбран'
                  ? `<button onclick="progress(${o.id})">${o.progress ? 'Этап подтверждён · +10' : 'Подтвердить тестовый этап'}</button>`
                  : ''}
              </div>
            </div>
          `).join('') || '<p class="muted">Откликов пока нет.</p>'}
        </section>
      `).join('')}
    </div>
  `;
}

function decision(id, s) {
  offers.find(o => o.id === id).status = s;
  businessCabinet();
  toast('Решение сохранено в макете');
}

function progress(id) {
  let o = offers.find(o => o.id === id);
  if (o.progress) { toast('Баллы за этот этап уже начислены'); return; }
  o.progress = true;
  businessCabinet();
  toast('Тестовый этап подтверждён: +10 команде. Рейтинг задачи не изменён.');
}

// ==== Редактор задачи ====
const checks = [
  ['Назван процесс', 'Названа проблема', 'Есть исходная числовая характеристика', 'Указано требуемое изменение'],
  ['Источник', 'Формат', 'Объём', 'Условия доступа'],
  ['Конечный продукт', 'Функция', 'Формат передачи'],
  ['Метрика', 'Порог приёмки', 'Процедура или выборка'],
  ['Срок', 'Техническая граница'],
  ['Группа пользователей', 'Сценарий использования'],
  ['Контакт и канал', 'Консультации и срок ответа']
];

function editor(id = null) {
  if (role !== 'business') { auth('business'); return; }
  let t = tasks.find(t => t.id === id);
  if (t && !t.own && t.id !== 1) { toast('Можно редактировать только свои задачи'); return; }

  $('#app').innerHTML = `
    <button class="back" onclick="go('cabinet')">← Мои задачи</button>
    <div class="top">
      <div>
        <div class="eyebrow">КОНСТРУКТОР БИЗНЕС-ЗАДАЧИ</div>
        <h1>${t ? 'Дополните постановку' : 'Создайте задачу'}</h1>
      </div>
      <div><span class="number" id="liveScore">${t ? t.score : 0}</span><span class="muted"> / 100</span></div>
    </div>
    <form id="editorform" onsubmit="saveTask(event,${id})">
      <div class="two">
        <section class="panel">
          <label>Название<input name="title" required value="${esc(t?.title || '')}"></label>
          <label>Направление
            <select name="topic">
              ${['Автоматизация', 'Логистика', 'HR', 'Производство', 'Маркетинг'].map(n => `<option ${t?.topic === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </label>
          ${names.map((n, i) => `
            <label>${n}<textarea name="f${i}" oninput="calcEditor()">${esc(t?.fields[i] || '')}</textarea></label>
            <div>
              ${checks[i].map((c, j) => `
                <label class="checkline small">
                  <input type="checkbox" name="c${i}_${j}" onchange="calcEditor()" ${t && j < t.parts[i] / 5 ? 'checked' : ''}>
                  ${c} · 5
                </label>
              `).join('')}
            </div>
          `).join('')}
        </section>
        <aside class="stack" style="align-self:start">
          <section class="panel">
            <h2>Помощь с уточнениями</h2>
            <p class="muted small">Демонстрационный локальный помощник. Внешний AI не подключён.</p>
            <button onclick="questions()" type="button">Получить вопросы</button>
            <div id="questions"></div>
          </section>
          <section class="panel">
            <h3>Рейтинг за факты</h3>
            <p class="small muted">Отмечайте только сведения, которые действительно есть в тексте. Каждый подпункт — 5 баллов. После редактирования подтвердите данные.</p>
            <label class="checkline">
              <input name="confirmed" type="checkbox" required>
              Я проверил поля и подтверждаю сведения.
            </label>
            <label class="checkline">
              <input name="publish" type="checkbox" ${t?.published ? 'checked' : ''}>
              Опубликовать в общем каталоге
            </label>
            <button class="primary" style="width:100%;margin-top:20px">Подтвердить и сохранить</button>
            <p class="small muted">Можно публиковать с любым рейтингом. Предварительный балл станет действующим после сохранения.</p>
          </section>
        </aside>
      </div>
    </form>
  `;
  calcEditor();
}

function calcEditor() {
  let f = $('#editorform');
  let sum = 0;
  names.forEach((_, i) => {
    let has = f.elements['f' + i].value.trim();
    checks[i].forEach((_, j) => {
      let c = f.elements[`c${i}_${j}`];
      c.disabled = !has;
      if (!has) c.checked = false;
      if (c.checked) sum += 5;
    });
  });
  $('#liveScore').textContent = sum;
  return sum;
}

function questions() {
  const qs = [
    'Кто будет пользоваться решением и как?',
    'Какие данные доступны: формат, объём, условия доступа?',
    'Как измерить успех и какой порог означает приёмку?',
    'Какой результат передать и в какой срок?',
    'Кто со стороны бизнеса отвечает на вопросы?'
  ];
  $('#questions').innerHTML = qs.map(s => `<div class="step small">${s}</div>`).join('');
}

function saveTask(e, id) {
  e.preventDefault();
  if (role !== 'business') return;
  let f = e.target;
  let fields = names.map((_, i) => f.elements['f' + i].value.trim());
  let parts = checks.map((cs, i) => cs.reduce((s, _, j) => s + (f.elements[`c${i}_${j}`].checked ? 5 : 0), 0));
  let t = tasks.find(t => t.id === id);
  let data = {
    title: f.elements['title'].value,
    topic: f.topic.value,
    fields,
    parts,
    score: parts.reduce((a, b) => a + b, 0),
    published: f.publish.checked,
    desc: fields[0] || 'Бизнес уточняет постановку задачи.'
  };
  if (t) Object.assign(t, data);
  else tasks.push({ ...data, id: Date.now(), company: 'Qadam Support', mark: 'Q', tags: ['Новая задача'], own: true });
  toast('Карточка подтверждена, рейтинг пересчитан');
  go('cabinet');
}

// ==== Старт ====
render();