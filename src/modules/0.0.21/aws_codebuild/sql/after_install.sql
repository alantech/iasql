CREATE
OR REPLACE FUNCTION generate_put_ecr_image_build_spec (region TEXT, image_tag TEXT, repo_name TEXT, repo_uri TEXT, build_path TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'version: 0.2

  phases:
    pre_build:
      commands:
        - echo Logging in to Amazon ECR...
        - aws ecr get-login-password --region ' || region || ' | docker login --username AWS --password-stdin ' || repo_uri || '
    build:
      commands:
        - echo Building the Docker image...
        - docker build -t ' || repo_name || ' ' || build_path || '
        - docker tag ' || repo_name || ':' || image_tag || ' ' || repo_uri || ':latest
    post_build:
      commands:
        - echo Pushing the Docker image...
        - docker push ' || repo_uri || ':' || image_tag;
END
$$;
