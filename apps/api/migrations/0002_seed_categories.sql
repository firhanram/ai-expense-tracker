-- The closed Category set from ADR-0004. The order is also the chart colour
-- order, so `sort_order` is part of the seed. Adding a Category is a migration.

INSERT INTO category (id, name, sort_order) VALUES
  (1, 'Groceries', 1),
  (2, 'Dining', 2),
  (3, 'Transport', 3),
  (4, 'Utilities', 4),
  (5, 'Housing', 5),
  (6, 'Shopping', 6),
  (7, 'Health', 7),
  (8, 'Entertainment', 8),
  (9, 'Education', 9),
  (10, 'Giving & family', 10),
  (11, 'Other', 11);
