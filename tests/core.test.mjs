import { SanaStore, memoryStorage, STORAGE_KEY, calculateRating, previewRating, assessText, emptyFields, FIELD_KEYS, levelFor, PHONE_PATTERN, analyzeDraft as analyzeActual, validateAIOutput, prepareInput, DEMO_CARD, PARTICIPANT_CARDS, SEED_DRAFTS, K1_ANSWERS, k1AnswerPatch, PROPOSAL_EXAMPLES, seedDemo } from '../js/index.mjs';

// Model-output tests emulate a configured server; health-gating tests call analyzeActual directly.
const analyzeDraft = options => analyzeActual({ ...options, ...(options?.fetchImpl ? {
  fetchImpl: (url, init) => url === '/api/health'
    ? Promise.resolve({ ok: true, json: async () => ({ ok: true, openaiConfigured: true, ollamaConfigured: true }) })
    : options.fetchImpl(url, init)
} : {}) });
const cases = [];
const test = (name, fn) => cases.push({ name, fn });
const equal = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); };
const ok = condition => { if (!condition) throw new Error('Assertion failed'); };
const throws = (fn, code) => { try { fn(); } catch (e) { equal(e.code, code); return; } throw new Error(`Expected ${code}`); };
const rejects = async (fn, code) => { try { await fn(); } catch (e) { equal(e.code, code); return; } throw new Error(`Expected ${code}`); };
const newStore = () => new SanaStore(memoryStorage());
const FULL_CARD = { ...DEMO_CARD, expected_result: 'Прототип для оператора ОТК, отмечающий брак на фото.' };
function fullTask(store) { const task = store.createTask('Нужен прототип для оператора ОТК.', FULL_CARD); store.confirmTask(task.id); return store.getTask(task.id); }
function proposal(store, taskId, teamId) { return store.submitProposal({ taskId, teamId, idea: 'Учебный прототип', plan: 'Собрать и проверить', timeline: '7 дней', prototypeUrl: 'https://example.org/demo' }); }
const validAI = () => ({ card: { ...emptyFields(), need: 'Нужен прототип кафе.' }, questions: [
  { field: 'context', question: 'Как сейчас устроен процесс?' },
  { field: 'data_description', question: 'Какие данные у вас доступны?' },
  { field: 'expected_result', question: 'Какой результат вы ожидаете?' },
] });

