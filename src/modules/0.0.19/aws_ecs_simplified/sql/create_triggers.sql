-- ######################
-- INSERT ECS SIMPLIFIED
-- ######################

CREATE OR REPLACE FUNCTION get_mem_from_cpu_mem_enum(cpu_mem ecs_simplified_cpu_mem_enum)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
 mem TEXT;
BEGIN
  SELECT SPLIT_PART(SPLIT_PART(cpu_mem::TEXT, '-', 2), 'GB', 1) INTO mem;
  RETURN mem::NUMERIC * 1024;
END
$$;

CREATE OR REPLACE FUNCTION get_cpu_mem_enum_from_parts(cpu INTEGER, mem INTEGER)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  _cpu DECIMAL;
  _mem DECIMAL;
BEGIN
  _cpu = ROUND(GREATEST(COALESCE(cpu, 256), 256) / 1024.0, 2);
  _mem = ROUND(GREATEST(COALESCE(mem, 512), 256) / 1024.0, 2);
  RETURN 'vCPU' || RTRIM(_cpu::TEXT, '0') || '-' || RTRIM(_mem::TEXT, '0') || 'GB';
END
$$;

CREATE OR REPLACE FUNCTION insert_ecs_simplified(NEW RECORD)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  _security_group_id INTEGER;
BEGIN
  -- security groups
  INSERT INTO security_group (description, group_name)
  VALUES (NEW.app_name || ' security group', NEW.app_name || '-security-group')
  RETURNING id INTO _security_group_id;

  INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
  VALUES (false, 'tcp', NEW.app_port, NEW.app_port, '0.0.0.0/0', NEW.app_name || '-security-group', _security_group_id);

  INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
  VALUES (true, '-1', -1, -1, '0.0.0.0/0', NEW.app_name || '-security-group', _security_group_id);

  -- load balancer
  INSERT INTO target_group
    (target_group_name, target_type, protocol, port, health_check_path)
  VALUES
    (NEW.app_name || '-target', 'ip', 'HTTP', NEW.app_port, '/health');

  INSERT INTO load_balancer
    (load_balancer_name, scheme, load_balancer_type, ip_address_type)
  VALUES
    (NEW.app_name || '-load-balancer', 'internet-facing', 'application', 'ipv4');

  INSERT INTO load_balancer_security_groups
    (load_balancer_name, security_group_id)
  VALUES
    (NEW.app_name || '-load-balancer', _security_group_id);

  INSERT INTO listener
    (load_balancer_name, port, protocol, action_type, target_group_name)
  VALUES
    (NEW.app_name || '-load-balancer', NEW.app_port, 'HTTP', 'forward', NEW.app_name || '-target');

  -- setup ecs: cloudwatch + iam + ecr
  INSERT INTO log_group (log_group_name) VALUES (NEW.app_name || '-log-group');

  INSERT INTO cluster (cluster_name) VALUES(NEW.app_name || '-cluster');

  INSERT INTO role (role_name, assume_role_policy_document, attached_policies_arns)
  VALUES (NEW.app_name || '-ecs-task-exec-role', '{"Version":"2012-10-17","Statement":[{"Sid":"","Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}', array['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy']);

  INSERT INTO task_definition ("family", task_role_name, execution_role_name, cpu_memory)
  VALUES (NEW.app_name || '-td', NEW.app_name || '-ecs-task-exec-role', NEW.app_name || '-ecs-task-exec-role', NEW.cpu_mem::TEXT::task_definition_cpu_memory_enum);

  -- create a repository for it
  IF NEW.repository_uri IS NULL AND NEW.image_digest IS NULL THEN
    INSERT INTO repository (repository_name) VALUES (NEW.app_name || '-repository');
    -- fill in repository_name in container_definition
    INSERT INTO container_definition ("name", essential, repository_name, task_definition_id, memory_reservation, host_port, container_port, protocol, log_group_name, env_variables)
    VALUES (
      NEW.app_name || '-container', true,
      NEW.app_name || '-repository',
      (SELECT id FROM task_definition WHERE family = NEW.app_name || '-td' AND status IS NULL LIMIT 1), get_mem_from_cpu_mem_enum(NEW.cpu_mem), NEW.app_port, NEW.app_port, 'tcp', NEW.app_name || '-log-group', NEW.env_variables
    );
  ELSE
    -- fill in image, tag and digest in container_definition
    INSERT INTO container_definition ("name", essential, image, task_definition_id, tag, digest, memory_reservation, host_port, container_port, protocol, log_group_name, env_variables)
    VALUES (
      NEW.app_name || '-container', true,
      NEW.repository_uri,
      (SELECT id FROM task_definition WHERE family = NEW.app_name || '-td' AND status IS NULL LIMIT 1),
      NEW.image_tag, NEW.image_digest, get_mem_from_cpu_mem_enum(NEW.cpu_mem), NEW.app_port, NEW.app_port, 'tcp', NEW.app_name || '-log-group', NEW.env_variables
    );
  END IF;

  -- create ECS service and associate it to security group
  INSERT INTO service ("name", desired_count, subnets, assign_public_ip, cluster_name, task_definition_id, target_group_name, force_new_deployment)
  VALUES (
    NEW.app_name || '-service', NEW.desired_count, (SELECT ARRAY(SELECT subnet_id FROM subnet WHERE vpc_id = (SELECT id FROM vpc WHERE is_default = true LIMIT 1) LIMIT 3)), (CASE WHEN NEW.public_ip THEN 'ENABLED' ELSE 'DISABLED' END)::service_assign_public_ip_enum,
    NEW.app_name || '-cluster',
    (SELECT id FROM task_definition WHERE family = NEW.app_name || '-td' ORDER BY revision DESC LIMIT 1),
    NEW.app_name || '-target', NEW.force_new_deployment
  );

  INSERT INTO service_security_groups (service_name, security_group_id)
  VALUES (NEW.app_name || '-service', _security_group_id);
