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
      const memoryDistrict=JSON.parse(fs.readFileSync(path.resolve('world/memory-district.json'),'utf8'));
      for(const entry of memoryDistrict.entries||[])files.add(entry.modelPath);
      for(const relative of files){
        const input=path.resolve(relative),output=path.join(out,relative);
        fs.mkdirSync(path.dirname(output),{recursive:true});
        fs.copyFileSync(input,output);
      }
      fs.cpSync(path.resolve('node_modules/three/examples/jsm/libs/draco'),path.join(out,'draco'),{recursive:true});
      for(const relative of ['robots.txt','llms.txt','cli-mcp/guide.md']){
        const input=path.resolve(relative),output=path.join(out,relative);
        fs.mkdirSync(path.dirname(output),{recursive:true});
        fs.copyFileSync(input,output);
      }
      const licenses=path.join(out,'licenses');
      fs.mkdirSync(licenses,{recursive:true});
      fs.copyFileSync(path.resolve('THIRD_PARTY_NOTICES.md'),path.join(licenses,'THIRD_PARTY_NOTICES.md'));
      fs.copyFileSync(path.resolve('node_modules/three/LICENSE'),path.join(licenses,'three-MIT.txt'));
      fs.copyFileSync(path.resolve('node_modules/@pkgjs/parseargs/LICENSE'),path.join(licenses,'draco-Apache-2.0.txt'));
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
      input: {
        main: path.resolve('index.html'),
        lostHeritage: path.resolve('lost-heritage.html'),
        alfaRomeoGiuliaSpider: path.resolve('alfa-romeo-giulia-spider.html'),
        cliMcpGuide: path.resolve('cli-mcp/index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