test('Пустая карточка: 0 баллов, 8 логических полей', () => { const r = calculateRating(emptyFields()); equal(r.score, 0); equal(r.missing.length, 8); });
test('Неподтверждённая полная карточка: 0 баллов', () => equal(calculateRating(DEMO_CARD).score, 0));
test('Конкретная подтверждённая карточка: 100 баллов, 7 групп и округление по 8 полям', () => { const r = calculateRating(FULL_CARD, FIELD_KEYS); equal(r.score, 100); equal(r.breakdown.map(x => x.max), [20, 20, 15, 15, 10, 10, 10]); equal(r.missing, []); });
test('Контекст и конкретные критерии дают 10 + 8 баллов без цели', () => equal(calculateRating({ context: DEMO_CARD.context, success_metric: DEMO_CARD.success_metric }, ['context', 'success_metric']).score, 18));
test('Заглушки, пробелы и односимвольные значения не дают баллов', () => { for (const text of ['   ', 'не знаю', 'TODO', '???', 'x']) equal(calculateRating({ need: text }, ['need']).score, 0); });
test('Критерий и цель оцениваются вместе, без отдельного округления', () => { equal(previewRating({ success_metric: 'Нужно проверить качество', success_target: 'Очень хорошо' }).score, 8); equal(previewRating({ success_metric: 'Нужно проверить качество', success_target: 'Не менее 70% точности' }).score, 15); });
test('Все границы уровней: 0,39,40,69,70,89,90,100', () => equal([0,39,40,69,70,89,90,100].map(n => levelFor(n).key), ['draft','draft','working','working','ready','ready','priority','priority']));
test('Неверные баллы отклоняются', () => { for (const n of [-1, 101, 1.5, NaN]) throws(() => levelFor(n), 'VALIDATION'); });
test('Неизвестные поля и неправильные типы отклоняются', () => { throws(() => calculateRating({ alien: 'x' }), 'VALIDATION'); throws(() => calculateRating({ need: [] }), 'VALIDATION'); });
test('Правка меняет предварительный балл, подтверждённый остаётся прежним', () => { const s = newStore(), t = fullTask(s); equal(t.rating.score, 100); const changed = s.updateTask(t.id, { users: 'Другие сотрудники' }); equal(changed.rating.score, 100); equal(changed.previewRating.score, 95); ok(changed.confirmedFields.includes('need')); ok(!changed.confirmedFields.includes('users')); equal(s.confirmTask(t.id, ['users']).rating.score, 95); });
test('Повторное сохранение неизменённого поля сохраняет подтверждение', () => { const s = newStore(), t = fullTask(s); equal(s.updateTask(t.id, { need: DEMO_CARD.need }).rating.score, 100); });
test('Подтверждение пустого поля допустимо, неизвестного — нет', () => { const s = newStore(), t = s.createTask('Описание'); equal(s.confirmTask(t.id, ['users']).rating.score, 0); throws(() => s.confirmTask(t.id, ['invalid']), 'VALIDATION'); });
test('Нельзя опубликовать неподтверждённую карточку', () => { const s = newStore(), t = s.createTask('Описание', DEMO_CARD); throws(() => s.publishTask(t.id), 'CONFIRMATION_REQUIRED'); equal(s.catalog().length, 0); });
test('Публикация требует название', () => { const s = newStore(), t = s.createTask('Описание'); throws(() => s.publishTask(t.id), 'VALIDATION'); });
test('Нулевой рейтинг допускает публикацию и отклик', () => { const s = newStore(), t = s.createTask('Описание', { title: 'Слабая задача' }); s.confirmTask(t.id); s.publishTask(t.id); equal(s.catalog()[0].rating.score, 0); const team = s.addTeam({ name: 'Команда' }); equal(proposal(s, t.id, team.id).status, 'pending'); });
test('Подтверждение обновляет опубликованную карточку без повторной публикации', () => { const s = newStore(), t = fullTask(s); s.publishTask(t.id); s.updateTask(t.id, { need: 'Новая потребность' }); equal(s.catalog()[0].fields.need, DEMO_CARD.need); equal(s.catalog()[0].rating.score, 100); throws(() => s.publishTask(t.id), 'CONFIRMATION_REQUIRED'); s.confirmTask(t.id); equal(s.catalog()[0].fields.need, 'Новая потребность'); equal(s.catalog()[0].rating.score, 95); });
test('Черновики без публикации не попадают в каталог', () => { const s = newStore(); fullTask(s); equal(s.catalog(), []); });
test('Каталог первого участника сортируется и фильтруется по новой шкале', () => { const s = newStore(); seedDemo(s); equal(s.catalog().map(t => t.rating.score), [100,70,50,48,30]); equal(s.catalog({ level: 'draft' }).length, 1); equal(s.catalog({ topic: 'логистика' }).length, 1); equal(s.catalog({ query: 'резюме' }).length, 1); });
test('Отклик на неопубликованную задачу отклоняется', () => { const s = newStore(), t = fullTask(s), team = s.addTeam({ name: 'Команда' }); throws(() => proposal(s, t.id, team.id), 'NOT_PUBLISHED'); });
test('Неизвестная команда и задача отклоняются', () => { const s = newStore(), t = fullTask(s); s.publishTask(t.id); throws(() => proposal(s, t.id, 'unknown'), 'NOT_FOUND'); throws(() => s.getTask('unknown'), 'NOT_FOUND'); });
test('Отклики не ограничены; можно выбрать несколько команд вручную', () => { const s = newStore(), t = fullTask(s); s.publishTask(t.id); const a = s.addTeam({ name: 'Команда А' }), b = s.addTeam({ name: 'Команда Б' }); const pa = proposal(s, t.id, a.id), pb = proposal(s, t.id, b.id); equal(s.listProposals(t.id).map(p => p.status), ['pending','pending']); s.decideProposal(pa.id, 'accepted'); s.decideProposal(pb.id, 'accepted'); equal(s.listProposals(t.id).map(p => p.status), ['accepted','accepted']); s.decideProposal(pa.id, 'rejected'); equal(s.listProposals(t.id)[0].status, 'rejected'); });
test('Опасные ссылки и пустые предложения отклоняются', () => { const s = newStore(); throws(() => s.submitProposal({ idea: '', plan: '', timeline: '', prototypeUrl: 'https://example.org' }), 'VALIDATION'); throws(() => s.submitProposal({ idea: 'Идея', plan: 'План', timeline: 'Неделя', prototypeUrl: 'javascript:alert(1)' }), 'VALIDATION'); });
test('Данные сохраняются между экземплярами сервиса', () => { const storage = memoryStorage(), a = new SanaStore(storage); const t = fullTask(a); a.publishTask(t.id); const b = new SanaStore(storage); equal(b.catalog()[0].rating.score, 100); b.updateTask(t.id, { title: 'Обновлённое название' }); equal(a.getTask(t.id).fields.title, 'Обновлённое название'); });
test('Возвращённые объекты не изменяют сохранённое состояние', () => { const s = newStore(), t = fullTask(s); t.fields.title = 'Испорчено'; equal(s.getTask(t.id).fields.title, DEMO_CARD.title); });
test('Повреждённое хранилище не перезаписывается', () => { const storage = memoryStorage(); storage.setItem(STORAGE_KEY, '{bad'); throws(() => new SanaStore(storage), 'STORAGE_CORRUPT'); equal(storage.getItem(STORAGE_KEY), '{bad'); });
test('Несовместимая версия хранилища отклоняется', () => { const storage = memoryStorage(); storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, tasks: [], teams: [], proposals: [], events: [] })); throws(() => new SanaStore(storage), 'STORAGE_CORRUPT'); });
test('Ошибка записи сообщает о несохранении', () => { const s = new SanaStore({ getItem: () => null, setItem: () => { throw new Error('quota'); } }); throws(() => s.createTask('Описание'), 'STORAGE_WRITE'); });
test('Неверная операция не сохраняет частичные изменения', () => { const s = newStore(), t = fullTask(s); const before = s.exportData(); throws(() => s.confirmTask(t.id, ['need','alien']), 'VALIDATION'); equal(s.exportData(), before); });
test('Набор содержит 5 черновиков, карточек, команд и откликов, повторный запуск не дублирует', () => { const s = newStore(); equal(seedDemo(s).seeded, true); equal(s.listTasks().length, 5); equal(s.listTeams().length, 5); equal(s.listProposals().length, 5); equal(seedDemo(s).seeded, false); equal(s.listTasks().length, 5); });
test('Полный сценарий: AI → ответы К1 → публикация → ByteForge → выбор → выполнено', async () => { const s = newStore(); const result = await analyzeDraft({ text: SEED_DRAFTS[0].text }); const t = s.createTask(SEED_DRAFTS[0].text, { ...result.card, title: PARTICIPANT_CARDS[0].title }); equal(t.rating.score, 0); for (let i = 0; i < K1_ANSWERS.length; i++) s.updateTask(t.id, k1AnswerPatch(i)); ok(s.getTask(t.id).previewRating.score >= 40); equal(s.getTask(t.id).rating.score, 0); ok(s.confirmTask(t.id).rating.score >= 40); s.publishTask(t.id); const team = s.addTeam({ name: 'ByteForge' }); const p = proposal(s, t.id, team.id); s.decideProposal(p.id, 'accepted'); ok(s.completeProposal(p.id).completedAt); });

