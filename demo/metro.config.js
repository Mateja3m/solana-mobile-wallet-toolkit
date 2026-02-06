const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(workspaceRoot, 'toolkit')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
];

config.resolver.blockList = exclusionList([

  new RegExp(`${path.resolve(workspaceRoot, '.git')}/.*`),
  new RegExp(`${path.resolve(workspaceRoot, 'docs')}/.*`)
]);

module.exports = config;
