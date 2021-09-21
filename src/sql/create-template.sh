#!/bin/bash
cat ./src/sql/types.sql >> dist/template.sql
cat ./src/sql/tables.sql >> dist/template.sql
cat ./src/sql/indices.sql >> dist/template.sql