test('Округление половины: 20→10, 15→8, 10→5', () => { for (const [weight, half] of [[20,10],[15,8],[10,5]]) equal(assessText('Нужно улучшить работу', weight).points, half); });
test('Порог 10 символов применяется до проверки конкретности', () => { equal(assessText('123456789', 20).points, 0); equal(assessText('1234567890', 20).points, 0); equal(assessText('абвгдежзий', 20).points, 10); });
test('Одно общее правило для чисел, ролей, источников и сроков', () => { for (const value of ['Операторы поддержки', 'Курьеры компании', 'Таблица заказов', 'Срок — к защите', 'Обратная связь в течение дня', 'Получаем 80 писем в день', 'Маркетолог, можно писать в почту']) { equal(assessText(value, 20).points, 20); ok(assessText(value, 20).evidence); } });
test('Баллы К1–К5 вычисляются из текста и отличаются от прежних ориентиров', () => equal(PARTICIPANT_CARDS.map(c => previewRating(c).score), [30,48,70,100,50]));
test('ID, заголовок и тема не влияют на рейтинг', () => { const card = PARTICIPANT_CARDS[0]; equal(previewRating({ ...card, title: 'Совсем другая карточка', topic: 'Иная тема' }).score, previewRating(card).score); });
test('Общие данные дают 10/20, общее описание результата — 8/15', () => equal(previewRating({ data_description: 'Материалы пока описаны в общих словах', expected_result: 'Хотим получить полезное решение' }).score, 18));
test('Неподтверждённый вспомогательный источник не повышает итог', () => { const fields = { data_description: 'Материалы пока описаны в общих словах', data_source: 'Таблица заказов в CSV' }; equal(calculateRating(fields, ['data_description']).score, 10); equal(previewRating(fields).score, 20); });
test('Подтверждённое удаление уменьшает каталог; сохранение не меняет его', () => { const s = newStore(), t = fullTask(s); s.publishTask(t.id); s.updateTask(t.id, { users: '' }); equal(s.catalog()[0].rating.score, 100); throws(() => s.publishTask(t.id), 'CONFIRMATION_REQUIRED'); s.confirmTask(t.id, ['users']); equal(s.catalog()[0].rating.score, 90); equal(s.catalog()[0].fields.users, ''); });
test('Частичное подтверждение не публикует другие несогласованные правки', () => { const s = newStore(), t = fullTask(s); s.publishTask(t.id); s.updateTask(t.id, { users: 'Другие сотрудники', need: 'Иная потребность' }); s.confirmTask(t.id, ['users']); equal(s.catalog()[0].fields.need, DEMO_CARD.need); equal(s.catalog()[0].rating.score, 95); equal(s.getTask(t.id).previewRating.score, 90); });
test('Подтверждение новой карточки не публикует её автоматически', () => { const s = newStore(); fullTask(s); equal(s.catalog().length, 0); });
test('Нельзя подтвердить удаление названия опубликованной карточки', () => { const s = newStore(), t = fullTask(s); s.publishTask(t.id); s.updateTask(t.id, { title: '' }); throws(() => s.confirmTask(t.id), 'VALIDATION'); equal(s.catalog()[0].fields.title, DEMO_CARD.title); });
test('Старые данные без confirmedCard и completedAt читаются и сохраняют рейтинг до подтверждения', () => { const storage = memoryStorage(), a = new SanaStore(storage), t = fullTask(a); const state = a.exportData(); delete state.tasks[0].confirmedCard; storage.setItem(STORAGE_KEY, JSON.stringify(state)); const b = new SanaStore(storage); b.updateTask(t.id, { users: '' }); equal(b.getTask(t.id).rating.score, 100); equal(b.getTask(t.id).previewRating.score, 90); });
test('Новый набор добавляется без удаления старых задач и без повторов', () => { const s = newStore(), t = fullTask(s); seedDemo(s); equal(s.listTasks().length, 6); equal(s.getTask(t.id).fields.title, DEMO_CARD.title); const k1 = s.listTasks().find(t => t.sourceRef === 'К1'); s.updateTask(k1.id, { title: 'Правка пользователя' }); seedDemo(s); equal(s.listTasks().length, 6); equal(s.getTask(k1.id).fields.title, 'Правка пользователя'); });
test('Отметка выполнения доступна только принятому отклику', () => { const s = newStore(); seedDemo(s); const p = s.listProposals()[0]; throws(() => s.completeProposal(p.id), 'NOT_ACCEPTED'); s.decideProposal(p.id, 'rejected'); throws(() => s.completeProposal(p.id), 'NOT_ACCEPTED'); s.decideProposal(p.id, 'accepted'); ok(s.completeProposal(p.id).completedAt); });
test('Повторное завершение не меняет дату, не создаёт событие и не дублирует баллы', () => { const s = newStore(); seedDemo(s); const p = s.listProposals()[0]; s.decideProposal(p.id, 'accepted'); const completed = s.completeProposal(p.id), count = s.exportData().events.length; equal(s.completeProposal(p.id).completedAt, completed.completedAt); equal(s.exportData().events.length, count); equal(completed.progressPoints, 10); equal(s.teamProgress(completed.teamId), 10); throws(() => s.decideProposal(p.id, 'rejected'), 'ALREADY_COMPLETED'); });
test('Завершение сохраняется после перезагрузки хранилища', () => { const storage = memoryStorage(), s = new SanaStore(storage); seedDemo(s); const p = s.listProposals()[0]; s.decideProposal(p.id, 'accepted'); s.completeProposal(p.id); ok(new SanaStore(storage).listProposals()[0].completedAt); });
test('О4 содержит исправленный подход и различает прототип и дальнейшие 6 дней', () => { const p = PROPOSAL_EXAMPLES[3]; ok(p.idea.includes('без дообучения собственной модели')); ok(p.plan.includes('сравнение новых фото с эталонами')); ok(!p.plan.includes('обучение классификатора')); ok(p.timeline.includes('к защите')); ok(p.timeline.includes('6 дней')); });
test('Демо AI честно обозначено, возвращает ≥3 вопроса и не выдумывает поля', async () => { const r = await analyzeDraft({ text: 'Нужен прототип кафе.' }); equal(r.mode, 'demo'); ok(r.warning.includes('заглушка')); ok(r.questions.length >= 3); equal(r.card.contact, ''); equal(r.card.need, 'Нужен прототип кафе.'); });
test('Демо AI сохраняет ответы без изменений', async () => { const r = await analyzeDraft({ text: 'Описание кафе', answers: { users: 'Администратор кафе' } }); equal(r.card.users, 'Администратор кафе'); });
test('Пустой AI-ввод отклоняется до сетевого запроса', async () => { let called = false; await rejects(() => analyzeDraft({ text: '', mode: 'ollama', fetchImpl: () => { called = true; } }), 'VALIDATION'); equal(called, false); });
test('Структурированный корректный ответ реального AI принимается', async () => { const r = await analyzeDraft({ text: 'Нужен прототип кафе.', mode: 'ollama', fetchImpl: async () => ({ ok: true, json: async () => validAI() }) }); equal(r.mode, 'ollama'); equal(r.card.need, 'Нужен прототип кафе.'); });
test('Выдуманный контакт AI отклоняется', () => { const output = validAI(); output.card.contact = 'fake@example.org'; throws(() => validateAIOutput(output, prepareInput('Нужен прототип кафе.')), 'AI_INVALID'); });
test('Изменение пользовательского ответа моделью отклоняется', () => { const output = validAI(); output.card.users = 'Другая группа'; throws(() => validateAIOutput(output, prepareInput('Нужен прототип кафе.', { users: 'Администратор' })), 'AI_INVALID'); });
test('Неполный ответ, неверный тип, лишние поля и повторы AI отклоняются', () => { for (const output of [null, [], {}, { ...validAI(), score: 100 }, { ...validAI(), questions: [] }, { ...validAI(), questions: Array(3).fill(validAI().questions[0]) }]) throws(() => validateAIOutput(output, prepareInput('Нужен прототип кафе.')), 'AI_INVALID'); });
test('Невалидный JSON от AI возвращает понятную ошибку', async () => { await rejects(() => analyzeDraft({ text: 'Описание', mode: 'ollama', fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }) }), 'AI_INVALID'); });
test('Недоступная модель не подменяется заглушкой молча', async () => { await rejects(() => analyzeDraft({ text: 'Описание', mode: 'ollama', fetchImpl: async () => ({ ok: false, status: 503 }) }), 'AI_UNAVAILABLE'); });
test('Таймаут AI корректно обрабатывается', async () => { await rejects(() => analyzeDraft({ text: 'Описание', mode: 'ollama', timeoutMs: 5, fetchImpl: async (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { const e = new Error('timeout'); e.name = 'AbortError'; reject(e); })) }), 'AI_TIMEOUT'); });

