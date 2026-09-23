import { QalamModel } from '../js/ui-model.mjs';
import { SanaStore, memoryStorage, emptyFields, previewRating, PARTICIPANT_CARDS, K1_ANSWERS, k1AnswerPatch } from '../js/index.mjs';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });
const equal = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = v => { if (!v) throw new Error('Assertion failed'); };
const throws = fn => { try { fn(); } catch { return; } throw new Error('Expected error'); };
const setup = () => { const storage = memoryStorage(); const model = new QalamModel(new SanaStore(storage)); return { model, storage }; };
const offer = { idea: 'Классификация заявок по темам', plan: 'Сбор примеров и проверка', days: '3 дня', link: 'https://example.org/prototype', team: 'Команда интеграции' };
const author = { name: 'Тестовый студент', university: 'Учебный вуз', skills: 'JavaScript' };

test('Интерфейс получает согласованные карточки и рейтинг 35/65/85/93/70', () => {
  const { model } = setup(); equal(model.tasks.map(t => t.score), [35,65,85,93,70]);
  equal(model.tasks.map(t => t.sourceRef), ['К1','К2','К3','К4','К5']);
  equal(model.offers.length, 5); ok(model.offers[3].days.includes('6 дней')); ok(model.offers[3].isDemoLink);
});
test('Сохранение черновика не меняет заголовок, текст или балл публикации', () => {
  const { model } = setup(), t = model.tasks[0];
  const draft = { ...t.draftFields, title: 'Новое название', users: '' };
  model.save(t.id, draft, t.rawText);
  equal(model.task(t.id).title, t.title); equal(model.task(t.id).score, 35);
  equal(model.task(t.id).card.users, t.card.users); equal(model.task(t.id).draftFields.users, '');
  ok(model.task(t.id).hasDraft);
});
test('К1 после четырёх ответов меняется в каталоге только при подтверждении', () => {
  const { model, storage } = setup(), t = model.tasks[0]; let fields = { ...t.draftFields };
  K1_ANSWERS.forEach((_, i) => Object.assign(fields, k1AnswerPatch(i)));
  equal(previewRating(fields).score, 95); model.save(t.id, fields, t.rawText); equal(model.task(t.id).score,35);
  model.save(t.id, fields, t.rawText, { confirm: true }); equal(model.task(t.id).score,95);
  equal(new QalamModel(new SanaStore(storage)).task(t.id).score,95);
});
test('Новая карточка публикуется с нулевым баллом и принимает отклик', () => {
  const { model } = setup(); const t = model.save(null, { title: 'Новая задача' }, '', { confirm: true, publish: true });
  equal(t.score,0); ok(t.published); model.submit(t.id, offer, author);
  equal(model.offers.at(-1).task,t.id); equal(model.offers.at(-1).status,'Ожидает решения');
});
test('Подтверждённый, но неопубликованный черновик не появляется в каталоге', () => {
  const { model } = setup(); const t = model.save(null, { ...PARTICIPANT_CARDS[3] }, 'Описание новой задачи', { confirm: true });
  ok(!t.published); equal(model.store.catalog().length,5); throws(() => model.submit(t.id, offer, author));
});
test('Публикация без подтверждения и удаление названия атомарно отклоняются', () => {
  const { model } = setup(), t = model.tasks[0], before = model.store.exportData();
  throws(() => model.save(t.id, { ...t.draftFields, title: '' }, t.rawText, { confirm: true }));
  throws(() => model.save(null, { title: 'Не подтверждено' }, 'Новая задача', { publish: true }));
  equal(model.store.exportData(),before);
});
test('Неправильный отклик не оставляет лишнюю команду; опасные ссылки отклоняются', () => {
  const { model } = setup(), before = model.store.exportData();
  throws(() => model.submit(1, { ...offer, plan: '' }, author));
  throws(() => model.submit(1, { ...offer, link: 'javascript:alert(1)' }, author));
  throws(() => model.submit(1, { ...offer, link: 'https://name:password@example.org' }, author));
  equal(model.store.exportData(),before);
});
test('Ошибка localStorage не создаёт частичную задачу, публикацию или отклик', () => {
  const storage = memoryStorage(); let fail = false;
  const guarded = { getItem: k => storage.getItem(k), setItem: (k,v) => { if(fail) throw new Error('quota'); storage.setItem(k,v); } };
  const model = new QalamModel(new SanaStore(guarded)), before = model.store.exportData(); fail = true;
  throws(() => model.save(null, PARTICIPANT_CARDS[3], 'Тестовая карточка', { confirm: true, publish: true }));
  throws(() => model.submit(1,offer,author)); equal(model.store.exportData(),before);
});
test('Ручной выбор нескольких команд и выполнение сохраняются после перезагрузки', () => {
  const { model, storage } = setup(); model.submit(1,offer,author); const id = model.offers.at(-1).id;
  model.decide(1,'accepted'); model.decide(id,'accepted'); equal(model.offers.filter(o => o.task===1 && o.status==='Выбран').length,2);
  model.complete(id); const completed = model.offers.at(-1).completedAt; model.complete(id);
  equal(model.offers.at(-1).completedAt,completed); throws(() => model.decide(id,'rejected'));
  const reloaded = new QalamModel(new SanaStore(storage));
  equal(reloaded.offers.at(-1).status,'Выполнено'); ok(reloaded.offers.at(-1).mine); equal(reloaded.offers.at(-1).name,author.name);
  equal(reloaded.task(1).score,35); ok(!Object.hasOwn(reloaded.store.listProposals().at(-1),'points'));
});
test('Старые данные модуля сохраняются, числовые маршруты стабильны при повторном запуске', () => {
  const storage = memoryStorage(), store = new SanaStore(storage);
  const old = store.createTask('Старая задача пользователя', { title:'Старая задача пользователя', users:'Операторы поддержки' });
  store.confirmTask(old.id); store.publishTask(old.id);
  const model = new QalamModel(store); equal(model.tasks.length,6); equal(model.task(1).storeId,old.id);
  const refs = model.tasks.map(t=>[t.id,t.storeId]); equal(new QalamModel(new SanaStore(storage)).tasks.map(t=>[t.id,t.storeId]),refs);
});

export async function runIntegrationTests(onResult = () => {}) {
  const results = [];
  for (const {name,fn} of cases) {
    try { await fn(); results.push({name,passed:true}); }
    catch(error) { results.push({name,passed:false,error:error.message}); }
    onResult(results.at(-1));
  }
  return { total:results.length, passed:results.filter(r=>r.passed).length, failed:results.filter(r=>!r.passed), results };
}
