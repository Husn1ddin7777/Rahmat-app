// Transpile test imports in process. This avoids OS temp-directory/user lookups
// and works in restricted Windows development environments as well as CI.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

Module._extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, resolveJsonModule: true },
  });
  module._compile(result.outputText, filename);
};

for (const filename of fs.readdirSync(__dirname).filter(name => name.endsWith('.test.ts')).sort()) {
  require(path.join(__dirname, filename));
}
