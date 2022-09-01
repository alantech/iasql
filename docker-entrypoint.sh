#!/usr/bin/env bash
yarn forever dist/services/scheduler.js
yarn wait-on http://localhost:14527/health/
yarn start
