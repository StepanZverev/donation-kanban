-- Схема старой базы SQLite (до этапа 7). Нужна только тесту переноса данных (test_import_sqlite.py).
CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   INTEGER REFERENCES users (id),       -- чья доска; пусто — старая доска, хозяина ещё нет
    created_at TEXT    NOT NULL
);

-- Настройки доски «ключ — значение»: уровни, автообъединение, приём заказов и т. п.
CREATE TABLE IF NOT EXISTS board_settings (
    board_id INTEGER NOT NULL REFERENCES boards (id),
    key      TEXT    NOT NULL,
    value    TEXT    NOT NULL,
    PRIMARY KEY (board_id, key)
);

CREATE TABLE IF NOT EXISTS board_columns (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER REFERENCES boards (id),
    title    TEXT    NOT NULL,
    kind     TEXT    NOT NULL,              -- incoming | work | done
    position INTEGER NOT NULL DEFAULT 0     -- порядок слева направо
);

CREATE TABLE IF NOT EXISTS cards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id        INTEGER REFERENCES boards (id),
    title           TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    column_id       INTEGER REFERENCES board_columns (id),
    source          TEXT    NOT NULL DEFAULT 'manual',  -- manual | donationalerts
    donation_id     INTEGER UNIQUE,                     -- id доната в DonationAlerts, защищает от дублей
    donor_name      TEXT,
    amount          REAL,                               -- сумма в валюте донатера
    currency        TEXT,
    streamer_amount REAL,                               -- та же сумма в валюте стримера, по ней сортируем
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    moved_at        TEXT    NOT NULL,                   -- когда карточка попала в текущую колонку
    archived_at     TEXT,                               -- когда убрали с доски в историю
    archive_reason  TEXT,                               -- done | deleted | merged | rejected
    archive_note    TEXT,                               -- пояснение к пометке, например причина отказа
    merge_count     INTEGER NOT NULL DEFAULT 1,         -- сколько донатов слито в карточку (1 — не объединена)
    merged_into_id  INTEGER                             -- в какую карточку слили эту (если reason = merged)
);

-- Пользователи. Сначала каждый — гость: строка в users есть,
-- а способов входа (user_logins) нет. Подключил DonationAlerts — появился способ входа.
CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT,                                  -- имя из DonationAlerts; у гостя пусто
    avatar_url   TEXT,
    created_at   TEXT    NOT NULL,
    last_seen_at TEXT    NOT NULL                       -- когда последний раз открывал сайт
);

-- Чем человек входит: donationalerts (позже можно добавить twitch и другие).
-- Один аккаунт DonationAlerts принадлежит только одному пользователю.
CREATE TABLE IF NOT EXISTS user_logins (
    provider         TEXT    NOT NULL,                  -- donationalerts
    provider_user_id TEXT    NOT NULL,                  -- id пользователя в этом сервисе
    user_id          INTEGER NOT NULL REFERENCES users (id),
    created_at       TEXT    NOT NULL,
    PRIMARY KEY (provider, provider_user_id)
);

-- Сессии: по ним бэкенд узнаёт, кто пришёл. Браузер хранит токен в cookie,
-- а мы — только его хэш, чтобы утечка базы не позволила войти чужим токеном.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id),
    created_at TEXT    NOT NULL,
    expires_at TEXT    NOT NULL
);

-- Подключения DonationAlerts: у каждого стримера свои токены.
-- Донаты из подключения падают на доску этого пользователя.
CREATE TABLE IF NOT EXISTS da_connections (
    user_id          INTEGER PRIMARY KEY REFERENCES users (id),
    access_token     TEXT    NOT NULL,
    refresh_token    TEXT,
    last_donation_id INTEGER NOT NULL DEFAULT 0,       -- самый новый донат, который уже видели
    created_at       TEXT    NOT NULL
);

-- Модераторы досок: кто ещё, кроме хозяина (boards.owner_id), может работать с доской.
-- role пока одна — moderator: двигать, править и убирать карточки, но не трогать настройки.
CREATE TABLE IF NOT EXISTS board_members (
    board_id   INTEGER NOT NULL REFERENCES boards (id),
    user_id    INTEGER NOT NULL REFERENCES users (id),
    role       TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    -- Как модератор представился, когда принимал приглашение (может быть пусто)
    nickname   TEXT,
    PRIMARY KEY (board_id, user_id)
);

-- Простое хранилище «ключ — значение» для служебных данных всего сервера.
-- Настройки конкретной доски — в board_settings.
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
