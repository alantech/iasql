CREATE
OR REPLACE FUNCTION check_subnets_by_service () RETURNS TRIGGER AS $check_subnets_by_service$
    DECLARE
        service_row record;
    BEGIN
        FOR service_row IN
            SELECT * FROM service
        LOOP
            IF OLD.subnet_id = any(service_row.subnets) THEN
                RAISE EXCEPTION 'subnet_id % is being used by service %', OLD.subnet_id, service_row.name;
            END IF;
        END LOOP;
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
$check_subnets_by_service$ LANGUAGE plpgsql;

-- TODO: Currently any subnet update means a replacement and this could get affected. Eventually update the 
-- trigger UPDATE OF property with the replacement fields
CREATE TRIGGER
  check_subnets_by_service BEFORE DELETE
  OR
UPDATE
  ON subnet FOR EACH ROW
EXECUTE
  FUNCTION check_subnets_by_service ();

-- Disable region changes
CREATE
OR REPLACE FUNCTION block_ecs_cluster_region_update () RETURNS TRIGGER AS $block_ecs_cluster_region_update$
    BEGIN
        RAISE EXCEPTION 'ECS Cluster region cannot be modified'
        USING detail = 'An ECS cluster cannot be moved to another region', 
        hint = 'If you want to change the cluster region, first remove it and recreate in the desired region.';
        RETURN OLD;
    END;
$block_ecs_cluster_region_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_ecs_cluster_region_update BEFORE
UPDATE
  ON "cluster" FOR EACH ROW
  WHEN (
    OLD.region IS DISTINCT
    FROM
      NEW.region
  )
EXECUTE
  FUNCTION block_ecs_cluster_region_update ();

CREATE
OR REPLACE FUNCTION block_ecs_service_region_update () RETURNS TRIGGER AS $block_ecs_service_region_update$
    BEGIN
        RAISE EXCEPTION 'ECS Service region cannot be modified'
        USING detail = 'An ECS service cannot be moved to another region', 
        hint = 'If you want to change the service region, first remove it and recreate in the desired region.';
        RETURN OLD;
    END;
$block_ecs_service_region_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_ecs_service_region_update BEFORE
UPDATE
  ON service FOR EACH ROW
  WHEN (
    OLD.region IS DISTINCT
    FROM
      NEW.region
  )
EXECUTE
  FUNCTION block_ecs_service_region_update ();

CREATE
OR REPLACE FUNCTION block_ecs_task_definition_region_update () RETURNS TRIGGER AS $block_ecs_task_definition_region_update$
    BEGIN
        RAISE EXCEPTION 'ECS Task Definition region cannot be modified'
        USING detail = 'An ECS Task Definition cannot be moved to another region', 
        hint = 'If you want to change the Task Definition region, first remove it and recreate in the desired region.';
        RETURN OLD;
    END;
$block_ecs_task_definition_region_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_ecs_task_definition_region_update BEFORE
UPDATE
  ON task_definition FOR EACH ROW
  WHEN (
    OLD.region IS DISTINCT
    FROM
      NEW.region
  )
EXECUTE
  FUNCTION block_ecs_task_definition_region_update ();

CREATE
OR REPLACE FUNCTION block_ecs_container_definition_region_update () RETURNS TRIGGER AS $block_ecs_container_definition_region_update$
    BEGIN
        RAISE EXCEPTION 'ECS Container Definition region cannot be modified'
        USING detail = 'An ECS Container Definition cannot be moved to another region', 
        hint = 'If you want to change the Container Definition region, first remove it and recreate in the desired region.';
        RETURN OLD;
    END;
$block_ecs_container_definition_region_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_ecs_container_definition_region_update BEFORE
UPDATE
  ON container_definition FOR EACH ROW
  WHEN (
    OLD.region IS DISTINCT
    FROM
      NEW.region
  )
EXECUTE
  FUNCTION block_ecs_container_definition_region_update ();
