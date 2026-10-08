# Система оформления служебных поездок

Приложение для практических работ 5–8. React в Next.js, Express REST API, PostgreSQL, Redis для серверных сессий. Таблицы соответствуют скриншоту: users, roles, user_roles, departments, employees, trips, travel_requests, request_status_history, approval_steps, expense_categories, expense_estimates.

Отчёт и презентация не создаются. Здесь приложение, файлы запуска и техническая инструкция.

## Возможности

- Вход по email и паролю, проверка активности пользователя и профиля сотрудника.
- Создание и редактирование черновика, цель и сроки, транспорт, проживание, расходы.
- Подсчет estimated_total SQL-запросом в транзакции со строками расходов.
- Маршрут руководитель, затем бухгалтер. Самосогласование запрещено.
- Отклонение с причиной, завершение координатором.
- Список с фильтрами и пагинацией, карточка, шаги и история.
- Серверная валидация, права на каждую заявку, защита version от устаревших изменений.
- Docker, healthcheck, перезапуск, логи с request id, сохранение сессий в Redis.

## Подключение вашей базы

Скриншот не показывает все ограничения, defaults и допустимые статусы. Существующая БД автоматически не изменяется. `db/schema.sql` предназначен только для новой пустой учебной базы. При старте сервер проверяет наличие таблиц и столбцов.

1. Подготовьте Node.js 22+ и Redis.
2. Скопируйте `.env.example` в `.env`.
3. Заполните DATABASE_URL, DB_SCHEMA, REDIS_URL, случайный SESSION_SECRET (от 32 символов), APP_ORIGIN.
4. STATUS_* и STEP_* должны совпадать с CHECK/ENUM вашей БД. По умолчанию: draft, submitted, in_approval, approved, rejected, completed; шаги pending, approved, rejected.
5. roles.code: employee, manager, accountant, coordinator, admin. Пароли — bcrypt. У согласующих должны быть активные учетные записи и profiles в employees. expense_categories должен быть заполнен.

```powershell
npm install
npm run db:check
npm test
npm run dev
```

Интерфейс: http://localhost:3000. API: 127.0.0.1:3001. Next.js проксирует /api/* в Express. При использовании 127.0.0.1:3000 поменяйте APP_ORIGIN на тот же адрес.

`db:check` ничего не изменяет: выводит столбцы, типы и ограничения. Если PK не имеет identity/sequence или значения transport_type отличаются, SQL/API нужно адаптировать к фактическому DDL. Скриншот не подтверждает эти свойства.

## Пустое окружение Docker

Compose создает отдельную учебную БД и не подключается к вашей действующей базе.

1. Скопируйте .env.example в .env.
2. Задайте POSTGRES_PASSWORD, SESSION_SECRET, DEMO_PASSWORD (от 12 символов). Для пароля PostgreSQL в URI удобны случайные буквенно-цифровые символы, иначе нужен URL-encoding.
3. Задайте ALLOW_DEMO_BOOTSTRAP=true, APP_ORIGIN=http://localhost:3000.

```powershell
docker compose up -d --build
docker compose exec app node scripts/bootstrap.mjs
docker compose ps
```

Bootstrap отказывается работать, если таблицы содержат данные. Он создает только справочники и 5 учебных пользователей. Заявки вводятся через UI.

| Роль | Email |
| --- | --- |
| Сотрудник | employee@example.test |
| Руководитель | manager@example.test |
| Бухгалтер | accountant@example.test |
| Координатор | coordinator@example.test |
| Администратор | admin@example.test |

Пароль — ваше значение DEMO_PASSWORD. После загрузки верните ALLOW_DEMO_BOOTSTRAP=false. Bootstrap создает bcrypt с cost 12.

Для вашего PostgreSQL в Docker используйте compose.existing.yaml вместо основного Compose (инструкция ниже). Адрес PostgreSQL на Windows-хосте обычно host.docker.internal. Тестовый Docker PostgreSQL не является доказательством подключения к вашей текущей базе.

## Демонстрация сценария

1. Сотрудник создает заявку и минимум один расход; обновление страницы сохраняет данные.
2. Выбирает руководителя и бухгалтера, отправляет заявку.
3. Бухгалтер до решения руководителя не может согласовать.
4. Руководитель согласует, затем бухгалтер утверждает бюджет.
5. Координатор завершает поездку с комментарием.
6. Сотрудник просматривает историю. Для негативного сценария новая заявка отклоняется с причиной.

