#!/bin/bash

# Be very *vexing* with the output, but good for debugging if something goes wrong
set -vex

# Make sure we're on main, just in case
git checkout main
git pull origin main

# The version to create
VERSION=$1

# The version to clone
LATESTVERSION=`ts-node src/scripts/latestVersion.ts`

# The oldest version still supported
LASTVERSION=`ts-node src/scripts/oldestVersion.ts`

# Update the config versions
CONFIGCI="$(cat src/config/ci.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGCI}" > src/config/ci.ts
CONFIGLOCAL="$(cat src/config/local.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGLOCAL}" > src/config/local.ts
CONFIGPRODUCTION="$(cat src/config/production.ts | sed "s/latestVersion:.*/latestVersion: '${LATESTVERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGPRODUCTION}" > src/config/production.ts
CONFIGSTAGING="$(cat src/config/staging.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGSTAGING}" > src/config/staging.ts
CONFIGTEST="$(cat src/config/test.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGTEST}" > src/config/test.ts

# Copy the version and push to main
cp -r src/modules/${LATESTVERSION} src/modules/${VERSION}
git add src/modules/${VERSION}
git commit -m "Prepare version ${VERSION} for development"
git push origin main
