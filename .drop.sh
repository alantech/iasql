#!/bin/bash

# Be very *vexing* with the output, but good for debugging if something goes wrong
set -vex

# Make sure we're on main, just in case
git checkout main
git pull origin main

# The current version
VERSION=`ts-node src/scripts/latestVersion.ts`

# The version to drop
OLDESTVERSION=`ts-node src/scripts/oldestVersion.ts`

# Drop the version
git rm -r src/modules/${OLDESTVERSION}
git rm -r site/versioned_docs/version-${OLDESTVERSION}
git rm site/versioned_sidebars/version-${OLDESTVERSION}-sidebars.json

# Run again to get the new last version
LASTVERSION=`ts-node src/scripts/oldestVersion.ts`

# Update the config versions
CONFIGCI="$(cat src/config/ci.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGCI}" > src/config/ci.ts
CONFIGLOCAL="$(cat src/config/local.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGLOCAL}" > src/config/local.ts
CONFIGPRODUCTION="$(cat src/config/production.ts | sed "s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGPRODUCTION}" > src/config/production.ts # Production doesn't get the latest version edited
CONFIGSTAGING="$(cat src/config/staging.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGSTAGING}" > src/config/staging.ts
CONFIGTEST="$(cat src/config/test.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGTEST}" > src/config/test.ts
CONFIGBOOTSTRAP="$(cat src/config/bootstrap.ts | sed "s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGBOOTSTRAP}" > src/config/bootstrap.ts # Bootstrap doesn't get the latest version edited
CONFIGDOCSVERSION="$(cat site/versions.json | jq ". | map(select(. != \"${OLDESTVERSION}\"))")" && echo "${CONFIGDOCSVERSION}" > site/versions.json

# Make sure it's all formatted the way we want it
yarn format

# Drop the version and push to main
git add src/config/*.ts
git add site/*
git commit -m "Drop version ${OLDESTVERSION}"
git push origin main
