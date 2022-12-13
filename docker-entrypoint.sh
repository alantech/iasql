#!/usr/bin/env bash

set -vex

if [ -d /var/lib/postgresql/14/main ]; then
  chown -R postgres /var/lib/postgresql/14/main
  chgrp -R postgres /var/lib/postgresql/14/main
  su - postgres -c "chmod 700 /var/lib/postgresql/14/main"
else
  su - postgres -c "mkdir -p /var/lib/postgresql/14/main"
  su - postgres -c "chmod 700 /var/lib/postgresql/14/main"
fi

# The following has been lifted and modified from the official Postgres Docker container
# initialize empty PGDATA (/var/lib/postgresql/14/main) directory with new database via 'initdb'
# "initdb" is particular about the current user existing in "/etc/passwd", so we use "nss_wrapper" to fake that if necessary
# see https://github.com/docker-library/postgres/pull/253, https://github.com/docker-library/postgres/issues/359, https://cwrap.org/nss_wrapper.html
uid="$(id -u)"
if ! getent passwd "$uid" &> /dev/null; then
  # see if we can find a suitable "libnss_wrapper.so" (https://salsa.debian.org/sssd-team/nss-wrapper/-/commit/b9925a653a54e24d09d9b498a2d913729f7abb15)
  local wrapper
  for wrapper in {/usr,}/lib{/*,}/libnss_wrapper.so; do
    if [ -s "$wrapper" ]; then
      NSS_WRAPPER_PASSWD="$(mktemp)"
      NSS_WRAPPER_GROUP="$(mktemp)"
      export LD_PRELOAD="$wrapper" NSS_WRAPPER_PASSWD NSS_WRAPPER_GROUP
      local gid; gid="$(id -g)"
      echo "postgres:x:$uid:$gid:PostgreSQL:/var/lib/postgresql/14/main:/bin/false" > "$NSS_WRAPPER_PASSWD"
      echo "postgres:x:$gid:" > "$NSS_WRAPPER_GROUP"
      break
    fi
  done
fi

eval 'initdb --username="postgres" --pwfile=<(node ./dist/scripts/from-config.js db.password)'

# unset/cleanup "nss_wrapper" bits
if [[ "${LD_PRELOAD:-}" == */libnss_wrapper.so ]]; then
  rm -f "$NSS_WRAPPER_PASSWD" "$NSS_WRAPPER_GROUP"
  unset LD_PRELOAD NSS_WRAPPER_PASSWD NSS_WRAPPER_GROUP
fi

service postgresql start

# su - postgres -c "psql -c \"ALTER ROLE postgres WITH password '$(node ./dist/scripts/from-config.js db.password)'\""
su - postgres -c "echo \"SELECT 'CREATE DATABASE iasql_metadata' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'iasql_metadata')\gexec\" | psql"

service postgresql restart

su - postgres -c "psql iasql_metadata -c \"CREATE EXTENSION IF NOT EXISTS pg_cron;\""
su - postgres -c "psql iasql_metadata -c \"GRANT EXECUTE ON FUNCTION cron.schedule_in_database(text,text,text,text,text,boolean) TO postgres;\""

yarn start
