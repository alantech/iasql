CREATE FUNCTION
  before_queue_insert_update () RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
DECLARE
    _account_id VARCHAR;
BEGIN
    -- can't create a non-fifo queue ending with .fifo and vice-versa
    IF (NEW.name NOT LIKE '%.fifo') AND (NEW.fifo_queue) THEN
        RAISE EXCEPTION 'The name of a fifo queue should end with .fifo';
    END IF;
    IF (NEW.name LIKE '%.fifo') AND (NOT NEW.fifo_queue) THEN
        RAISE EXCEPTION 'Non-fifo queue name should not end with .fifo';
    END IF;
    -- create a policy if no policy is set
    IF NEW.policy IS NULL THEN
        SELECT invoke_sts('getCallerIdentity', '{}') ->> 'Account' INTO _account_id;
        -- Only the queue owner can send/receive message from this queue
        NEW.policy = '{
          "Version": "2008-10-17",
          "Id": "__default_policy_ID",
          "Statement": [
            {
              "Sid": "__owner_statement",
              "Effect": "Allow",
              "Principal": {
                "AWS": "' || (_account_id) || '"
              },
              "Action": [
                "SQS:*"
              ],
              "Resource": "arn:aws:sqs:' || NEW.region || ':' || _account_id || ':' || NEW.name || '"
            }
          ]
        }';
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
