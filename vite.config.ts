import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KnowledgeGraphMCP',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: [
        '@modelcontextprotocol/sdk',
        'cross-env',
        'uuid',
        'zod'
      ]
    },
    sourcemap: true,
    target: 'esnext'
  },
  test: {
    globals: true,
    environment: 'node'
  }
});