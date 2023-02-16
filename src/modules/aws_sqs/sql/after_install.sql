CREATE FUNCTION
  before_queue_insert_update () RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
    -- can't create a non-fifo queue ending with .fifo and vice-versa
    IF (NEW.name NOT LIKE '%.fifo') AND (NEW.fifo_queue) THEN
        RAISE EXCEPTION 'The name of a fifo queue should end with .fifo';
    END IF;
    IF (NEW.name LIKE '%.fifo') AND (NOT NEW.fifo_queue) THEN
        RAISE EXCEPTION 'Non-fifo queue name should not end with .fifo';
    END IF;
    RETURN NEW;
END ;
$$;

CREATE TRIGGER
  before_queue_insert_update BEFORE INSERT
  OR
UPDATE
  ON queue FOR EACH ROW
EXECUTE
  FUNCTION before_queue_insert_update ();
