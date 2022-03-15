import * as express from 'express'

import * as iasql from '../services/iasql';
import * as logger from '../services/logger';

export const mod = express.Router();

// Mimicking `apt` in this due to the similarities in environment modules/packages are being managed
// within. Here's the list of commands `apt` itself claims are commonly used. Which should we
// support, and is there anything not present that we need to due to particulars of IaSQL? Maybe an
// "enable/disable" endpoint to stop actions for a given module (and anything dependent on it) but
// not removing it from the DB?
//
// Most used `apt` commands:
//  list - list packages based on package names
//  search - search in package descriptions
//  show - show package details
//  install - install packages
//  reinstall - reinstall packages
//  remove - remove packages
//  autoremove - Remove automatically all unused packages
//  update - update list of available packages
//  upgrade - upgrade the system by installing/upgrading packages
//  full-upgrade - upgrade the system by removing/installing/upgrading packages
//  edit-sources - edit the source information file
//  satisfy - satisfy dependency strings

// Needed at the beginning
mod.post('/list', async (req, res) => {
  const { all, installed, dbAlias } = req.body;
  try {
    res.json(await iasql.modules(all, installed, dbAlias, req.user));
  } catch (e) {
    res.status(400).end('Invalid request parameters');
  }
});

// Needed when we have more than a handful of packages
mod.post('/search', (_req, res) => res.end('ok'));

// Needed when we have metadata attached to the packages to even show
mod.post('/show', (_req, res) => res.end('ok'));

// Needed at the beginning
mod.post('/install', async (req, res) => {
  const { list, dbAlias } = req.body;
  // Don't do anything if we don't know what database to impact
  if (!dbAlias) return res.status(400).json("Missing 'dbAlias' to install into");
  // Also don't do anything if we don't have any list of modules to install
  if (!Array.isArray(list)) return res.status(400).json("No packages provided in 'list' property");
  try {
    res.json(await iasql.install(list, dbAlias, req.user));
  } catch (e: any) {
    res.status(400).json(logger.error(e));
  }
});

// Needed at the beginning
mod.post('/uninstall', async (req, res) => {
  const { list, dbAlias } = req.body;
  // Don't do anything if we don't know what database to impact
  if (!dbAlias) return res.status(400).json("Missing 'dbAlias' to uninstall from");
  // Also don't do anything if we don't have any list of modules to install
  if (!Array.isArray(list)) return res.status(400).json("No modules provided in 'list' property");
  try {
    res.json(await iasql.uninstall(list, dbAlias, req.user));
  } catch (e: any) {
    res.status(400).json(logger.error(e));
  }
});

// Needed before first beta
mod.post('/upgrade', (_req, res) => res.end('ok'));