#!/usr/bin/env node

/* tslint:disable no-console */
import config from '../config';

const configPath = process.argv[process.argv.length - 1];

console.log(configPath.split('.').reduce((obj: any, seg: string) => obj[seg], config));
