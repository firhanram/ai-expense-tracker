-- A user message keeps the Receipt it was sent with, so the Chat still shows
-- the photo after a reload. Null for messages sent without one, and for every
-- message stored before this.

ALTER TABLE chat_message ADD COLUMN receipt_key TEXT;
