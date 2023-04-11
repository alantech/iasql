---
id: "aws_ecr_entity_repository.ImageTagMutability"
title: "image_tag_mutability"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Different values to define the image tag mutability. You can configure a repository to enable tag mutability to
prevent image tags from being overwritten. After the repository is configured for immutable tags,
an ImageTagAlreadyExistsException error is returned if you attempt to push an image with a tag that is already
in the repository. When tag immutability is enabled for a repository, this affects all tags and you cannot make
some tags immutable while others aren't.

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html

## Values

• **IMMUTABLE** = `IMMUTABLE`

• **MUTABLE** = `MUTABLE`
