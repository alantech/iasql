#!/bin/bash

# Be very *vexing* with the output, but good for debugging if something goes wrong
set -vex

# The prerelease version
VERSION=$1

echo Prerelease Version: ${VERSION}

# Update the package metadata with the specified version
CLI="$(sed "s/^version = .*$/version = \"${VERSION}\"/" cli/Cargo.toml)" && echo "${CLI}" > cli/Cargo.toml

# Make sure the lockfiles are updated, too
cd cli
cargo build
cd -

# Commit and tag the update
git add cli/Cargo.toml cli/Cargo.lock
git commit -m "v${VERSION}"
git push origin $(git branch --show-current)
gh release create v${VERSION} -t v${VERSION} -n Pre-release --target $(git branch --show-current) -p