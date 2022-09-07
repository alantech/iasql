#!/bin/bash

# Be very *vexing* with the output, but good for debugging if something goes wrong
set -vex

# Make sure we're on main, just in case
git checkout main
git pull origin main

# The new version
VERSION=`ts-node src/scripts/latestVersion.ts`

# The oldest supported version
LASTVERSION=`ts-node src/scripts/oldestVersion.ts`

echo "Version: ${VERSION} (Last supported: ${LASTVERSION})"

if [[ "${VERSION}" == "" || "${LASTVERSION}" == "" ]]; then
  echo "Bad versioning"
  exit 1
fi

# Update the package metadata with the specified version
PACKAGEJSON="$(jq ".version = \"${VERSION}\"" package.json)" && echo "${PACKAGEJSON}" > package.json

# Update the config versions
CONFIGCI="$(cat src/config/ci.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGCI}" > src/config/ci.ts
CONFIGLOCAL="$(cat src/config/local.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGLOCAL}" > src/config/local.ts
CONFIGPRODUCTION="$(cat src/config/production.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGPRODUCTION}" > src/config/production.ts
CONFIGSTAGING="$(cat src/config/staging.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGSTAGING}" > src/config/staging.ts
CONFIGTEST="$(cat src/config/test.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGTEST}" > src/config/test.ts
CONFIGBOOTSTRAP="$(cat src/config/bootstrap.ts | sed "s/latestVersion:.*/latestVersion: '${VERSION}',/;s/oldestVersion:.*/oldestVersion: '${LASTVERSION}'/")" && echo "${CONFIGBOOTSTRAP}" > src/config/bootstrap.ts

# Make sure the lockfiles are updated, too
yarn

# Commit and tag the update
git add package.json yarn.lock src/config/*.ts
git commit -m "v${VERSION}"
git push origin main
gh release create v${VERSION} -t v${VERSION} -n v${VERSION} --target main