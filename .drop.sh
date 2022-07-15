#!/bin/bash

# Be very *vexing* with the output, but good for debugging if something goes wrong
set -vex

# Make sure we're on main, just in case
git checkout main
git pull origin main

# The version to drop
VERSION=`ts-node src/scripts/oldestVersion.ts`

# Drop the version and push to main
git rm -r src/modules/${VERSION}
git commit -m "Drop version ${VERSION}"
git push origin main
