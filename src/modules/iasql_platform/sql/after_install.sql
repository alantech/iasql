 -- ALTER DEFAULT PRIVILEGES allows you to set the privileges that will be applied to objects created in the future. (https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)
ALTER DEFAULT PRIVILEGES
  FOR USER CURRENT_USER IN SCHEMA public
GRANT
SELECT
,
  INSERT,
UPDATE
,
  DELETE ON TABLES TO PUBLIC;

ALTER DEFAULT PRIVILEGES
  FOR USER CURRENT_USER IN SCHEMA public
GRANT
EXECUTE
  ON FUNCTIONS TO PUBLIC;

ALTER DEFAULT PRIVILEGES
  FOR USER CURRENT_USER IN SCHEMA public
GRANT
  USAGE,
SELECT
  ON SEQUENCES TO PUBLIC;

-- Just GRANT SELECT privilege for iasql_platform tables
GRANT
SELECT
  ON iasql_module,
  iasql_tables,
  iasql_audit_log TO PUBLIC;
