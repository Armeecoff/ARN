# vless-updater

Каждый час выполняет четыре обновления в репозитории `Armeecoff/ARN`
(первый прогон — сразу при старте). Во всех файлах не трогаются первые
`HEADER_LINES` строк (заголовок/подписка) — заменяются только сами конфиги;
дополнительно в строке `#subscription-userinfo:` каждый раз к `upload` и
`download` добавляется одно и то же случайное значение от `TRAFFIC_BUMP_MIN_GB`
до `TRAFFIC_BUMP_MAX_GB` ГБ (по умолчанию 3-10 ГБ, у каждого файла — своё
случайное значение).

## ARN.txt / Basic (`jobs/basic.js`)

Берёт первые 4 конфига из `BASIC_SOURCE_URL` (по умолчанию — источник Pro,
igareck) и переименовывает все 4 в фиксированный тег `🇷🇺 Россия Ютуб`
(флаг всегда добавляется, независимо от исходного тега).

## ARN Pro.txt (`jobs/pro.js`)

Из `https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/Vless-Reality-White-Lists-Rus-Mobile.txt`
берёт конфиги на позициях 5, 13, 14-17, 22, 26-34, 40-43 (считая только строки
с конфигами, без учёта заголовка источника), определяет страну по тегу
источника и переименовывает во флаг + русское название страны (например
`🇩🇪 Germany` → `🇩🇪 Германия`). Список стран для перевода — в
`lib/countries.js`; при появлении новой страны, для которой перевода нет,
конфиг остаётся с исходным тегом и в лог пишется предупреждение.

## ARN ULTRA.txt (`jobs/ultra.js`)

Собирает конфиги из двух источников:

- `ULTRA_SOURCE_URL` (zieng2, `vless_universal.txt`): первые 15 конфигов
  всегда сохраняются, плюс конфиги на позициях 30-60 (нерандомно, без
  случайной выборки), всё это переименовывается по порядку в
  `🇷🇺 Россия БС — #N`.
- `ULTRA_EXTRA_SOURCE_URL` (по умолчанию — источник Pro, igareck): конфиги на
  позициях 1-3, 42-44, 49-50, 54-57, переименованные по той же
  флаг-логике, что и в Pro.js.

## ARN Multi.txt (`jobs/multi.js`)

Пересобирает Basic + Pro + Ultra конфиги (используя ту же логику выбора и
переименования, что и их job-ы), сохраняет им названия и добавляет в конце
`(Basic)`, `(Pro)` или `(Ultra)` соответственно.

## Переменные окружения

| Переменная              | Обязательна | По умолчанию                                                                                                                |
| ------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`           | да          | —                                                                                                                            |
| `GITHUB_OWNER`           | нет         | `Armeecoff`                                                                                                                  |
| `GITHUB_REPO`            | нет         | `ARN`                                                                                                                        |
| `GITHUB_BRANCH`          | нет         | `main`                                                                                                                       |
| `HEADER_LINES`           | нет         | `6`                                                                                                                          |
| `BASIC_FILE_PATH`        | нет         | `ARN.txt`                                                                                                                    |
| `BASIC_SOURCE_URL`       | нет         | тот же адрес, что и `PRO_SOURCE_URL`                                                                                        |
| `PRO_FILE_PATH`          | нет         | `ARN Pro.txt`                                                                                                                |
| `PRO_SOURCE_URL`         | нет         | `https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/Vless-Reality-White-Lists-Rus-Mobile.txt` |
| `ULTRA_FILE_PATH`        | нет         | `ARN ULTRA.txt`                                                                                                              |
| `ULTRA_SOURCE_URL`       | нет         | `https://raw.githubusercontent.com/zieng2/wl/main/vless_universal.txt`                                                      |
| `ULTRA_EXTRA_SOURCE_URL` | нет         | тот же адрес, что и `PRO_SOURCE_URL`                                                                                         |
| `MULTI_FILE_PATH`        | нет         | `ARN Multi.txt`                                                                                                              |
| `TRAFFIC_BUMP_MIN_GB`    | нет         | `3`                                                                                                                          |
| `TRAFFIC_BUMP_MAX_GB`    | нет         | `10`                                                                                                                         |
| `CRON_SCHEDULE`          | нет         | `0 * * * *` (каждый час)                                                                                                    |

`GITHUB_TOKEN` — Personal Access Token (classic, scope `repo`) с правом
записи в `Armeecoff/ARN`.

## Локальный запуск

```bash
npm install
npm run once     # один прогон всех джобов без планировщика
npm start         # запуск с планировщиком (крутится вечно, обновляет раз в час)
```

## Деплой на Railway

1. Загрузите папку `vless-updater` в отдельный GitHub-репозиторий (или
   подключите этот проект напрямую).
2. В Railway создайте новый сервис из этого репозитория.
3. Start command: `npm start` (Railway подхватит его автоматически из
   `package.json`).
4. В Variables добавьте `GITHUB_TOKEN` (и остальные переменные при
   необходимости).
5. Деплой. Сервис будет работать постоянно и обновлять все 4 файла каждый час
   по cron `0 * * * *`. Первый прогон происходит сразу при старте сервиса.
