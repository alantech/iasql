CREATE
OR REPLACE FUNCTION block_codepipeline_primary_key_update () RETURNS TRIGGER AS $block_codepipeline_primary_key_update$
    BEGIN
        RAISE EXCEPTION 'Pipeline name or region cannot be modified'
        USING detail = 'A pipeline cannot be renamed or moved to another region', 
        hint = 'If you want to rename or change pipeline region, first remove it and recreate with the desired name and region.';
        RETURN OLD;
    END;
$block_codepipeline_primary_key_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_codepipeline_primary_key_update BEFORE
UPDATE
  ON pipeline_declaration FOR EACH ROW WHEN (
    OLD.name IS DISTINCT
    FROM
      NEW.name
      OR OLD.region IS DISTINCT
    FROM
      NEW.region
  )
EXECUTE
  FUNCTION block_codepipeline_primary_key_update ();
