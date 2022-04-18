DO $$
DECLARE
  loop_count integer := 0;
  tables_array_length integer;
  tables_array text[];
  aux_tables_array text[];
  aws_region text;
BEGIN
  SELECT region INTO aws_region FROM aws_account;
  SELECT ARRAY(SELECT "table" FROM iasql_tables) INTO tables_array;
  SELECT array_length(tables_array, 1) INTO tables_array_length;
  WHILE tables_array_length > 0 AND loop_count < 20 LOOP
    SELECT tables_array INTO aux_tables_array;
    FOR table_elem IN array_lower(aux_tables_array, 1)..array_upper(aux_tables_array, 1) LOOP
      BEGIN
        raise notice 'logging table %', aux_tables_array[table_elem];
        -- public_repository and role are special because they are region agnostic so we append a region to their names
        IF aux_tables_array[table_elem] = 'public_repository' THEN
          -- raise notice '%', format('DELETE FROM public_repository WHERE repository_name LIKE ''%s''', '%' || aws_region);
          EXECUTE format('DELETE FROM public_repository WHERE repository_name LIKE ''%s''', '%' || aws_region);
        ELSIF aux_tables_array[table_elem] = 'role' THEN
          -- raise notice '%', format('DELETE FROM role WHERE role_name LIKE ''%s''', '%' || aws_region);
          EXECUTE format('DELETE FROM role WHERE role_name LIKE ''%s''', '%' || aws_region);
        ELSIF aux_tables_array[table_elem] <> 'subnet' AND aux_tables_array[table_elem] <> 'vpc' THEN
          EXECUTE format('DELETE FROM %I', aux_tables_array[table_elem]);
        END IF;
        SELECT array_remove(tables_array, aux_tables_array[table_elem]) INTO tables_array;
      EXCEPTION
        WHEN others THEN
          -- we ignore the error
        END;
    END LOOP;
    SELECT array_length(tables_array, 1) INTO tables_array_length;
    loop_count := loop_count + 1;
  END LOOP;
END;
$$;