import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: { css: true, include: ['tests/**/*.test.ts'] },
  build: {
    rollupOptions: {
      input: { messages: 'src/content/messages.ts', sidepanel: 'src/sidepanel/index.html', 'service-worker': 'src/background/service-worker.ts' },
      output: { entryFileNames: 'assets/[name].js' },
    },
  },
});
