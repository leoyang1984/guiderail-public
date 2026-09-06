import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { messages: 'src/content/messages.ts', sidepanel: 'src/sidepanel/index.html', 'service-worker': 'src/background/service-worker.ts' },
      output: { entryFileNames: 'assets/[name].js' },
    },
  },
});
