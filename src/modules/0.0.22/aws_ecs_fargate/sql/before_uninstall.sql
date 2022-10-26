DROP TRIGGER
  IF EXISTS check_subnets_by_service ON subnet;

DROP FUNCTION
  "check_subnets_by_service";

DROP TRIGGER
  IF EXISTS block_ecs_cluster_region_update ON "cluster";

DROP FUNCTION
  "block_ecs_cluster_region_update";

DROP TRIGGER
  IF EXISTS block_ecs_service_region_update ON service;

DROP FUNCTION
  "block_ecs_service_region_update";

DROP TRIGGER
  IF EXISTS block_ecs_task_definition_region_update ON task_definition;

DROP FUNCTION
  "block_ecs_task_definition_region_update";

DROP TRIGGER
  IF EXISTS block_ecs_container_definition_region_update ON container_definition;

DROP FUNCTION
  "block_ecs_container_definition_region_update";