## API

| Метод | Путь | Операция |
| --- | --- | --- |
| GET | /api/health | PostgreSQL и Redis |
| POST | /api/auth/login | Вход |
| POST | /api/auth/logout | Выход |
| GET | /api/auth/me | Пользователь и статусы |
| GET | /api/lookups | Категории и согласующие |
| GET | /api/requests | Список, status/from/to/page |
| GET | /api/requests/:id | Карточка |
| POST | /api/requests | Новый черновик |
| PATCH | /api/requests/:id | Редактирование |
| POST | /api/requests/:id/submit | Маршрут согласования |
| POST | /api/requests/:id/decision | Решение |
| POST | /api/requests/:id/complete | Завершение |

Пример черновика:

```json
{
  "destination_country": "Россия",
  "destination_city": "Казань",
  "purpose": "Рабочая встреча с заказчиком",
  "start_date": "2026-10-20",
  "end_date": "2026-10-22",
  "transport_type": "rail",
  "accommodation_required": true,
  "currency": "RUB",
  "expenses": [{ "category_id": "1", "amount": "12500.10", "description": "Билеты" }]
}
```

Ответ 201: id и version. Id передается строкой, сумма десятичной строкой. В изменяющих запросах нужны version последней карточки, cookie сессии и Origin=APP_ORIGIN. При конфликте версии вернется 409. Ошибка: error и request_id.

## Практика 8 — перезапуск и отказ

В коде: HttpOnly/SameSite cookies, Redis sessions, проверка Origin, ограничение попыток входа, параметризованные SQL, лимит тела запроса, транзакции, журналы без пароля и токена. На хосте открыт только 127.0.0.1:3000. Redis и учебный PostgreSQL не публикуются.

Для внешнего доступа нужен HTTPS reverse proxy, COOKIE_SECURE=true и APP_ORIGIN с HTTPS. TRUST_PROXY=true используется только с контролируемым прокси.

```powershell
curl.exe -i http://localhost:3000/api/health
docker compose logs --tail=100 app
docker compose restart app
docker compose ps
curl.exe -i http://localhost:3000/api/health

# Только на учебном стенде
docker compose stop db
curl.exe -i http://localhost:3000/api/health
docker compose start db
curl.exe -i http://localhost:3000/api/health

# Без удаления данных
docker compose stop
docker compose start
```

При отказе БД ожидается 503, после восстановления 200. При необходимости повторного соединения перезапустите app. Docker healthcheck помечает контейнер unhealthy, но сам его не перезапускает. Restart policy действует при завершении процесса. Не выполняйте down -v, если нужно сохранить volumes.

Учебный PostgreSQL в Compose создается с владельцем trip_app для инициализации. Для существующих/реальных данных применяйте runtime-логин без DDL и отдельного владельца миграций. `db/runtime-grants.sql` содержит пример выдачи прав.

## Проверки и ограничения

`npm test` проверяет даты, точность сумм, отказ от устаревших версий и комментарии. Интеграционные тесты запускают HTTP API с изолированным PGlite и проверяют права, порядок шагов, rollback, историю, завершение, отклонение, CSRF и выход. Они не подключаются к вашей БД. Cost 4 используется только в тестовых хешах для скорости.

Фактическое прохождение сборки, тестов, Docker-перезапуска и отказа требуется подтвердить запуском. Не считайте наличие тестов результатом PASS. Скриншот не заменяет проверку на вашем PostgreSQL.

Координатор и администратор видят все заявки, остальные — собственные и назначенные им. Прямой руководитель подразделения не хранится в схеме скриншота, поэтому сотрудник выбирает активных согласующих нужной роли. Нет вложений и групповых поездок: в вашей схеме нет соответствующих таблиц.

| Практика | Файлы |
| --- | --- |
| 5 | package.json, app/, server/, .env.example |
| 6 | React-форма, API, PostgreSQL-транзакции, tests/ |
| 7 | Dockerfile, compose.yaml, compose.existing.yaml |
| 8 | Redis, cookies, логи, healthcheck, сценарии восстановления |

