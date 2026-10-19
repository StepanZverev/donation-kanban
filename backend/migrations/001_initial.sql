-- Первая миграция: все таблицы приложения, какими они были при переезде на PostgreSQL.
--
-- Как устроены миграции: каждый файл в этой папке — шаг, который меняет базу
-- (добавляет таблицу, поле и т. п.). Файлы выполняются по порядку номеров,
-- каждый ровно один раз; какие уже выполнены, записано в таблице schema_migrations.
-- Уже выполненный файл не меняем: чтобы что-то поменять, пишем новый, 002_….sql.
--
-- Время везде хранится строкой в формате ISO ('2026-10-12T11:52:48.123+00:00'),
-- как и раньше в SQLite: такие строки сравниваются и сортируются как время.

-- Пользователи. Сначала каждый — гость: строка в users есть,
-- а способов входа (user_logins) нет. Подключил DonationAlerts — появился способ входа.
CREATE TABLE users (
    id           SERIAL PRIMARY KEY,
    name         TEXT,                                  -- имя из DonationAlerts; у гостя пусто
    avatar_url   TEXT,
    created_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL                          -- когда последний раз открывал сайт
);

-- Чем человек входит: donationalerts (позже можно добавить twitch и другие).
-- Один аккаунт DonationAlerts принадлежит только одному пользователю.
CREATE TABLE user_logins (
    provider         TEXT    NOT NULL,                  -- donationalerts
    provider_user_id TEXT    NOT NULL,                  -- id пользователя в этом сервисе
    user_id          INTEGER NOT NULL REFERENCES users (id),
    created_at       TEXT    NOT NULL,
    PRIMARY KEY (provider, provider_user_id)
);

-- Сессии: по ним бэкенд узнаёт, кто пришёл. Браузер хранит токен в cookie,
-- а мы — только его хэш, чтобы утечка базы не позволила войти чужим токеном.
CREATE TABLE sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id),
    created_at TEXT    NOT NULL,
    expires_at TEXT    NOT NULL
);

-- Доски. У каждого пользователя своя доска, в ней свои колонки, карточки и настройки
-- (поле board_id в таблицах ниже говорит, какой доске принадлежит строка).
CREATE TABLE boards (
    id         SERIAL PRIMARY KEY,
    owner_id   INTEGER REFERENCES users (id),          -- чья доска; пусто — доска без хозяина
    created_at TEXT NOT NULL
);

-- Настройки доски «ключ — значение»: уровни, автообъединение, приём заказов и т. п.
CREATE TABLE board_settings (
    board_id INTEGER NOT NULL REFERENCES boards (id),
    key      TEXT    NOT NULL,
    value    TEXT    NOT NULL,
    PRIMARY KEY (board_id, key)
);

-- Колонки доски. Их три вида (поле kind):
--   incoming — «Очередь», куда падают новые донаты (всегда одна, крайняя левая);
--   work     — промежуточные колонки, например «В работе» (их может быть несколько);
--   done     — «Выполнено» (всегда одна, крайняя правая).
CREATE TABLE board_columns (
    id       SERIAL PRIMARY KEY,
    board_id INTEGER REFERENCES boards (id),
    title    TEXT    NOT NULL,
    kind     TEXT    NOT NULL,                          -- incoming | work | done
    position INTEGER NOT NULL DEFAULT 0                 -- порядок слева направо
);
CREATE INDEX board_columns_board ON board_columns (board_id);

-- Карточки: и те, что на доске, и история.
-- Если archived_at пустой (NULL) — карточка на доске, в колонке column_id.
-- Если заполнен — карточка в истории.
-- DOUBLE PRECISION — дробное число (в PostgreSQL REAL менее точный, поэтому не он).
-- BIGINT — большое целое: id донатов в DonationAlerts могут не влезть в обычный INTEGER.
CREATE TABLE cards (
    id              SERIAL PRIMARY KEY,
    board_id        INTEGER REFERENCES boards (id),
    title           TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    column_id       INTEGER REFERENCES board_columns (id),
    source          TEXT    NOT NULL DEFAULT 'manual',  -- manual | donationalerts
    donation_id     BIGINT  UNIQUE,                     -- id доната в DonationAlerts, защищает от дублей
    donor_name      TEXT,
    amount          DOUBLE PRECISION,                   -- сумма в валюте донатера
    currency        TEXT,
    streamer_amount DOUBLE PRECISION,                   -- та же сумма в валюте стримера, по ней сортируем
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    moved_at        TEXT    NOT NULL,                   -- когда карточка попала в текущую колонку
    archived_at     TEXT,                               -- когда убрали с доски в историю
    archive_reason  TEXT,                               -- done | deleted | merged | rejected
    archive_note    TEXT,                               -- пояснение к пометке, например причина отказа
    merge_count     INTEGER NOT NULL DEFAULT 1,         -- сколько донатов слито в карточку (1 — не объединена)
    merged_into_id  INTEGER                             -- в какую карточку слили эту (если reason = merged)
);
CREATE INDEX cards_board ON cards (board_id);

-- Подключения DonationAlerts: у каждого стримера свои токены.
-- Донаты из подключения падают на доску этого пользователя.
CREATE TABLE da_connections (
    user_id          INTEGER PRIMARY KEY REFERENCES users (id),
    access_token     TEXT    NOT NULL,
    refresh_token    TEXT,
    last_donation_id BIGINT  NOT NULL DEFAULT 0,        -- самый новый донат, который уже видели
    created_at       TEXT    NOT NULL
);

-- Модераторы досок: кто ещё, кроме хозяина (boards.owner_id), может работать с доской.
-- role пока одна — moderator: двигать, править и убирать карточки, но не трогать настройки.
CREATE TABLE board_members (
    board_id   INTEGER NOT NULL REFERENCES boards (id),
    user_id    INTEGER NOT NULL REFERENCES users (id),
    role       TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    nickname   TEXT,                                    -- как модератор представился, когда принимал приглашение
    PRIMARY KEY (board_id, user_id)
);