test('OpenAI отправляет только текст, ответы и провайдера; ключа в браузерном запросе нет', async () => {
  let body;
  const result = await analyzeDraft({ text: 'Нужен прототип кафе.', mode: 'openai', fetchImpl: async (_, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => validAI() }; } });
  equal(result.mode, 'openai'); equal(body.provider, 'openai'); equal(Object.keys(body).sort(), ['answers','provider','text']);
});
test('Ошибки настройки и квоты OpenAI доходят до интерфейса без подмены демо', async () => {
  for (const code of ['AI_NOT_CONFIGURED','AI_AUTH','AI_QUOTA','AI_RATE_LIMIT']) {
    await rejects(() => analyzeDraft({ text: 'Описание', mode: 'openai', fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: code, message: 'Проверьте настройки' }) }) }), code);
  }
});

test('Случайное число не заменяет источник, цель и порядок связи', () => {
  equal(previewRating({data_description:'Есть 100 документов'}).score,10);
  equal(previewRating({success_metric:'Проверить 20 писем'}).score,8);
  equal(previewRating({contact:'Руководитель, 10 человек'}).score,5);
  equal(previewRating({users:'1234567890'}).score,0);
});
test('Полный вес для данных требует подтверждённого источника', () => {
  const f={data_description:'Архив из 100 CSV документов',data_source:'Локальная папка, доступ разрешён'};
  equal(calculateRating(f,['data_description']).score,10); equal(previewRating(f).score,20);
});
test('Контракт файла совпадает с экспортом модуля AI', async () => {
  const {AI_SCHEMA,SYSTEM_PROMPT}=await import('../js/ai.mjs');
  let contract;
  if(typeof window==='undefined') { const fs=await import('node:fs/promises'); contract=JSON.parse(await fs.readFile(new URL('../ai-contract.json',import.meta.url),'utf8')); }
  else contract=await (await fetch('/ai-contract.json')).json();
  equal(contract.schema,AI_SCHEMA); equal(contract.prompt,SYSTEM_PROMPT); equal(contract.keys,FIELD_KEYS);
});


