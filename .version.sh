#!/bin/bash

# Be very *vexing* with the output, but good for debugging if something goes wrong
set -vex

# Make sure we're on main, just in case
git checkout main
git pull origin main

# The new version
VERSION=$(jq -r ".version" package.json | sed 's/-beta//g')

echo "New Version: ${VERSION}"

# Update the config version
CONFIGVERSION="$(cat src/config/index.ts | sed "s/^  version:.*/version: '${VERSION}-beta',/")" && echo "${CONFIGVERSION}" > src/config/index.ts

# Update the package metadata with the specified version
PACKAGEJSON="$(jq ".version = \"${VERSION}\"" package.json)" && echo "${PACKAGEJSON}" > package.json

# Make sure the lockfiles are updated, too
yarn

# Make sure it's all formatted the way we want it
yarn format

# Commit and tag the update
git add package.json yarn.lock src/config/index.ts
git commit -m "v${VERSION}"
git push origin main
gh release create v${VERSION} -t v${VERSION} -n v${VERSION} --target main