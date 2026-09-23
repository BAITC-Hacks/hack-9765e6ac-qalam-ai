"""Interactive secret entry. Run locally; never paste the key into the chat."""
from getpass import getpass, GetPassWarning
import warnings
from ai_settings import save_openai


def main():
    print('OpenAI: подключение к Qalam AI')
    print('Создайте API-ключ в организации, где зачислены ваши кредиты:')
    print('https://platform.openai.com/api-keys')
    print('Ключ будет сохранён только в локальном .env; сервер не раздаёт этот файл.')
    print('Вставьте ключ и нажмите Enter. Символы ключа не отображаются.')
    # Fail closed rather than fall back to echoing secrets in a non-console session.
    with warnings.catch_warnings():
        warnings.simplefilter('error', GetPassWarning)
        key = getpass('API key: ').strip()
    save_openai(key)
    print('Ключ сохранён. Модель: gpt-4.1-mini.')
    print('На сайте выберите OpenAI — облачная модель и отправьте запрос.')
    print('Новый ключ подхватывается без перезапуска обновлённого сервера.')


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError, GetPassWarning):
        print('\nНастройка отменена. Запустите configure-openai.bat в обычном окне Windows.')
    except (OSError, ValueError):
        print('Не удалось сохранить ключ. Проверьте ввод и права записи в папку проекта.')