test('Телефон: шаблон совместим с v, принимает скобки и дефис, отклоняет буквы', () => {
  const pattern = new RegExp('^(?:' + PHONE_PATTERN + ')$', 'v');
  for (const value of ['+77000000000','+7 (700) 000-00-00','8700 000 00 00']) ok(pattern.test(value));
  for (const value of ['abc12345678','123','+77000000000<script>']) ok(!pattern.test(value));
});
test('Без настройки OpenAI/Ollama проверка health предотвращает POST и не меняет данные', async () => {
  for (const mode of ['openai','ollama']) {
    const calls = [], answers = {users:'Оператор кафе'};
    await rejects(() => analyzeActual({text:'Описание кафе',answers,mode,fetchImpl:async (url, init) => {
      calls.push(url); equal(init.cache,'no-store');
      return {ok:true,json:async()=>({ok:true,openaiConfigured:false,ollamaConfigured:false})};
    }}), 'AI_NOT_CONFIGURED');
    equal(calls,['/api/health']); equal(answers,{users:'Оператор кафе'});
  }
});
test('Демо работает без проверки health и без запросов к модели', async () => {
  const result = await analyzeActual({text:'Описание кафе',mode:'demo',fetchImpl:()=>{throw new Error('Unexpected network');}});
  equal(result.mode,'demo'); ok(result.warning.includes('заглушка'));
});
test('Ошибка или устаревший ответ health не запускает анализ', async () => {
  for (const response of [{ok:false},{ok:true,json:async()=>({ok:true})}]) {
    let count=0;
    await rejects(()=>analyzeActual({text:'Описание кафе',mode:'openai',fetchImpl:async()=>{count++;return response;}}),'AI_UNAVAILABLE');
    equal(count,1);
  }
});
test('Настроенная, но недоступная модель сохраняет настоящий код ошибки', async () => {
  const calls=[];
  await rejects(()=>analyzeActual({text:'Описание кафе',mode:'openai',fetchImpl:async(url)=>{
    calls.push(url);return url==='/api/health'
      ? {ok:true,json:async()=>({ok:true,openaiConfigured:true})}
      : {ok:false,status:503,json:async()=>({error:'AI_UNAVAILABLE',message:'Модель недоступна'})};
  }}),'AI_UNAVAILABLE');
  equal(calls,['/api/health','/api/ai/analyze']);
});

export async function runTests(onResult = () => {}) {
  const results = [];
  for (const { name, fn } of cases) {
    try { await fn(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.message }); }
    onResult(results.at(-1));
  }
  return { total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed), results };
}
