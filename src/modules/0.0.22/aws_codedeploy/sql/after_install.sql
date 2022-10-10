 -- prevents update on revision table
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

-- prevents deletion on revision table
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

-- prevents deletion on deployment table
CREATE
OR REPLACE FUNCTION block_codedeploy_deployment_delete_function () RETURNS TRIGGER AS $block_codedeploy_deployment_delete_function$
    BEGIN
        RAISE EXCEPTION 'Deployment cannot be deleted'
        USING detail = 'Deployments can only be added';
        RETURN OLD;
    END;
$block_codedeploy_deployment_delete_function$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_codedeploy_deployment_delete_trigger BEFORE DELETE ON codedeploy_deployment
EXECUTE
  FUNCTION block_codedeploy_deployment_delete_function ();

-- procedures to drop and readd rules
CREATE
OR REPLACE FUNCTION drop_all_codedeploy_rules () RETURNS TRIGGER LANGUAGE PLPGSQL AS $drop_all_codedeploy_rules$
BEGIN
  DROP TRIGGER IF EXISTS block_codedeploy_deployment_delete_trigger ON codedeploy_deployment;
  DROP TRIGGER IF EXISTS block_codedeploy_revision_delete_trigger ON codedeploy_revision;
  RETURN OLD;
END;
$drop_all_codedeploy_rules$;

CREATE
OR REPLACE FUNCTION readd_all_codedeploy_rules () RETURNS TRIGGER LANGUAGE PLPGSQL AS $readd_all_codedeploy_rules$
BEGIN
  CREATE TRIGGER
    block_codedeploy_deployment_delete_trigger BEFORE
  DELETE
    ON codedeploy_deployment
  EXECUTE
    FUNCTION block_codedeploy_deployment_delete_function ();

  CREATE TRIGGER
    block_codedeploy_revision_delete_trigger BEFORE
  DELETE
    ON codedeploy_revision
  EXECUTE
    FUNCTION block_codedeploy_revision_delete_function ();

  RETURN OLD;
END;
$readd_all_codedeploy_rules$;

-- triggers for before and after delete application
CREATE TRIGGER
  before_delete_codedeploy_application BEFORE DELETE ON codedeploy_application
EXECUTE
  FUNCTION drop_all_codedeploy_rules ();

CREATE TRIGGER
  after_delete_codedeploy_application
AFTER
  DELETE ON codedeploy_application
EXECUTE
  FUNCTION readd_all_codedeploy_rules ();

-- triggers for before and after delete deployment group
CREATE TRIGGER
  before_delete_codedeploy_deployment_group BEFORE DELETE ON codedeploy_deployment_group
EXECUTE
  FUNCTION drop_all_codedeploy_rules ();

CREATE TRIGGER
  after_delete_codedeploy_deployment_group
AFTER
  DELETE ON codedeploy_deployment_group
EXECUTE
  FUNCTION readd_all_codedeploy_rules ();

-- block updating revision on deployment column
CREATE
OR REPLACE FUNCTION block_update_on_deployment_revision () RETURNS TRIGGER LANGUAGE PLPGSQL AS $block_update_on_deployment_revision$
BEGIN
  IF NEW.revision_id <> OLD.revision_id THEN
      RAISE EXCEPTION 'Updating revisions on a deployment is not allowed';
   END IF;
   RETURN NEW;
END;
$block_update_on_deployment_revision$;

CREATE TRIGGER
  before_update_deployment BEFORE
UPDATE
  ON codedeploy_deployment FOR EACH ROW
EXECUTE
  FUNCTION block_update_on_deployment_revision ();

-- agent install
-- TODO: update code for next distros in the future
CREATE
OR REPLACE FUNCTION generate_codedeploy_agent_install_script (region TEXT, distro TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  CASE WHEN distro='ubuntu' THEN
    RETURN '#!/bin/bash
sudo apt update
sudo apt -y install ruby-full
sudo apt -y install wget
cd /home/ubuntu
wget https://aws-codedeploy-' || region || '.s3.' || region || '.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo service codedeploy-agent start';
  END case;
END;
$$;
