-- Индексы: оглавления, по которым база быстро находит нужные строки, а не перебирает всю таблицу.
-- Пока данных мало, разницы не видно, но после запуска таблицы будут расти.

-- Доска по секретной ссылке (для зрителей или приглашение модератора): ищем по ключу и значению
-- настройки. Запрос идёт на каждое открытие страницы зрителя.
CREATE INDEX board_settings_key_value ON board_settings (key, value);

-- Сессии пользователя (выход удаляет их все) и доски, где он модератор
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX board_members_user ON board_members (user_id);

-- Карточки, слитые в эту (для «Разъединить»)
CREATE INDEX cards_merged_into ON cards (merged_into_id);
