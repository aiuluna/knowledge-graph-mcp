import { defineConfig } from 'vite';
import { resolve } from 'path';
import fsSync from 'fs';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'fs/promises',
        'path',
        'crypto',
        'node:fs',
        'node:crypto',
        '@modelcontextprotocol/sdk/server/index.js',
        '@modelcontextprotocol/sdk/server/stdio.js',
        '@modelcontextprotocol/sdk/types.js'
      ],
    },
    target: 'node18',
    sourcemap: true,
    outDir: 'dist'
  },
  assetsInclude: ['**/*.md'],
  plugins: [
    {
      name: 'vite-plugin-raw-import',
      transform(code, id) {
        if (id.endsWith('.md?raw')) {
          const filePath = id.slice(0, -4); // 移除?raw后缀
          const rawContent = fsSync.readFileSync(filePath, 'utf-8');
          return `export default ${JSON.stringify(rawContent)};`;
        }
      }
    }
  ]
}); 