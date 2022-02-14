# IaSQL

<h2 align="center">
Infrastructure as SQL
</h2>

### Local Development

Set your .env file based on the values from `src/config.ts`, make sure docker is installed locally and then run

```
docker-compose up --build
```

which will bring up the postgres engine and node.js server.

### Local Testing

To run the integration tests locally make sure to set the following environment variables and run `yarn coverage:local`.
And make sure you set following environment variables.

```
DB_HOST=localhost
PORT=8088
SENTRY_ENABLED=false
IRONPLANS_TOKEN=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

To run a specific test file only, simply pass it as a parameter `yarn coverage:local test/modules/aws-cloudwatch-integration.ts`

### Integration tests CI/CD

#### Common integration

Common tests are inside `test/common/` directory. This tests run sequentially and they use the `Testing` account. To add a new test just create the file inside the common directory and it will run automatically.

#### Modules

Modules tests are inside `test/modules/` directory. Modules tests run in parallel with each other but sequentially within each module file and each use a specific account per module to avoid rate limits per account. To add a new test:

- Create the test file inside `test/modules`. The current pattern to name the file is `aws-<aws-service>-integration`.
- Create a new AWS account under the `iasql` organization:
  
  - Add account following the same pattern for the name `aws-<aws-service>-integration` and the email `dev+aws-<aws-service>-integration`.
  - Move the account to the Integration testing organization Unit. This way all the resources created by these accounts will be isolated and unrrelated to the other environments.
  - Reset password for the account
  - Generate account credentials

- Save account credentials as Github actions secret. The name of the secrets should follow the pattern:
  
  - `AWS_ACCESS_KEY_ID_<name of the test file in uppercase and replacing - with _>`
  - `AWS_SECRET_ACCESS_KEY_<name of the test file in uppercase and replacing - with _>`

- Run the tests. It will parallelize the test file and use the new credentials automatically.

### Module Development

Instead of a centralized linear list of migrations, we have a module-based approach to allow different collections of tables to be inserted or removed as desired by the end users. These modules need to declare what modules they depend on and what resources (tables, stored procedures, etc) they depend on.

Development of a new module is expected to follow this pattern:

1. Create the module directory, and create `entity` and `migration` directories inside of it.
2. Create the entity or entities in the `entity` directory and export them all from the `index.ts` file (or just define them in there).
3. Run the `yarn gen-module my_new_module_name` script and have it generate the migration file. (`my_new_module_name` needs to match the directory name for the module in question.)
4. Write the module's `index.ts` file. It must implement the `MapperInterface` inside of `modules/interfaces.ts`, which also requires importing and constructing `Mapper` and `Crud` objects. The auto-generated migration files can be imported and attached as appropriate. Generally `up` is attached to `postinstall` and `down` is attached to `preremove`. The other migration hooks are for more complex situations.

Development of an existing module is expected to follow this pattern:

1. Remove the entities and migrations of the dependent modules, if any.
2. Remove the migration of the module you are trying to modify and comment out the usage of this migration in the module index file.
3. Make the changes to the entities that you want to make.
4. Run the `yarn gen-module my_existing_module_name` script and have it generate a new migration file. (`my_existing_module_name` needs to match the directory name for the module in question.)
5. Attach the new migration file to the index file and git restore dependent modules.

Currently the modules do not support versioning. This documentation will be updated when that is no longer true.

#### Migrations

This part is modeled partly on Debian packages, and partly on Node packages. (It's mostly the completeness of options that are taken from Node). There are four kinds of events encoded in this: upgrade, downgrade, install, and remove.

Upgrade and Downgrade are when the module is already installed and the version is being changed. Install is when the module is not present and the version in question is being added, and Remove is for getting rid of the module.

The Pre- and Post- prefixes on these events are for the ordering that it will be called in relation to any dependencies that also need to have a migration run. The Pre- prefix means that it will run *before* all of its dependencies' runs, and the Post- prefix for *after* all of its dependencies have run. (Like the double-bubbling in the browser event system, btw.) Essentially this means that the dependency tree is linearized twice, first with the leaf nodes being earlier in the list for all of the Pre- migrations to be run, then with the root nodes being earlier in the list for all of the Post- migrations.

In general, `install` and `remove` will almost always use only `postinstall` and `preremove`. Why? When installing, you wait for the schemas for your dependencies to be set up, then you run your own schema and attach the foreign key references from them to your own table(s), and when you're removing, you need to remove your foreign key references and your tables before your dependencies can be properly cleaned up.

For `upgrade` and `downgrade`, though, it's likely that both `pre` and `post` will be used in both directions when they are used. Why? If you're upgrading your library and also upgrading the dependency version at the same time, if any columns you are attached to are changing or are being removed, you need to run a migration before they are upgraded to detach your foreign key(s) from them, and then after they are done you need to run a migration to re-attach to (or otherwise deal with) the new schema.

### Architecture

This is a quick note on the general architecture we're thinking of taking. It will evolve over time and we'll replace this short blurb with something more formal later on.

#### This is an eventually-consistent design where the SQL tables are the source of truth.

This means that the state that users create in the SQL tables is what things will be pushed towards, *not* reading the state from the cloud and exposing it to end users for querying. It's eventually consistent so multiple changes can be queued up without latency on the user's side and any difference between reality and what's in the tables will be treated as an issue to be corrected and a cloud migration to perform.

There are a couple of places (like security group IDs) where we can't avoid the ID being generated by the cloud instead of ourselves within postgres. These will need to be nullable columns that we eventually fill in once the security group is created during the creation process. Similarly, things that depend on other things with nullable columns will fail if that column is still null, so `is not null` checks should be included in the queries involving them, though this isn't a hard requirement, as it being null will just cause the API call to fail (but better to not do that when we know it won't work in the first place).

#### Impedance mismatch between APIs and SQL Schemas should be minimized

This means the tables should be detail-oriented, not high-level, so every little property can be represented appropriately. Parts of an API that allow a variable number of inputs imply a separate table and likely a join table in between. This can make some things very complicated to express and we should create views and stored procedures to help out here.

#### Users get their own "database" inside of our database

Currently thinking that each cluster should be treated as a specially-named database that we then run a `.sql` template to create the required tables, and then give the users access to that database with write permission (and new table creation, but somehow block deletion or alteration of the templated tables, if possible). At first these could all be inside of a single RDS instance (so we get snapshotting "for free") and later on we could shard by database name, so we stay horizontally scalable.

This is assuming no one user is able to overload the Postgres database. We may need to isolate an RDS instance per user if that is not the case, but I cannot imagine how you would do that with a database to manage your infrastructure?

We can then make the job to poll the various databases an actual cron job and then schedule work for any database that has a difference between representation and reality. For now we can just manually trigger that per database name with a simple `/check/<dbname>` HTTP request on our test server, which gives us the added benefit of being able to pause changes to our test AWS accounts if/when it doesn't do what we expected and we want to figure out why.

The actual execution requires access to credentials. While we're testing we can just use the local credentials on our machines, but in reality, we'll need to use something like the AWS Secrets Manager to hold on to them. Later on we may make our own "vault" service to tackle this problem because that service gets expensive fast, especially with how we're proposing to use it.

### Beta IaSQL-on-IaSQL

##### Pre-requisites

  - Engine running locally
  - Have your organization credentials under the `iasql` AWS profile
  - Add a DB called `iasql` using organization credentials
  - Add the following modules to the added `iasql` DB:
    -  aws_cloudwatch
    -  aws_ecr
    -  aws_ecs
    -  aws_elb
    -  aws_rds
    -  aws_security_group
  - `.deploy-env` environment file defined with the following variables:
    - PGPASSWORD
    - DB_PASSWORD
    - IRONPLANS_TOKEN

#### First-Time deployment

##### Prepare iasql-on-iasql.sql script

This step creates an untracked iasql-on-iasql.out.sql script with the credentials replaced based on environment variables values.

```sh
export $(cat .deploy-env | xargs) && sed "s/<DB_PASSWORD>/${DB_PASSWORD}/g;s/<IRONPLANS_TOKEN>/${IRONPLANS_TOKEN}/g" ./src/script/iasql-on-iasql.sql > ./src/script/iasql-on-iasql.out.sql
```

##### Execute sql script.

This script make all the inserts necessary for iasql.

```sh
psql -h localhost -p 5432 -U postgres -d iasql -f ./src/script/iasql-on-iasql.out.sql
```

##### Apply db changes. (Using the local instance running)

```sh
iasql db apply
```

##### Configure correctly the deploy.sh

  - Grab the ECR URL. Could be find in your db > aws_ecr table > repository_uri column. This could be also grabbed from the AWS UI console.
  - Set the ECR URL in the `Login`, `Tag`, `Push` and `Clean` sections.

##### Execute deploy script

```sh
./deploy.sh
```

<!-- TODO: remove this section once https://github.com/iasql/iasql/issues/204 is closed -->
#### Configure load balancer HTTPS listener

Since we are not able to create AWS load balancer listeners with HTTPS certificates using IaSQL yet, we have to do this process manually. For this we have to request or generate a valid certificate and go to the AWS console and follow this steps:

  1. Go to EC2 > Load Balancers
  2. Select `iasql-engine-load-balancer`
  3. Add Listener (Listeners tab)
  4. Choose HTTPS protocol with port 443
  5. Add Action `forward` to target group `iasql-engine-target-group`
  6. Add certificate

<!-- TODO: remove this section once https://github.com/iasql/iasql/issues/204 is closed -->
#### Force SSL connections to DB

Since we are not able to create AWS RDS Parameter Groups using IaSQL yet, we have to do this process manually. For this we have to follow this steps:

  1. Go to RDS > Parameter Groups
  2. Create Parameter group
    - family: postgres 13
    - type: db parameter group
    - group name: `ssl-postgres-13`
    - description: `ssl-postgres-13`
  3. Edit the parameter group created
    - Filter by `rds.force_ssl`
    - Select `rds.force_ssl` option
    - Update value to `1`
    - Save
  4. Go to Databases
  5. Modify `iasql-postgres-rds`
    - Go to Additional configuration section
    - Update DB parameter group with `ssl-postgres-13`
    - Continue
    - Select Apply immediately and save
  6. Reboot `iasql-postgres-rds` instance


#### Follow-up deployment

##### Execute deploy script

  ```sh
  ./deploy.sh
  ```

---------
  Run script from `/engine` directory
---------

---------
  The load balancer does *NOT* need to be reconfigured, and Fargate will do a Red-Black deployment swapping from the old Docker container to the new one over the course of 5-10 minutes, providing zero downtime to end-users.
---------

### Beta IaSQL-on-IaSQL configuration details

#### Deployment script

This script is used for follow up updates once iasql-on-iasql is already in place. This script execute the following steps:

  - Login to aws container registry
  - Build engine image
  - Tag image
  - Push image
  - Prepare iasql-on-iasql.sql script. This step creates an untracked iasql-on-iasql.out.sql script with the credentials replaced based on environment vairables values
  - Run iasql-on-iasql.out.sql script. This will create a new container definition, a new task definition and update the service to use the newly defined task definition.
  - IaSQL db apply. Using local debug version
  - Clean and leave just the lastest image created

#### SQL script

The `/src/script/iasql-on-iasql.sql` script runs all the stored procedures calls necessary to create IaSQL. The first time all the resources will be inserted in database and created on AWS using `apply`. 

The current stored procedures have being created to run one time and the following will do nothing if you try to create the same resource again in order to avoid resource duplication. The stored procuedures related to `aws_ecs` module are the exception to this rule, specifically, the `create_container_definition`, `create_task_definition` and `create_ecs_service` procedures. 

- `create_container_definition`: It will update the container if values are differet and it will add new port mapping or environment variables if do not exists.
- `create_task_definition`: It will create a new version for the task definiton to be attached to the ecs service
- `create_ecs_service`: It will update the service using the latest task definition available.

Following this logic, the next time we execute again the `iasql-on-iasql.sql` script will create a new task and update the engine service.

#### Pushing engine image to engine ECR

- Login to ECR repository. Probably you will need to update this command if you have your `iasql` org credentials in an specific profile passing the `--profile` option.

  ```sh
  aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 547931376551.dkr.ecr.us-east-2.amazonaws.com
  ```

- Build image (Optional)

  ```sh
  docker build -t iasql-engine-repository .
  ```

- Tag image. Replace the first argument if your local image has another name

  ```sh
  docker tag iasql-engine-repository:latest 547931376551.dkr.ecr.us-east-2.amazonaws.com/iasql-engine-repository:latest
  ```

- Push image

  ```sh
  docker push 547931376551.dkr.ecr.us-east-2.amazonaws.com/iasql-engine-repository:latest
  ```
