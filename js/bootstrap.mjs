import * as core from './index.mjs';
import { QalamModel } from './ui-model.mjs';

try {
  window.SanaCore = core;
  window.qalamModel = new QalamModel();
  const script = document.createElement('script');
  script.src = './app.js';
  script.onerror = () => { document.querySelector('#app').textContent = 'Не удалось загрузить интерфейс. Обновите страницу.'; };
  document.body.append(script);
} catch (error) {
  // Never overwrite corrupt or inaccessible storage with an empty/demo store.
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.textContent = `Приложение не запущено: ${error.message} Существующие данные не удалены.`;
  document.querySelector('#app').replaceChildren(panel);
}
