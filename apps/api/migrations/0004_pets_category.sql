-- Pets joins the closed Category set (ADR-0004). It sits before Other, which
-- stays last; ids are stable, so existing Expenses keep their Category.

UPDATE category SET sort_order = 12 WHERE id = 11;

INSERT INTO category (id, name, sort_order) VALUES (12, 'Pets', 11);
