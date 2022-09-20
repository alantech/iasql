#!/bin/bash

echo "Checking that changes are in the right version"

# get the current development version
CURRENT_VERSION=$(npx ts-node src/scripts/latestVersion.ts)
echo "Current version is $CURRENT_VERSION"

# check if there have been modifications on previous code
IFS=$'\n' MODIFIED_FILES=($(git diff --no-commit-id --name-only -r  origin/main...))

for FILE in "${MODIFIED_FILES[@]}"; do
  echo "file is $FILE"
  # if file has the pattern src/modules/ check that is just for CURRENT_VERSION
  if  [[ "$FILE" == src/modules* ]]; then
    echo "check version"
    # need to check the version
    VERSION=$(echo $FILE|cut -d '/' -f 3)
    echo "version is $VERSION"
    if [ "$VERSION" != "$CURRENT_VERSION" ]; then
      # incorrect version
      echo "Error, out of version modifications found in file $FILE"
      exit 1
    fi
  fi
done

exit 0