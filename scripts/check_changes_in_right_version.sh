#!/bin/bash

# get the current development version
CURRENT_VERSION=$(grep 'latestVersion' src/config/ci.ts | cut -d ':' -f 2 | sed "s/'//g" | sed "s/,//g")

# check if there have been modifications on previous code
MODIFIED_FILES=($(git diff-tree --no-commit-id --name-only -r $GITHUB_SHA))
for FILE in "${MODIFIED_FILES[@]}"; do
  # if file has the pattern src/modules/ check that is just for CURRENT_VERSION
  if  [[ $FILE == src/modules* ]]; then
    # need to check the version
    VERSION=$(echo $FILE|cut -d '/' -f 3)
    if [ "$VERSION" != "$CURRENT_VERSION" ]; then
      # incorrect version
      exit 1
    fi
  fi
done

exit 1