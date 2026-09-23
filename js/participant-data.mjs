// Participant 1's texts, supplied on 2026-09-23. No stored/forced target scores.
import { SanaStore, memoryStorage } from './store.mjs';
export const DATASET_KEY = 'participant1-2026-09-23-general-scale-v2';
export const SEED_DRAFTS = [
  { ref: 'Ч1', topic: 'Поддержка клиентов', text: 'Заявки в поддержку обрабатываются вручную, долго' },
  { ref: 'Ч2', topic: 'Логистика', text: 'Нужна помощь с последней милей доставки, курьеры теряют время на маршрутах, есть таблица заказов за 3 месяца' },
  { ref: 'Ч3', topic: 'HR', text: 'Хотим ускорить первичный отбор резюме на позицию стажёра-аналитика, сейчас HR тратит на это день в неделю, есть база из 400 резюме в PDF' },
  { ref: 'Ч4', topic: 'Производство', text: 'На линии упаковки растёт процент брака, нужен инструмент, который по фото с камеры отмечает дефектные упаковки, есть архив из 2000 размеченных фото и точные требования ОТК' },
  { ref: 'Ч5', topic: 'Маркетинг', text: 'Рассылки одинаковые для всех клиентов, отклик низкий' },
];
export const PARTICIPANT_CARDS = [
  {
    title: 'Обработка заявок в поддержке', topic: 'Поддержка клиентов',
    context: 'Три оператора поддержки вручную сортируют заявки из единого email-ящика, приходит около 80 писем в день',
    constraints: 'Нужно ускорить процесс, точных сроков нет', users: 'Операторы поддержки',
    contact: 'Можно уточнить детали у руководителя поддержки при необходимости',
  },
  {
    title: 'Оптимизация маршрутов последней мили', topic: 'Логистика',
    context: 'Курьеры теряют время на маршрутах, среднее время доставки выросло на 18% за полгода',
    need: 'Нужен алгоритм, пересчитывающий маршруты курьеров с учётом загрузки дорог в реальном времени',
    data_description: 'Таблица заказов за 3 месяца (адрес, время доставки, курьер), координаты складов, часы пик по районам',
    expected_result: 'Снижение среднего времени доставки минимум на 20% на тестовой выборке маршрутов',
    users: 'Курьеры компании',
  },
  {
    title: 'Первичный отбор резюме стажёров', topic: 'HR',
    context: 'HR тратит день в неделю на просмотр резюме вручную, более 400 заявок на последний набор',
    need: 'Нужен инструмент, сортирующий резюме по соответствию требованиям вакансии стажёра-аналитика',
    data_description: 'База из 400 резюме в PDF за прошлый набор, текст вакансии с обязательными и желательными навыками',
    expected_result: 'Список топ-20 кандидатов с оценкой соответствия по каждому',
    constraints: 'Нужен к защите, без доступа к внешним ATS-системам, только локальный файл базы',
    users: 'HR-менеджер, проводящий первичный отбор',
    contact: 'HR-менеджер, консультации в чате, обратная связь в течение дня',
  },
  {
    title: 'Автодетекция брака на упаковке', topic: 'Производство',
    context: 'доля брака на линии упаковки выросла с 2% до 6% за квартал, контроль сейчас — визуальный, вручную.',
    need: 'автоматически отмечать дефектную упаковку по фото с конвейерной камеры.',
    users: 'операторы ОТК на линии упаковки.',
    data_description: 'архив 2000 размеченных фото, регламент ОТК с критериями брака.',
    constraints: 'прототип за 5 часов, без дообучения собственной модели, доступ к архиву — локальный файл.',
    expected_result: 'прототип, отмечающий брак на новом фото с пояснением причины.',
    success_metric: 'прототип верно классифицирует не менее 70% из 20 тестовых фото.',
    contact: 'контакт — начальник ОТК, консультации по видеосвязи по запросу, обратная связь в течение дня.',
  },
  {
    title: 'Персонализация email-рассылок', topic: 'Маркетинг',
    context: 'Все клиенты получают одну рассылку, открываемость упала до 12% за квартал',
    need: 'Нужна персонализация писем под интересы и историю покупок клиента',
    data_description: 'Есть база клиентов с историей заказов, но без готовой сегментации по интересам',
    constraints: 'Желательно запустить в течение месяца, инструмент рассылки уже используется',
    users: 'Клиенты интернет-магазина', contact: 'Маркетолог, можно писать в почту',
  },
];
export const DEMO_CARD = PARTICIPANT_CARDS[3];
export const K1_ANSWERS = [
  { question: 'Кто сейчас занимается заявками?', answer: 'Три оператора поддержки, вручную сортируют по почте', fields: ['context', 'users'] },
  { question: 'Откуда приходят данные/заявки?', answer: 'Единый email-ящик поддержки, ~80 писем в день', fields: ['data_description'] },
  { question: 'Какой прототип нужен?', answer: 'Классификатор, который распределяет заявку по теме и приоритету до передачи оператору', fields: ['need', 'expected_result'] },
  { question: 'Как бизнес проверит пользу?', answer: 'Прогон 20 реальных писем за прошлую неделю — сравнить ручную сортировку и результат прототипа', fields: ['success_metric'] },
];
export function k1AnswerPatch(index) {
  const item = K1_ANSWERS[index];
  if (!item) throw new Error('Неизвестный ответ К1.');
  return Object.fromEntries(item.fields.map(field => [field, item.answer]));
}
export const TEAM_EXAMPLES = [
  { name: 'ByteForge', interests: ['NLP', 'Автоматизация текста'], skills: ['Backend', 'Промпт-инжиниринг'], technologies: ['Python', 'FastAPI', 'OpenAI API'] },
  { name: 'RouteMind', interests: ['Логистика', 'Оптимизация'], skills: ['Алгоритмы', 'Фронтенд'], technologies: ['React', 'Node.js', 'Google Maps API'] },
  { name: 'HireLens', interests: ['HR-tech', 'Анализ документов'], skills: ['Парсинг PDF', 'ML-классификация'], technologies: ['Python', 'spaCy', 'PostgreSQL'] },
  { name: 'VisionQA', interests: ['Компьютерное зрение'], skills: ['CV', 'Обработка изображений'], technologies: ['Python', 'OpenCV', 'PyTorch'] },
  { name: 'ReachAI', interests: ['Маркетинг', 'Персонализация'], skills: ['Сегментация', 'Аналитика'], technologies: ['Python', 'Pandas', 'SendGrid API'] },
];
export const PROPOSAL_EXAMPLES = [
  { idea: 'Чат-бот-классификатор заявок по темам с приоритетом', plan: 'Сбор шаблонов → классификатор → маршрутизация', timeline: '3 дня' },
  { idea: 'Пересчёт маршрутов курьеров по загрузке дорог в реальном времени', plan: 'Импорт данных → алгоритм маршрутизации → карта', timeline: '5 дней' },
  { idea: 'Автоматический скоринг резюме по требованиям вакансии', plan: 'Парсинг PDF → извлечение навыков → ранжирование', timeline: '4 дня' },
  { idea: 'Классификатор брака через сравнение фото с эталонными дефектами на готовом предобученном CV-инструменте, без дообучения собственной модели', plan: 'Разметка эталонных дефектов → сравнение новых фото с эталонами → интерфейс проверки с пояснением причины', timeline: 'Прототип — к защите; 6 дней — на доработку до рабочей версии после хакатона.' },
  { idea: 'Сегментация клиентов и генерация персональных писем', plan: 'Кластеризация базы → шаблоны по сегментам → A/B-тест', timeline: '4 дня' },
];
export function seedDemo(store) {
  if (store.exportData().datasets?.includes(DATASET_KEY)) return { seeded: false, reason: 'Набор первого участника уже добавлен. Ваши правки сохранены.' };
  // Build in memory and append atomically; never erase existing browser data.
  const sample = new SanaStore(memoryStorage());
  const tasks = PARTICIPANT_CARDS.map((card, i) => {
    const task = sample.createTask(SEED_DRAFTS[i].text, card);
    sample.confirmTask(task.id); sample.publishTask(task.id); return task;
  });
  const teams = TEAM_EXAMPLES.map(team => sample.addTeam(team));
  PROPOSAL_EXAMPLES.forEach((proposal, i) => sample.submitProposal({ ...proposal, taskId: tasks[i].id, teamId: teams[i].id, prototypeUrl: `https://example.org/ai-sana/o${i + 1}` }));
  const data = sample.exportData();
  data.tasks.forEach((task, i) => { task.sourceRef = `К${i + 1}`; task.datasetKey = DATASET_KEY; });
  data.teams.forEach((team, i) => { team.sourceRef = `П${i + 1}`; });
  data.proposals.forEach((proposal, i) => { proposal.sourceRef = `О${i + 1}`; proposal.isDemoLink = true; });
  return store.appendDataset(DATASET_KEY, data);
}
