-- The agent sometimes wrote the word "null" (or blank text) as a merchant or
-- note, and cards showed it. propose_expense and update_draft now store NULL
-- for those; this clears the rows written before that.

UPDATE expense
SET merchant = NULL
WHERE merchant IS NOT NULL
  AND lower(trim(merchant)) IN ('', 'null', 'none', 'undefined', 'n/a', '-');

UPDATE expense
SET note = NULL
WHERE note IS NOT NULL
  AND lower(trim(note)) IN ('', 'null', 'none', 'undefined', 'n/a', '-');
