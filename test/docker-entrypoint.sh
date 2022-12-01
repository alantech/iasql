#!/usr/bin/env bash

set -vex

if [ -d /var/lib/postgresql/14/main ]; then
  chown -R postgres /var/lib/postgresql/14/main
  chgrp -R postgres /var/lib/postgresql/14/main
fi

service postgresql start

su - postgres -c "psql -c \"ALTER ROLE postgres WITH password 'test'\"" # Only 'cause this is a test docker

# Can't stop, won't stop
while sleep 60; do
  sleep 60;
done
