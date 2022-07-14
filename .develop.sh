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

# Copy the version and push to main
cp -r src/modules/${LATESTVERSION} src/modules/${VERSION}
git add src/modules/${VERSION}
git commit -m "Prepare version ${VERSION} for development"
git push origin main
