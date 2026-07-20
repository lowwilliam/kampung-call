import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  publicDir: false,
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'assets/**/*.{glb,mp3,png,jpg,jpeg,webp}',
          dest: 'assets',
        },
        {
          src: 'node_modules/three/examples/jsm/libs/draco/*',
          dest: 'draco',
        },
      ],
    }),
  ],
  build: {
    outDir: 'dist/client',
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
