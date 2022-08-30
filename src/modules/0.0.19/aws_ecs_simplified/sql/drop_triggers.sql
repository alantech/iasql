DROP TRIGGER insert_ecs_simplified_trigger ON ecs_simplified;
DROP FUNCTION insert_ecs_simplified_trigger;
DROP FUNCTION insert_ecs_simplified;

DROP TRIGGER delete_ecs_simplified_trigger ON ecs_simplified;
DROP FUNCTION delete_ecs_simplified_trigger;
DROP FUNCTION delete_ecs_simplified;

DROP TRIGGER update_ecs_simplified_trigger ON ecs_simplified;
DROP FUNCTION update_ecs_simplified_trigger;

DROP TRIGGER ecs_simplified_service_trigger ON service;
DROP FUNCTION sync_ecs_simplified;

DROP FUNCTION get_mem_from_cpu_mem_enum;
DROP FUNCTION get_cpu_mem_enum_from_parts;