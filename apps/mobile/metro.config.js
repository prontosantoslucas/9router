const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// 1. Encontrar o diretório raiz do monorepo
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 2. Metro deve monitorar a raiz do monorepo para resolver módulos hoistados
config.watchFolders = [workspaceRoot];

// 3. Instruir o Metro a procurar módulos na pasta node_modules local e na raiz
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 4. Bloquear resolução duplicada de pacotes react e react-native — sem isso o Metro
// caminha hierarquicamente até o node_modules raiz e pode resolver uma versão errada
// de react-native (ex.: puxada transitivamente por outro pacote) em vez da fixada aqui.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
