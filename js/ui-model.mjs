import { SanaStore, memoryStorage, seedDemo, RULES, FIELD_KEYS, emptyFields, validateFields, validateUrl, AppError } from './index.mjs';

// The teammate's numeric UI routes are views over the store's stable string IDs.
// No readiness values or decisions are stored in the presentation layer.
export class QalamModel {
  constructor(store = new SanaStore()) { this.store = store; seedDemo(store); this.refresh(); }
  refresh() {
    const all = this.store.listTasks();
    const publications = new Map(this.store.catalog().map(t => [t.id, t]));
    this.tasks = all.map((t, i) => {
      const shown = publications.get(t.id) || { fields: t.confirmedCard?.fields || t.fields, rating: t.rating };
      const f = shown.fields;
      return {
        id: i + 1, storeId: t.id, sourceRef: t.sourceRef || '', own: true,
        title: f.title || 'Новая задача', topic: f.topic || 'Без направления',
        company: t.sourceRef ? `Учебный бизнес · ${t.sourceRef}` : 'Мой бизнес', mark: t.sourceRef || 'Q',
        tags: [f.topic || 'Новая задача'], desc: f.context || f.need || 'Бизнес уточняет постановку.',
        score: shown.rating.score, parts: shown.rating.breakdown.map(p => p.points), rating: shown.rating,
        fields: RULES.map(r => [...new Set(r.parts.flatMap(p => p[2]))].filter(k => f[k]).map(k => f[k]).join('\n')),
        card: f, draftFields: t.fields, rawText: t.rawText,
        published: publications.has(t.id), hasDraft: FIELD_KEYS.some(k => f[k] !== t.fields[k]),
      };
    });
    const teams = new Map(this.store.listTeams().map(t => [t.id, t]));
    this.offers = this.store.listProposals().map((p, i) => {
      const team = teams.get(p.teamId);
      return {
        id: i + 1, storeId: p.id, task: this.tasks.find(t => t.storeId === p.taskId).id,
        team: team.name, name: p.qalamAuthor?.name || team.name,
        university: p.qalamAuthor?.university || 'Учебная команда',
        skills: p.qalamAuthor?.skills || [...team.skills, ...team.technologies].join(' · '),
        idea: p.idea, plan: p.plan, days: p.timeline, link: p.prototypeUrl,
        mine: Boolean(p.qalamAuthor), completedAt: p.completedAt,
        isDemoLink: Boolean(p.isDemoLink),
        status: p.completedAt ? 'Выполнено' : ({ pending: 'Ожидает решения', accepted: 'Выбран', rejected: 'Отклонён' })[p.status],
      };
    });
    return this;
  }
  task(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) throw new AppError('NOT_FOUND', 'Задача не найдена.');
    return task;
  }
  // Composite actions commit once: validation/storage errors leave no partial task or team.
  transaction(action) {
    const result = this.store.commit(state => {
      const memory = memoryStorage();
      memory.setItem(this.store.key, JSON.stringify(state));
      const temporary = new SanaStore(memory, this.store.key);
      const value = action(temporary);
      Object.assign(state, temporary.exportData());
      return value;
    });
    this.refresh();
    return result;
  }
  save(id, fields, rawText, { confirm = false, publish = false } = {}) {
    fields = { ...emptyFields(), ...validateFields(fields) };
    if (confirm && fields.title.length < 3) throw new AppError('VALIDATION', 'Укажите название от 3 символов.');
    if (publish && !confirm) throw new AppError('CONFIRMATION_REQUIRED', 'Для публикации подтвердите сведения.');
    const original = id === null ? null : this.task(id);
    const saved = this.transaction(store => {
      const raw = rawText.trim() || fields.context || fields.need || fields.title || 'Новый черновик';
      let task = original ? store.updateTask(original.storeId, fields, raw) : store.createTask(raw, fields);
      if (confirm) task = store.confirmTask(task.id);
      if (publish && !task.publishedCard) task = store.publishTask(task.id);
      return task;
    });
    return this.tasks.find(t => t.storeId === saved.id);
  }
  submit(id, data, author) {
    const taskId = this.task(id).storeId;
    validateUrl(data.link);
    return this.transaction(store => {
      const team = store.addTeam({ name: data.team?.trim() || 'Самостоятельно', skills: [author.skills || 'Не указаны'] });
      const proposal = store.submitProposal({ taskId, teamId: team.id, idea: data.idea, plan: data.plan, timeline: data.days, prototypeUrl: data.link });
      store.commit(state => { state.proposals.find(p => p.id === proposal.id).qalamAuthor = { ...author }; return proposal; });
      return proposal;
    });
  }
  decide(id, decision) {
    const offer = this.offers.find(o => o.id === id);
    if (!offer) throw new AppError('NOT_FOUND', 'Отклик не найден.');
    this.store.decideProposal(offer.storeId, decision); this.refresh();
  }
  complete(id) {
    const offer = this.offers.find(o => o.id === id);
    if (!offer) throw new AppError('NOT_FOUND', 'Отклик не найден.');
    this.store.completeProposal(offer.storeId); this.refresh();
  }
}
