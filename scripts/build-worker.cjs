// Resolve the Worker graph in Node so the bundler never scans unrelated parent
// directories. This also works in restricted Windows workspaces.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
esbuild.build({
  absWorkingDir: root,
  entryPoints: ['rahmat-worker'],
  outfile: path.join(root, '.worker/index.mjs'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  plugins: [{ name: 'project-files', setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      let file;
      if (args.kind === 'entry-point') file = path.join(root, 'server/index.ts');
      else if (args.path.startsWith('.')) {
        const base = path.resolve(path.dirname(args.importer), args.path);
        file = [base, base + '.ts', base + '.js', base + '.json', path.join(base, 'index.ts')]
          .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      } else file = require.resolve(args.path, { paths: [path.dirname(args.importer)] });
      if (!file) throw new Error(`Cannot resolve Worker import ${args.path}`);
      return { path: file, namespace: 'project-files' };
    });
    build.onLoad({ filter: /.*/, namespace: 'project-files' }, (args) => ({
      contents: fs.readFileSync(args.path, 'utf8'),
      loader: args.path.endsWith('.json') ? 'json' : args.path.endsWith('.ts') ? 'ts' : 'js',
    }));
  } }],
}).then(() => console.log('Worker bundle ready.')).catch(error => { console.error(error.message); process.exitCode = 1; });
