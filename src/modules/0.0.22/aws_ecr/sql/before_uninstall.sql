ALTER TABLE
  "repository_policy"
DROP
  CONSTRAINT "FK_repository_policy_region";

ALTER TABLE
  "repository"
DROP
  CONSTRAINT "FK_repository_region";

ALTER TABLE
  "repository_image"
DROP
  CONSTRAINT "FK_priv_repository_image_region";
