#!/bin/bash

# Be very *vexing* with the output, but good for debugging if something goes wrong
set -vex

# The release version
VERSION=$1

echo Release Version: ${VERSION}

# Update the package metadata with the specified version
IASQL="$(sed "s/^version = .*$/version = \"${VERSION}\"/" ./Cargo.toml)" && echo "${IASQL}" > Cargo.toml

# Make sure the lockfiles are updated, too
cargo build

# Commit and tag the update
git add Cargo.toml Cargo.lock
git commit -m "v${VERSION}"
git push origin $(git branch --show-current)
gh release create v${VERSION} -t v${VERSION} -n Pre-release --target $(git branch --show-current) -p