END
$$;

CREATE OR REPLACE FUNCTION insert_ecs_simplified_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_v RECORD;
BEGIN
  new_v = NEW;
  EXECUTE insert_ecs_simplified(new_v);
  RETURN NEW;
END
$$;

CREATE TRIGGER insert_ecs_simplified_trigger
AFTER INSERT ON ecs_simplified
FOR EACH ROW WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION insert_ecs_simplified_trigger();

-- ######################
-- DELETE ECS SIMPLIFIED
-- ######################
CREATE OR REPLACE FUNCTION delete_ecs_simplified(OLD RECORD)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- delete ECS service
  DELETE FROM service_security_groups
  WHERE service_name = OLD.app_name || '-service';

  DELETE FROM service
  WHERE name = OLD.app_name || '-service';

  -- delete ECS + ECR
  DELETE FROM container_definition
  USING task_definition
  WHERE container_definition.task_definition_id = task_definition.id AND task_definition.family = OLD.app_name || '-td';

  DELETE FROM task_definition WHERE family = OLD.app_name || '-td';

  DELETE FROM role WHERE role_name = OLD.app_name || '-ecs-task-exec-role';

  DELETE FROM cluster WHERE cluster_name = OLD.app_name || '-cluster';

  -- check if it is an image or we created a repository
  IF OLD.image_digest IS NULL THEN
    DELETE FROM repository WHERE repository_name = OLD.app_name || '-repository';
  END IF;

  DELETE FROM log_group WHERE log_group_name = OLD.app_name || '-log-group';

  -- delete ELB
  DELETE FROM listener
  WHERE load_balancer_name = OLD.app_name || '-load-balancer' AND target_group_name = OLD.app_name || '-target';

  DELETE FROM load_balancer_security_groups
  WHERE load_balancer_name = OLD.app_name || '-load-balancer';

  DELETE FROM load_balancer
  WHERE load_balancer_name = OLD.app_name || '-load-balancer';

  DELETE FROM target_group
  WHERE target_group_name = OLD.app_name || '-target';

  -- delete security groups
  DELETE FROM security_group_rule
  USING security_group
  WHERE security_group.id = security_group_rule.security_group_id AND security_group.group_name = OLD.app_name || '-security-group';

  DELETE FROM security_group WHERE group_name = OLD.app_name || '-security-group';
END
$$;

CREATE OR REPLACE FUNCTION delete_ecs_simplified_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  old_v RECORD;
BEGIN
  old_v = OLD;
  EXECUTE delete_ecs_simplified(old_v);
  RETURN OLD;
END
$$;

CREATE TRIGGER delete_ecs_simplified_trigger
BEFORE DELETE ON ecs_simplified
FOR EACH ROW WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION delete_ecs_simplified_trigger();

-- ######################
-- UPDATE ECS SIMPLIFIED
-- ######################
CREATE OR REPLACE FUNCTION update_ecs_simplified_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  old_v RECORD;
  new_v RECORD;
BEGIN
  old_v = OLD;
  new_v = NEW;
  EXECUTE delete_ecs_simplified(old_v);
  EXECUTE insert_ecs_simplified(new_v);
  RETURN NEW;
END
$$;

CREATE TRIGGER update_ecs_simplified_trigger
AFTER UPDATE ON ecs_simplified
FOR EACH ROW WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION update_ecs_simplified_trigger();

-- ##############################
-- SYNC ECS SIMPLIFIED
-- ##############################

CREATE OR REPLACE FUNCTION sync_ecs_simplified()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  is_valid BOOLEAN;
  _app_name TEXT;
  _app_port INTEGER;
  _target_group_name TEXT;
  _cluster_name TEXT;
  _desired_count INTEGER;
  _task_definition_id INTEGER;
  _image_tag TEXT;
  _image_digest TEXT;
  _public_ip BOOLEAN;
  _repository_uri TEXT;
  _log_group_name TEXT;
  _load_balancer_name TEXT;
  _repository_name TEXT;
  _load_balancer_dns TEXT;
  _service_name TEXT;
  _env_variables TEXT;
  _force_new_deployment BOOLEAN;
  _cpu_mem TEXT;
  _cpu INTEGER;
  _mem INTEGER;
  _security_group_id INTEGER;
