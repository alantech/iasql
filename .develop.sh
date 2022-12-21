#!/bin/bash

# Be very *vexing* with the output, but good for debugging if something goes wrong
set -vex

# Make sure we're on main, just in case
git checkout main
git pull origin main

# The version to create
VERSION=$1

# Update the config version
CONFIGVERSION="$(cat src/config/index.ts | sed "s/version:.*/version: '${VERSION}-beta',/")" && echo "${CONFIGVERSION}" > src/config/index.ts

# Update the package metadata with the specified version
PACKAGEJSON="$(jq ".version = \"${VERSION}-beta\"" package.json)" && echo "${PACKAGEJSON}" > package.json

# Make sure the lockfiles are updated, too
yarn

# Make sure it's all formatted the way we want it
yarn format

# Commit the version and push to main
git add package.json yarn.lock src/config/index.ts
git commit -m "Prepare version ${VERSION}-beta for development"
git push origin main
