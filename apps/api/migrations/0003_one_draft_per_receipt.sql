-- One Receipt, one Draft (SPEC, out of scope: splitting a receipt). The agent
-- re-proposing from a Receipt updates the Draft that holds it, by upsert on
-- this index, rather than creating a second.

CREATE UNIQUE INDEX expense_receipt ON expense(receipt_key) WHERE receipt_key IS NOT NULL;
