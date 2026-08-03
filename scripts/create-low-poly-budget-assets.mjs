import { Document, NodeIO } from '@gltf-transform/core';

// These four small replacement exports keep the authored silhouettes while
// removing dense hidden bevel topology. Every primitive is deliberately a
// box-based low-poly part, so the triangle budget is deterministic and easy
// to review without Blender.
const jobs = [
  {file:'assets/overheadbridge-v2.glb', scale:1.217, parts:[
    [0,0,0,14.52,0.45,1.7,0], [0,4.75,0,14.52,0.45,1.7,1],
    [-6.1,2.35,0,.55,4.7,1.65,2], [6.1,2.35,0,.55,4.7,1.65,2],
  ]},
  {file:'assets/cat-v2.glb', scale:.192, parts:[
    [0,.42,0,.65,.8,.7,0], [0,.95,0,.46,.35,.5,1],
    [-.18,1.18,0,.12,.25,.12,2], [.18,1.18,0,.12,.25,.12,2],
  ]},
  {file:'assets/birdcage-v2.glb', scale:.463, parts:[
    [0,.55,0,1.8,.14,1.05,0], [0,.1,0,1.8,.18,1.05,1],
    [-.78,.32,0,.12,.75,.12,2], [.78,.32,0,.12,.75,.12,2],
    [0,.32,-.45,1.55,.75,.1,2], [0,.32,.45,1.55,.75,.1,2],
  ]},
  {file:'assets/router-kit-v2.glb', scale:1.14, parts:[
    [0,.42,0,2.3,.78,1.7,0], [0,1.02,0,1.7,.16,1.1,1],
    [-.65,1.28,0,.08,.22,.08,2], [0,1.28,0,.08,.22,.08,2], [.65,1.28,0,.08,.22,.08,2],
  ]},
];
const palette = [[0.22,0.28,0.28,1],[0.78,0.62,0.32,1],[0.18,0.48,0.52,1]];
function addBox(doc, mesh, material, [cx,cy,cz,w,h,d]){
  const buffer=doc.getRoot().listBuffers()[0]||doc.createBuffer();
  const x=w/2,y=h/2,z=d/2;
  const p=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
  const verts=p.flatMap(([a,b,c])=>[a+cx,b+cy,c+cz]);
  const faces=[0,1,2,0,2,3,1,5,6,1,6,2,5,4,7,5,7,6,4,0,3,4,3,7,3,2,6,3,6,7,4,5,1,4,1,0];
  const position=doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array(verts));
  const indices=doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint16Array(faces));
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',position).setIndices(indices).setMaterial(material));
}
for(const job of jobs){
  const doc=new Document(),scene=doc.createScene(),mesh=doc.createMesh();
  const materials=palette.map((color,i)=>doc.createMaterial(`Budget palette ${i}`).setBaseColorFactor(color).setRoughnessFactor(.9));
  for(const part of job.parts)addBox(doc,mesh,materials[part[6]],part.slice(0,6));
  scene.addChild(doc.createNode().setMesh(mesh));
  await new NodeIO().write(job.file,doc);
  console.log(`[low-poly] ${job.file} · ${job.parts.length*12} triangles before Draco`);
}
