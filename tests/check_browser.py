"""Isolated Chrome profile; real DOM tests over local CDP, no extra dependencies."""
import base64
import hashlib
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import time
from urllib.request import urlopen
from urllib.parse import urlsplit

OUT = Path(__file__).resolve().parents[1]
ROOT = OUT
(ROOT / 'work').mkdir(exist_ok=True)

class CDP:
    def __init__(self, address):
        u = urlsplit(address)
        self.sock = socket.create_connection((u.hostname, u.port), timeout=15)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        header = b''
        while not header.endswith(b'\r\n\r\n'): header += self.sock.recv(1)
        assert header.startswith(b'HTTP/1.1 101 '), header
        self.count = 0
        self.events = []

    def exact(self, n):
        data = b''
        while len(data) < n:
            more = self.sock.recv(n-len(data))
            if not more: raise RuntimeError('WebSocket closed')
            data += more
        return data

    def send(self, payload):
        data = json.dumps(payload).encode()
        mask = os.urandom(4)
        size = len(data)
        length = bytes([size | 128]) if size < 126 else (bytes([126 | 128]) + struct.pack('!H', size) if size < 65536 else bytes([127 | 128]) + struct.pack('!Q', size))
        self.sock.sendall(b'\x81' + length + mask + bytes(b ^ mask[i%4] for i,b in enumerate(data)))

    def receive(self):
        data = b''
        while True:
            first, second = self.exact(2)
            length = second & 127
            if length == 126: length = struct.unpack('!H',self.exact(2))[0]
            if length == 127: length = struct.unpack('!Q',self.exact(8))[0]
            mask = self.exact(4) if second & 128 else None
            chunk = self.exact(length)
            if mask: chunk = bytes(b ^ mask[i%4] for i,b in enumerate(chunk))
            if first & 15 == 8: raise RuntimeError('WebSocket closed')
            data += chunk
            if first & 128: return json.loads(data)

    def call(self, method, params=None):
        self.count += 1
        self.send({'id':self.count, 'method':method, 'params':params or {}})
        while True:
            message = self.receive()
            if message.get('id') != self.count:
                self.events.append(message)
                continue
            if 'error' in message: raise RuntimeError(message['error'])
            return message.get('result',{})

    def evaluate(self, expression):
        r = self.call('Runtime.evaluate', {'expression':expression, 'awaitPromise':True, 'returnByValue':True})
        if 'exceptionDetails' in r: raise RuntimeError(r['exceptionDetails'])
        return r.get('result',{}).get('value')

chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
profile = ROOT / 'work/chrome-qalam-e2e'
process = subprocess.Popen([chrome, '--headless=new','--no-sandbox','--in-process-gpu','--disable-gpu','--disable-software-rasterizer','--no-first-run','--no-default-browser-check','--remote-debugging-port=9331',f'--user-data-dir={profile}','about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
report = []
try:
    for _ in range(100):
        try:
            pages = json.load(urlopen('http://127.0.0.1:9331/json',timeout=1))
            if pages: break
        except Exception: time.sleep(.1)
    page = next(p for p in pages if p['type']=='page')
    cdp = CDP(page['webSocketDebuggerUrl'])
    cdp.call('Runtime.enable')
    cdp.call('Page.enable')
    cdp.call('Emulation.setDeviceMetricsOverride', {'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
    cdp.call('Page.navigate', {'url':'http://127.0.0.1:8000/'})
    def ready():
        for _ in range(100):
            if cdp.evaluate("typeof model !== 'undefined' && !!document.querySelector('#cards')"): return
            time.sleep(.05)
        raise RuntimeError('Application did not load')
    ready()
    # Clear only the dedicated automation profile, never the user's browser.
    cdp.evaluate('localStorage.clear(); location.reload()')
    time.sleep(.3)
    ready()
    def check(name, expression):
        result = cdp.evaluate(expression)
        if result is not True: raise AssertionError(f'{name}: {result!r}')
        report.append({'name':name,'passed':True})
    def screenshot(name):
        result = cdp.call('Page.captureScreenshot', {'format':'png','captureBeyondViewport':False})
        (ROOT / 'work' / name).write_bytes(base64.b64decode(result['data']))
    check('Каталог загружен с пятью карточками', "document.querySelectorAll('#cards .card').length === 5 && tasks.map(t=>t.score).join(',') === '35,65,85,93,70'")
    screenshot('qalam-integrated-catalog.png')
    check('Фильтр оставляет черновик К1 доступным', "$('#level').value='Черновик'; $('#level').dispatchEvent(new Event('change')); document.querySelectorAll('#cards .card').length===1 && $('#cards').textContent.includes('35/100')")
    check('Редактор открывается через кнопку кабинета', "setRole('business'); go('cabinet'); [...document.querySelectorAll('button')].find(b=>b.textContent==='Дополнить задачу').click(); !!$('#editorform') && $('#liveScore').textContent==='35'")
    screenshot('qalam-integrated-editor.png')
    check('Демо AI формирует вопросы в настоящем DOM', "(async()=>{await questions(); return lastQuestions.length>=3 && $('#questions textarea')!==null && $('#aiStatus').textContent.includes('заглушка')})()")
    check('Ответ из вопроса переносится в отдельное поле', "$('#answer0').value='Необходимо сортировать 80 заявок в день'; applyAnswers(); readEditor()[lastQuestions[0].field] === 'Необходимо сортировать 80 заявок в день'")
    check('Ответы К1 дают живой балл 95, каталог остаётся 35', "editor(1); for(let i=0;i<4;i++) applyK1Answer(i); $('#liveScore').textContent==='95' && model.task(1).score===35")
    check('Сохранение черновика сохраняет исходный балл каталога', "saveDraft(); model.task(1).score===35 && $('#liveScore').textContent==='95' && model.task(1).hasDraft")
    check('Подтверждение через форму обновляет каталог', "$('#editorform').elements.confirmed.checked=true; $('#editorform').requestSubmit(); model.task(1).score===95 && !model.task(1).hasDraft")
    check('Новая задача публикуется с нулевым рейтингом', "editor(); $('#editorform').elements.title.value='Нулевая тестовая задача'; $('#editorform').elements.rawText.value='Нужно уточнить постановку'; editorChanged(); $('#editorform').elements.confirmed.checked=true; $('#editorform').elements.publish.checked=true; $('#editorform').requestSubmit(); model.tasks.length===6 && model.tasks.at(-1).score===0 && model.tasks.at(-1).published")
    check('Неопубликованный черновик не виден гостю', "editor(); $('#editorform').elements.title.value='Закрытый черновик'; saveDraft(); setRole('guest'); go('catalog'); !$('#cards').textContent.includes('Закрытый черновик')")
    check('Студент отправляет отклик через модальную форму', "setRole('student'); apply(6); (()=>{const f=$('#modal form'); f.elements.idea.value='Инструмент для сортировки заявок'; f.elements.plan.value='Сбор примеров и проверка'; f.elements.days.value='3 дня'; f.elements.team.value='Browser Test'; f.elements.link.value='https://example.org/test'; f.querySelector('[type=checkbox]').checked=true; f.requestSubmit(); return offers.at(-1).mine && offers.at(-1).task===6 && !$('#modal').open;})()")
    check('Бизнес выбирает несколько команд вручную', "setRole('business'); businessCabinet(); decision(1,'Выбран'); decision(2,'Выбран'); decision(offers.at(-1).id,'Выбран'); offers.filter(o=>o.status==='Выбран').length===3")
    check('Выполнение через кнопку сохраняется без баллов', "businessCabinet(); [...document.querySelectorAll('button')].filter(b=>b.textContent==='Отметить как выполнено').at(-1).click(); offers.at(-1).status==='Выполнено' && !!offers.at(-1).completedAt && !$('#app').textContent.includes('+10')")
    screenshot('qalam-integrated-business.png')
    check('Пользовательский HTML отображается как текст', "editor(6); $('#editorform').elements.title.value='<img src=x onerror=alert(1)>'; editorChanged(); $('#editorform').elements.confirmed.checked=true; $('#editorform').requestSubmit(); go('catalog'); !$('#cards img') && $('#cards').textContent.includes('<img src=x onerror=alert(1)>')")
    check('Ошибка Ollama видна и не меняет форму', "(async()=>{setRole('business'); editor(1); const before=JSON.stringify(readEditor()); $('#aiMode').value='ollama'; await questions(); return $('#aiStatus').textContent.includes('не подключена') && JSON.stringify(readEditor())===before && !$('#askAI').disabled;})()")
    check('OpenAI без ключа показывает настройку и не меняет карточку', "(async()=>{editor(1); const before=JSON.stringify(readEditor()); $('#aiMode').value='openai'; await questions(); return $('#aiStatus').textContent.includes('configure-openai.bat') && JSON.stringify(readEditor())===before && !$('#askAI').disabled;})()")
    cdp.evaluate("go('catalog'); location.reload()")
    time.sleep(.3)
    ready()
    check('После перезагрузки задачи, рейтинг и выполненный отклик сохранены', "tasks.length===7 && model.task(1).score===95 && offers.at(-1).status==='Выполнено' && offers.at(-1).mine")
    cdp.call('Emulation.setDeviceMetricsOverride', {'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    check('Мобильный каталог без горизонтального переполнения', 'document.documentElement.scrollWidth <= window.innerWidth')
    check('Мобильное меню занимает отдельную строку', "$('#nav').getBoundingClientRect().width > 300 && $('#nav').getBoundingClientRect().top >= $('#account').getBoundingClientRect().bottom")
    screenshot('qalam-integrated-mobile.png')
    exceptions = [e for e in cdp.events if e.get('method')=='Runtime.exceptionThrown']
    assert not exceptions, exceptions
    print(json.dumps({'passed':len(report),'failed':0,'runtimeErrors':len(exceptions)},ensure_ascii=True))
finally:
    (OUT / 'browser-test-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    try: cdp.call('Browser.close')
    except Exception: pass
    try: process.wait(timeout=3)
    except subprocess.TimeoutExpired: process.terminate()