BEGIN
  -- clear out the ecs_simplified table and completely recreate it so there is no logic specific to the table / trigger input and so that deletes work since this is an AFTER UPDATE/INSERT/DELETE trigger
  DELETE FROM ecs_simplified;
  FOR _service_name, _desired_count, _public_ip, _cluster_name, _target_group_name, _task_definition_id, _force_new_deployment IN
  SELECT name, desired_count, assign_public_ip = 'ENABLED', cluster_name, target_group_name, task_definition_id, force_new_deployment FROM service
  LOOP

    _app_name = SPLIT_PART(_service_name, '-', 1);

    SELECT port INTO _app_port
    FROM target_group
    WHERE target_group_name = _target_group_name AND target_type = 'ip' AND protocol = 'HTTP' AND health_check_path = '/health';

    SELECT security_group_id INTO _security_group_id
    FROM service_security_groups
    WHERE service_name = _service_name LIMIT 1;

    is_valid = _app_name IS NOT NULL AND _app_port IS NOT NULL AND _security_group_id IS NOT NULL;

    is_valid = is_valid AND 1 = (SELECT COUNT(*) FROM security_group_rule WHERE security_group_id = _security_group_id AND is_egress = false AND ip_protocol = 'tcp' AND from_port = _app_port AND to_port = _app_port AND cidr_ipv4 = '0.0.0.0/0');

    is_valid = is_valid AND 1 = (SELECT COUNT(*) FROM security_group_rule WHERE security_group_id = _security_group_id AND is_egress = true AND ip_protocol = '-1' AND from_port = -1 AND to_port = -1 AND cidr_ipv4 = '0.0.0.0/0');

    SELECT cpu_memory::TEXT
    INTO _cpu_mem
    FROM task_definition
    WHERE id = _task_definition_id AND execution_role_name = task_role_name;

    -- TODO get latest or sort ?
    SELECT tag, digest, repository_name, log_group_name, cpu, memory, image, env_variables
    INTO _image_tag, _image_digest, _repository_name, _log_group_name, _cpu, _mem, _repository_uri, _env_variables
    FROM container_definition
    WHERE task_definition_id = _task_definition_id AND host_port = _app_port AND container_port = _app_port AND essential = true LIMIT 1;

    IF _cpu_mem IS NULL THEN
      _cpu_mem = get_cpu_mem_enum_from_parts(_cpu, _mem);
    END IF;

    IF _repository_name IS NOT NULL THEN
      SELECT repository_uri INTO _repository_uri FROM repository WHERE repository_name = _repository_name;
    END IF;

    is_valid = is_valid AND 1 = (SELECT COUNT(*) FROM listener WHERE port = _app_port AND target_group_name = _target_group_name AND protocol = 'HTTP' AND action_type = 'forward');

    SELECT load_balancer_name INTO _load_balancer_name
    FROM listener
    WHERE port = _app_port AND target_group_name = _target_group_name;

    is_valid = is_valid AND 1 = (SELECT COUNT(*) FROM load_balancer WHERE load_balancer_name = _load_balancer_name AND scheme = 'internet-facing' AND load_balancer_type = 'application' AND ip_address_type = 'ipv4');

    is_valid = is_valid AND 1 = (SELECT COUNT(*) FROM load_balancer_security_groups WHERE load_balancer_name = _load_balancer_name AND security_group_id = _security_group_id);

    SELECT dns_name INTO _load_balancer_dns
    FROM load_balancer
    WHERE load_balancer_name = _load_balancer_name;

    IF is_valid THEN
      INSERT INTO ecs_simplified (app_name, desired_count, app_port, cpu_mem, image_tag, public_ip, load_balancer_dns, repository_uri, env_variables, force_new_deployment)
      VALUES (_app_name, _desired_count, _app_port, _cpu_mem::ecs_simplified_cpu_mem_enum, _image_tag, _public_ip, _load_balancer_dns, _repository_uri, _env_variables, _force_new_deployment);
    END IF;
  END LOOP;

  RETURN NULL;
END
$$;

CREATE TRIGGER ecs_simplified_service_trigger
AFTER INSERT OR DELETE OR UPDATE ON service
FOR EACH STATEMENT WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION sync_ecs_simplified();

-- This file runs after low-level/required ECS tables have been populated on install so to
-- properly import ecs_simplified on install we need trigger ecs_simplified_service_trigger with
-- a no-op update. This works since the trigger is `FOR EACH STATEMENT` and not `FOR EACH ROW`.
UPDATE service SET arn = 'noop' WHERE 1 != 1;