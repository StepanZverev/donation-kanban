-- Отдельная база для тестов (pytest): тесты очищают её перед каждым тестом,
-- поэтому настоящие данные в основной базе donation_kanban не трогаются.
CREATE DATABASE donation_kanban_test OWNER donation_kanban;
