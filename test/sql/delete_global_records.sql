DO $$
DECLARE
BEGIN
  EXECUTE 'DELETE FROM public_repository;';
  EXECUTE 'DELETE FROM role;';
END;
$$;