// Shared contract: no DOM, network, framework, or storage dependency.
export const FIELD_DEFS = [
  ['title', 'Название', 'Как коротко назвать задачу?'],
  ['topic', 'Тема', 'К какой теме относится задача?'],
  ['context', 'Контекст', 'Как сейчас устроен процесс и в чём возникает проблема?'],
  ['need', 'Потребность', 'Что конкретно необходимо изменить?'],
  ['users', 'Пользователи', 'Кто будет пользоваться решением?'],
  ['data_description', 'Данные и материалы', 'Какие данные или примеры у вас есть, в каком формате?'],
  ['data_source', 'Источник и доступ к данным', 'Откуда команда получит данные и на каких условиях?'],
  ['expected_result', 'Ожидаемый результат', 'Что команда должна передать: прототип, отчёт, модель или другое?'],
  ['success_metric', 'Критерий успеха', 'Что вы будете измерять или проверять при приёмке?'],
  ['success_target', 'Целевое значение', 'Какое значение показателя или проверяемое условие означает успех?'],
  ['constraints', 'Ограничения', 'Какие есть сроки, требования к технологиям или ограничения доступа?'],
  ['contact', 'Контакт бизнеса', 'Как команда сможет связаться с представителем бизнеса?'],
  ['consultation_format', 'Формат консультаций', 'Как и с какой частотой вы готовы консультировать команду?'],
  ['feedback_process', 'Обратная связь', 'Кто проверяет результат и как команда получает обратную связь?'],
].map(([key, label, question]) => ({ key, label, question }));
export const FIELD_KEYS = FIELD_DEFS.map(f => f.key);
export const LEVELS = [
  { key: 'draft', label: 'Черновик', min: 0, max: 39 },
  { key: 'working', label: 'Рабочая', min: 40, max: 69 },
  { key: 'ready', label: 'Готовая', min: 70, max: 89 },
  { key: 'priority', label: 'Приоритетная', min: 90, max: 100 },
];
export const RULES = [
  { key: 'context_need', label: 'Контекст и потребность', parts: [['context', 10, ['context']], ['need', 10, ['need']]] },
  { key: 'data', label: 'Данные и материалы', parts: [['data_description', 20, ['data_description', 'data_source']]] },
  { key: 'result', label: 'Ожидаемый результат', parts: [['expected_result', 15, ['expected_result']]] },
  { key: 'success', label: 'Критерии успеха', parts: [['success_metric', 15, ['success_metric', 'success_target']]] },
  { key: 'constraints', label: 'Ограничения', parts: [['constraints', 10, ['constraints']]] },
  { key: 'users', label: 'Пользователи', parts: [['users', 10, ['users']]] },
  { key: 'communication', label: 'Связь с бизнесом', parts: [['contact', 10, ['contact', 'consultation_format', 'feedback_process']]] },
];
export const RATING_VERSION = 'confirmed-completeness-v3';
export class AppError extends Error {
  constructor(code, message) { super(message); this.name = 'AppError'; this.code = code; }
}
export function assert(condition, code, message) {
  if (!condition) throw new AppError(code, message);
}
export function cleanText(value, label = 'Текст', max = 4000) {
  assert(typeof value === 'string', 'VALIDATION', `${label}: требуется строка.`);
  const text = value.trim();
  assert(text.length <= max, 'VALIDATION', `${label}: максимум ${max} символов.`);
  return text;
}
export function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function validateFields(input = {}) {
  assert(object(input), 'VALIDATION', 'Поля карточки должны быть объектом.');
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    assert(FIELD_KEYS.includes(key), 'VALIDATION', `Неизвестное поле: ${key}`);
    out[key] = cleanText(value, key, ['title', 'topic'].includes(key) ? 160 : 4000);
  }
  return out;
}
export function emptyFields() { return Object.fromEntries(FIELD_KEYS.map(k => [k, ''])); }
const PLACEHOLDERS = /^(нет|не знаю|неизвестно|не указано|потом|уточнить|тест|test|todo|n\/?a|tbd|[-—–?.\s]+)$/iu;
export function informative(value) {
  return typeof value === 'string' && value.trim().length >= 10 && /\p{L}/u.test(value) && !PLACEHOLDERS.test(value.trim());
}
// One shared, deterministic heuristic for every logical field. It does not know
// card IDs or target scores. Matches are exposed as evidence, not hidden labels.
export const FACT_PATTERNS = [
  ['число', /\d+(?:[.,]\d+)?\s*%?/iu],
  ['число словами', /(?<!\p{L})(?:один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|двадцать|сто)(?!\p{L})/iu],
  ['конкретная роль', /(?<!\p{L})(?:оператор\p{L}*|курьер\p{L}*|hr(?:-менеджер\p{L}*)?|менеджер\p{L}*|маркетолог\p{L}*|начальник\p{L}*|руководител\p{L}*|аналитик\p{L}*|администратор\p{L}*|студент\p{L}*|клиент\p{L}*|директор\p{L}*|врач\p{L}*|инженер\p{L}*|бухгалтер\p{L}*|преподавател\p{L}*)(?!\p{L})/iu],
  ['названный источник данных', /(?:единый\s+email-ящик|email-ящик\s+поддержки|таблиц\p{L}*\s+(?:заказ\p{L}*|остатк\p{L}*|выдач\p{L}*)|баз\p{L}*\s+(?:клиент\p{L}*|резюме|заказ\p{L}*)|регламент\p{L}*\s+отк|конвейерн\p{L}*\s+камер\p{L}*|камер\p{L}*\s+конвейер\p{L}*|(?<!\p{L})(?:csv|pdf|json|excel)(?!\p{L}))/iu],
  ['срок или период', /(?:в\s+течение\s+(?:(?:одного|одной|двух|тр[её]х)\s+)?(?:дня|дней|недели|недель|месяца|месяцев)|к\s+защите|за\s+(?:квартал|полгода|год)|кажд\p{L}*\s+(?:день|недел\p{L}*|месяц)|день\s+в\s+неделю|(?:срок|дедлайн)\s*[:—-]\s*\S+)/iu],
  ['точный контакт или ссылка', /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/\S+)/iu],
];
export function assessText(value, max) {
  assert(Number.isInteger(max) && max > 0, 'VALIDATION', 'Вес должен быть положительным целым числом.');
  const text = cleanText(value, 'Оцениваемое описание', 16000);
  if (!informative(text)) return { points: 0, fraction: 0, grade: 'empty', evidence: null, reason: 'Пусто, заглушка или меньше 10 символов.' };
  for (const [type, pattern] of FACT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { points: max, fraction: 1, grade: 'specific', evidence: { type, text: match[0] }, reason: `Конкретность: ${type} — «${match[0]}».` };
  }
  return { points: Math.ceil(max / 2), fraction: 0.5, grade: 'general', evidence: null, reason: 'Есть описание, но программа не распознала число, роль, источник, срок или точный контакт.' };
}
export function levelFor(score) {
  assert(Number.isInteger(score) && score >= 0 && score <= 100, 'VALIDATION', 'Балл должен быть от 0 до 100.');
  return LEVELS.find(l => score >= l.min && score <= l.max);
}
// A number/role alone is not evidence that unrelated criteria are complete.
// These are transparent completeness checks, not semantic truth verification.
function criterionAssessment(field, text, max, selected, fields) {
  const result = assessText(text, max);
  if (!result.points) return result;
  const present = key => selected.includes(key) && informative(fields[key]);
  let complete = result.fraction === 1;
  if (field === 'data_description') complete = present('data_description') && present('data_source');
  if (field === 'success_metric') complete = present('success_metric') && present('success_target') && /\d/.test(fields.success_target);
  if (field === 'contact') complete = present('contact') && /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/\S+|\+\d[\d ()-]{8,})/iu.test(fields.contact) && present('consultation_format') && present('feedback_process');
  if (field === 'constraints') complete = /(?:\d+\s*(?:час|дн|день|недел|месяц)|к защите|без\s+(?:дообуч|обуч|доступ|интеграц)|только\s+локальн)/iu.test(text);
  if (field === 'users') complete = FACT_PATTERNS.find(([name]) => name === 'конкретная роль')[1].test(text);
  if (field === 'expected_result') complete = /(?:прототип|классификатор|отч[её]т|интерфейс|исходн\p{L}*\s+код|список)/iu.test(text) && /(?:отмеча|распределя|извлека|показыва|сортир|классифиц|оценк|переда)/iu.test(text);
  if (field === 'need') complete = /(?:автомат|ускор|сократ|распредел|пересчитыва|сортир|персонализа|извлека)/iu.test(text);
  return { ...result, points: complete ? max : Math.ceil(max / 2), fraction: complete ? 1 : .5, grade: complete ? 'specific' : 'general', evidence: complete ? result.evidence : null,
    reason: complete ? 'Подтверждённые сведения соответствуют правилу полноты этого критерия.' : 'Частичное описание: уточните обязательные сведения критерия. Число или роль сами по себе не дают полный вес.' };
}
export function calculateRating(fields, confirmedFields = []) {
  fields = validateFields(fields);
  assert(Array.isArray(confirmedFields) && confirmedFields.every(k => FIELD_KEYS.includes(k)), 'VALIDATION', 'Некорректные подтверждённые поля.');
  const confirmed = new Set(confirmedFields);
  const missing = [];
  const breakdown = RULES.map(rule => {
    const parts = rule.parts.map(([field, max, relatedFields]) => {
      const selected = relatedFields.filter(k => confirmed.has(k) && fields[k]);
      const text = selected.map(k => fields[k]).join('\n');
      // Supporting UI fields are one logical criterion; do not round each one.
      const assessment = criterionAssessment(field, text, max, selected, fields);
      const hasUnconfirmed = relatedFields.some(k => fields[k] && !confirmed.has(k));
      const reason = assessment.reason + (hasUnconfirmed ? ' Неподтверждённые сведения не учитываются.' : '');
      if (assessment.points < max) missing.push({ field, label: FIELD_DEFS.find(f => f.key === field).label, potentialPoints: max - assessment.points, reason, question: FIELD_DEFS.find(f => f.key === field).question });
      return { field, fields: relatedFields, max, ...assessment, reason };
    });
    return { key: rule.key, label: rule.label, max: parts.reduce((n, p) => n + p.max, 0), points: parts.reduce((n, p) => n + p.points, 0), parts };
  });
  const score = breakdown.reduce((n, r) => n + r.points, 0);
  return { version: RATING_VERSION, score, level: levelFor(score), breakdown, missing };
}
export function previewRating(fields) { return calculateRating(fields, FIELD_KEYS); }
export function validateUrl(value) {
  const text = cleanText(value, 'Ссылка', 2000);
  let url;
  try { url = new URL(text); } catch { throw new AppError('VALIDATION', 'Нужна полная ссылка http:// или https://.'); }
  assert(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'VALIDATION', 'Нужна ссылка HTTP(S) без пароля.');
  return text;
}
// HTML pattern uses the Unicode-sets (v) flag: literal punctuation must be escaped.
export const PHONE_PATTERN = String.raw`[+0-9 \(\)\-]{10,20}`;
