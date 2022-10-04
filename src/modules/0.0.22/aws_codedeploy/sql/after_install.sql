 -- prevents update on table
CREATE
OR REPLACE FUNCTION block_codedeploy_revision_update_function () RETURNS TRIGGER AS $block_codedeploy_revision_update_function$
    BEGIN
        RAISE EXCEPTION 'Revision cannot be modified'
        USING detail = 'Revisions can only be added';
        RETURN OLD;
    END;
$block_codedeploy_revision_update_function$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_codedeploy_revision_update_trigger BEFORE
UPDATE
  ON codedeploy_revision
EXECUTE
  FUNCTION block_codedeploy_revision_update_function ();

-- prevents deletion on table
CREATE
OR REPLACE FUNCTION block_codedeploy_revision_delete_function () RETURNS TRIGGER AS $block_codedeploy_revision_delete_function$
    BEGIN
        RAISE EXCEPTION 'Revision cannot be deleted'
        USING detail = 'Revisions can only be added';
        RETURN OLD;
    END;
$block_codedeploy_revision_delete_function$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_codedeploy_revision_delete_trigger BEFORE DELETE ON codedeploy_revision
EXECUTE
  FUNCTION block_codedeploy_revision_delete_function ();

-- drop trigger before cascade delete
CREATE
OR REPLACE FUNCTION drop_codedeploy_revision_rule () RETURNS TRIGGER LANGUAGE PLPGSQL AS $drop_codedeploy_revision_rule$
BEGIN
  DROP TRIGGER IF EXISTS block_codedeploy_revision_delete_trigger ON codedeploy_revision;
  RETURN OLD;
END;
$drop_codedeploy_revision_rule$;

-- readd rule after cascade delete
CREATE
OR REPLACE FUNCTION readd_codedeploy_revision_rule () RETURNS TRIGGER LANGUAGE PLPGSQL AS $readd_codedeploy_revision_rule$
BEGIN
  CREATE TRIGGER
    block_codedeploy_revision_delete_trigger BEFORE
  DELETE
    ON codedeploy_revision
  EXECUTE
    FUNCTION block_codedeploy_revision_delete_function ();

  RETURN OLD;
END;
$readd_codedeploy_revision_rule$;

-- triggers for before and after delete
CREATE TRIGGER
  before_delete_codedeploy_application BEFORE DELETE ON codedeploy_application
EXECUTE
  FUNCTION drop_codedeploy_revision_rule ();

CREATE TRIGGER
  after_delete_codedeploy_application
AFTER
  DELETE ON codedeploy_application
EXECUTE
  FUNCTION readd_codedeploy_revision_rule ();
