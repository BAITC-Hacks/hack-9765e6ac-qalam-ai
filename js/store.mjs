import { AppError, assert, object, cleanText, validateFields, emptyFields, FIELD_KEYS, calculateRating, validateUrl, LEVELS } from './domain.mjs';

export const STORAGE_KEY = 'ai-sana.part3.v1';
const clone = value => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const id = prefix => `${prefix}_${crypto.randomUUID()}`;
const initial = () => ({ version: 1, tasks: [], teams: [], proposals: [], events: [] });

function validateState(state) {
  assert(object(state) && state.version === 1 && ['tasks', 'teams', 'proposals', 'events'].every(k => Array.isArray(state[k])), 'STORAGE_CORRUPT', 'Неверный формат сохранённых данных.');
  const taskIds = new Set(), teamIds = new Set(), proposalIds = new Set();
  const checkCard = card => {
    validateFields(card.fields);
    assert(FIELD_KEYS.every(k => typeof card.fields[k] === 'string') && Array.isArray(card.confirmedFields) && card.confirmedFields.every(k => FIELD_KEYS.includes(k)), 'STORAGE_CORRUPT', 'Неверная карточка.');
  };
  assert(state.datasets === undefined || (Array.isArray(state.datasets) && state.datasets.every(k => typeof k === 'string')), 'STORAGE_CORRUPT', 'Неверный список наборов данных.');
  for (const t of state.tasks) {
    assert(object(t) && typeof t.id === 'string' && !taskIds.has(t.id) && typeof t.rawText === 'string', 'STORAGE_CORRUPT', 'Некорректная задача.');
    taskIds.add(t.id); checkCard(t);
    if (t.confirmedCard) checkCard(t.confirmedCard);
    if (t.publishedCard !== null) checkCard(t.publishedCard);
  }
  for (const t of state.teams) {
    assert(object(t) && typeof t.id === 'string' && !teamIds.has(t.id) && typeof t.name === 'string' && ['interests', 'skills', 'technologies'].every(k => Array.isArray(t[k]) && t[k].every(v => typeof v === 'string')), 'STORAGE_CORRUPT', 'Некорректная команда.');
    teamIds.add(t.id);
  }
  for (const p of state.proposals) {
    assert(object(p) && typeof p.id === 'string' && !proposalIds.has(p.id) && taskIds.has(p.taskId) && teamIds.has(p.teamId) && ['pending', 'accepted', 'rejected'].includes(p.status) && ['idea', 'plan', 'timeline', 'prototypeUrl'].every(k => typeof p[k] === 'string'), 'STORAGE_CORRUPT', 'Некорректный отклик.');
    proposalIds.add(p.id); validateUrl(p.prototypeUrl);
    assert(p.completedAt === undefined || p.completedAt === null || (typeof p.completedAt === 'string' && p.status === 'accepted'), 'STORAGE_CORRUPT', 'Завершённым может быть только принятый отклик.');
    assert(p.progressPoints === undefined || (p.completedAt && p.progressPoints === 10), 'STORAGE_CORRUPT', 'Некорректные баллы подтверждённого этапа.');
    if (p.qalamAuthor) assert(object(p.qalamAuthor) && ['name','university','skills'].every(k => typeof p.qalamAuthor[k] === 'string') && (p.qalamAuthor.id === undefined || typeof p.qalamAuthor.id === 'string'), 'STORAGE_CORRUPT', 'Некорректный автор отклика.');
  }
  return state;
}
export function memoryStorage() {
  const map = new Map();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
}
export class SanaStore {
  constructor(storage = globalThis.localStorage, key = STORAGE_KEY) {
    this.storage = storage; this.key = key; this.read();
  }
  read() {
    let raw;
    try { raw = this.storage.getItem(this.key); } catch { throw new AppError('STORAGE_READ', 'Браузер запретил чтение хранилища.'); }
    if (raw === null) return initial();
    try { return validateState(JSON.parse(raw)); }
    catch { throw new AppError('STORAGE_CORRUPT', 'Сохранённые данные повреждены. Они не перезаписаны. Сохраните исходные данные перед очисткой.'); }
  }
  commit(fn) {
    const state = this.read();
    const result = fn(state);
    try { this.storage.setItem(this.key, JSON.stringify(state)); }
    catch { throw new AppError('STORAGE_WRITE', 'Не удалось сохранить данные. Проверьте свободное место и настройки браузера.'); }
    return clone(result);
  }
  findTask(state, taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    assert(task, 'NOT_FOUND', 'Задача не найдена.'); return task;
  }
  taskView(task) {
    const confirmed = task.confirmedCard || task.publishedCard || task;
    return { ...clone(task), rating: calculateRating(confirmed.fields, confirmed.confirmedFields), previewRating: calculateRating(task.fields, FIELD_KEYS) };
  }
  event(state, action, entityId) { state.events.push({ id: id('event'), action, entityId, at: now() }); }
  createTask(rawText, fields = {}) {
    rawText = cleanText(rawText, 'Описание', 12000);
    assert(rawText.length >= 3, 'VALIDATION', 'Введите описание задачи.');
    fields = validateFields(fields);
    return this.commit(state => {
      const task = { id: id('task'), rawText, fields: { ...emptyFields(), ...fields }, confirmedFields: [], confirmedCard: null, publishedCard: null, createdAt: now(), updatedAt: now() };
      state.tasks.push(task); this.event(state, 'task.created', task.id); return this.taskView(task);
    });
  }
  getTask(taskId) { return this.taskView(this.findTask(this.read(), taskId)); }
  listTasks() { return this.read().tasks.map(t => this.taskView(t)); }
  updateTask(taskId, patch, rawText = undefined) {
    patch = validateFields(patch);
    if (rawText !== undefined) {
      rawText = cleanText(rawText, 'Описание', 12000);
      assert(rawText.length >= 3, 'VALIDATION', 'Введите описание задачи.');
    }
    return this.commit(state => {
      const task = this.findTask(state, taskId);
      if (!task.confirmedCard && task.confirmedFields.length) {
        const approved = task.publishedCard ? clone(task.publishedCard) : { fields: emptyFields(), confirmedFields: [...task.confirmedFields] };
        if (!task.publishedCard) for (const key of task.confirmedFields) approved.fields[key] = task.fields[key];
        task.confirmedCard = approved;
      }
      if (rawText !== undefined) task.rawText = rawText;
      for (const [key, value] of Object.entries(patch)) {
        if (task.fields[key] !== value) {
          task.fields[key] = value;
          task.confirmedFields = task.confirmedFields.filter(k => k !== key);
        }
      }
      task.updatedAt = now(); this.event(state, 'task.edited', taskId); return this.taskView(task);
    });
  }
  confirmTask(taskId, fields = null) {
    return this.commit(state => {
      const task = this.findTask(state, taskId);
      const keys = fields ?? FIELD_KEYS;
      assert(Array.isArray(keys) && keys.every(k => FIELD_KEYS.includes(k)), 'VALIDATION', 'Подтвердить можно только известные поля.');
      // Capture only explicitly confirmed changes, including intentional deletion.
      const previous = task.confirmedCard || task.publishedCard;
      const snapshot = previous ? clone(previous) : { fields: emptyFields(), confirmedFields: [] };
      if (!previous) for (const key of task.confirmedFields) {
        snapshot.fields[key] = task.fields[key];
        if (task.fields[key]) snapshot.confirmedFields.push(key);
      }
      for (const key of keys) {
        snapshot.fields[key] = task.fields[key];
        snapshot.confirmedFields = snapshot.confirmedFields.filter(k => k !== key);
        task.confirmedFields = task.confirmedFields.filter(k => k !== key);
        if (task.fields[key]) {
          snapshot.confirmedFields.push(key); task.confirmedFields.push(key);
        }
      }
      if (task.publishedCard) assert(snapshot.fields.title.length >= 3, 'VALIDATION', 'У опубликованной задачи должно оставаться название от 3 символов.');
      snapshot.confirmedAt = now(); task.confirmedCard = snapshot;
      if (task.publishedCard) {
        task.publishedCard = { ...clone(snapshot), publishedAt: task.publishedCard.publishedAt, updatedAt: now() };
        this.event(state, 'task.publication_updated', taskId);
      }
      task.updatedAt = now(); this.event(state, 'task.confirmed', taskId); return this.taskView(task);
    });
  }
  publishTask(taskId) {
    return this.commit(state => {
      const task = this.findTask(state, taskId);
      assert(task.fields.title.length >= 3, 'VALIDATION', 'Перед публикацией укажите название от 3 символов.');
      assert(FIELD_KEYS.filter(k => task.fields[k]).every(k => task.confirmedFields.includes(k)), 'CONFIRMATION_REQUIRED', 'Перед публикацией подтвердите все заполненные поля.');
      assert(!task.confirmedCard || FIELD_KEYS.every(k => task.fields[k] === task.confirmedCard.fields[k]), 'CONFIRMATION_REQUIRED', 'Подтвердите все изменения, включая удалённые сведения, перед публикацией.');
      task.publishedCard = { fields: clone(task.fields), confirmedFields: [...task.confirmedFields], publishedAt: now() };
      task.updatedAt = now(); this.event(state, 'task.published', taskId); return this.taskView(task);
    });
  }
  catalog({ topic = '', level = '', query = '' } = {}) {
    assert(!level || LEVELS.some(l => l.key === level), 'VALIDATION', 'Неизвестный уровень готовности.');
    const normal = s => s.toLocaleLowerCase('ru');
    return this.read().tasks.filter(t => t.publishedCard).map(t => ({ id: t.id, sourceRef: t.sourceRef || '', ...clone(t.publishedCard), rating: calculateRating(t.publishedCard.fields, t.publishedCard.confirmedFields) }))
      .filter(t => (!topic || normal(t.fields.topic) === normal(topic)) && (!level || t.rating.level.key === level) && (!query || normal(Object.values(t.fields).join(' ')).includes(normal(query))))
      .sort((a, b) => b.rating.score - a.rating.score || a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
  }
  addTeam({ name, interests = [], skills = [], technologies = [] }) {
    name = cleanText(name, 'Название команды', 160);
    assert(name.length >= 2, 'VALIDATION', 'Укажите название команды.');
    const lists = { interests, skills, technologies };
    for (const [key, value] of Object.entries(lists)) {
      assert(Array.isArray(value) && value.length <= 30, 'VALIDATION', `${key}: нужен массив до 30 строк.`);
      lists[key] = value.map(v => cleanText(v, key, 100)).filter(Boolean);
    }
    return this.commit(state => { const team = { id: id('team'), name, ...lists }; state.teams.push(team); return team; });
  }
  listTeams() { return clone(this.read().teams); }
  submitProposal({ taskId, teamId, idea, plan, timeline, prototypeUrl }) {
    const fields = { idea, plan, timeline };
    for (const [key, value] of Object.entries(fields)) {
      fields[key] = cleanText(value, key);
      assert(fields[key].length >= 3, 'VALIDATION', `Заполните ${key} (минимум 3 символа).`);
    }
    prototypeUrl = validateUrl(prototypeUrl);
    return this.commit(state => {
      assert(this.findTask(state, taskId).publishedCard, 'NOT_PUBLISHED', 'Отклик доступен после публикации задачи.');
      assert(state.teams.some(t => t.id === teamId), 'NOT_FOUND', 'Команда не найдена.');
      const proposal = { id: id('proposal'), taskId, teamId, ...fields, prototypeUrl, status: 'pending', decisionNote: '', createdAt: now(), decidedAt: null, completedAt: null };
      state.proposals.push(proposal); this.event(state, 'proposal.submitted', proposal.id); return proposal;
    });
  }
  listProposals(taskId) { return clone(this.read().proposals.filter(p => !taskId || p.taskId === taskId)); }
  decideProposal(proposalId, decision, note = '') {
    assert(['accepted', 'rejected'].includes(decision), 'VALIDATION', 'Решение: accepted или rejected.');
    note = cleanText(note, 'Комментарий');
    return this.commit(state => {
      const proposal = state.proposals.find(p => p.id === proposalId);
      assert(proposal, 'NOT_FOUND', 'Отклик не найден.');
      assert(!proposal.completedAt, 'ALREADY_COMPLETED', 'Выполненный отклик нельзя принять или отклонить повторно.');
      proposal.status = decision; proposal.decisionNote = note; proposal.decidedAt = now();
      this.event(state, `proposal.${decision}`, proposalId); return proposal;
    });
  }
  completeProposal(proposalId) {
    return this.commit(state => {
      const proposal = state.proposals.find(p => p.id === proposalId);
      assert(proposal, 'NOT_FOUND', 'Отклик не найден.');
      assert(proposal.status === 'accepted', 'NOT_ACCEPTED', 'Завершить можно только принятый заказчиком отклик.');
      if (proposal.completedAt) return proposal;
      proposal.completedAt = now();
      proposal.progressPoints = 10;
      this.event(state, 'proposal.completed', proposalId);
      return proposal;
    });
  }
  teamProgress(teamId) {
    return this.read().proposals.filter(p => p.teamId === teamId && p.completedAt)
      .reduce((sum, p) => sum + (p.progressPoints || 0), 0);
  }
  appendDataset(key, data) {
    key = cleanText(key, 'Ключ набора', 100);
    assert(key.length > 0, 'VALIDATION', 'Укажите ключ набора.');
    validateState(data);
    return this.commit(state => {
      state.datasets ??= [];
      if (state.datasets.includes(key)) return { seeded: false, reason: 'Этот набор уже добавлен; существующие записи сохранены.' };
      for (const name of ['tasks', 'teams', 'proposals', 'events']) state[name].push(...clone(data[name]));
      state.datasets.push(key); validateState(state);
      return { seeded: true, tasks: data.tasks.length, teams: data.teams.length, proposals: data.proposals.length };
    });
  }
  exportData() { return clone(this.read()); }
}
