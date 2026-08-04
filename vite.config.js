import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function copyRuntimeAssets(){
  return {
    name:'copy-runtime-assets',
    closeBundle(){
      const out=path.resolve('dist/client');
      const source=fs.readFileSync(path.resolve('src/main.js'),'utf8');
      const files=new Set([...source.matchAll(/assets\/[A-Za-z0-9_./-]+\.(?:glb|mp3|png|jpg|jpeg|webp)/g)].map(match=>match[0]));
      const residents=source.match(/const RESIDENT_ASSETS=(\[[^;]+\]);/)?.[1]||'[]';
      for(const resident of residents.matchAll(/'([^']+)'/g))files.add(`assets/residents/${resident[1]}.glb`);
      for(const relative of files){
        const input=path.resolve(relative),output=path.join(out,relative);
        fs.mkdirSync(path.dirname(output),{recursive:true});
        fs.copyFileSync(input,output);
      }
      fs.cpSync(path.resolve('node_modules/three/examples/jsm/libs/draco'),path.join(out,'draco'),{recursive:true});
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [copyRuntimeAssets()],
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
