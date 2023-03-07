CREATE
OR REPLACE FUNCTION block_private_repository_region_update () RETURNS TRIGGER AS $block_private_repository_region_update$
    BEGIN
        RAISE EXCEPTION 'Region cannot be modified'
        USING detail = 'A repository image cannot be moved to another region', 
        hint = 'If you want to move a repository to another region, you can create a new one with the same name in that region or you can delete all images and then move it.';
        RETURN OLD;
    END;
$block_private_repository_region_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_private_repository_region_update BEFORE
UPDATE
  ON repository_image FOR EACH ROW WHEN (
    OLD.private_repository_region IS DISTINCT
    FROM
      NEW.private_repository_region
  )
EXECUTE
  FUNCTION block_private_repository_region_update ();
