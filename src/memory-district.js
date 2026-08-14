import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import registry from '../world/memory-district.json';

const ORIGIN=new THREE.Vector3(0,-260,0);
const UP=new THREE.Vector3(0,1,0);
const BOUNDS={minX:-5.1,maxX:5.1,minZ:-174,maxZ:7.6};

export function createMemoryDistrictRuntime(deps){
  const {scene,player,camera,dir,rim,dirTarget,gradientTexture,outlineMaterial,toonify,alignLowestPoint,showToast,getControls,getWorldMode,getLifecycle,getSurface,restoreSurface,worldTransition,setWorldMode,hideCompass,getAnimation}=deps;
  const state={position:new THREE.Vector3(0,0,6),forward:new THREE.Vector3(0,0,-1),streamTimer:0,activeEntry:null,chunks:new Map()};
  let surfacePosition=null,surfaceForward=null,walkPhase=0,transitioning=false;
  const materialCache=new Map();
  const material=color=>{
    if(!materialCache.has(color))materialCache.set(color,new THREE.MeshToonMaterial({color,gradientMap:gradientTexture}));
    return materialCache.get(color);
  };
  const box=(w,h,d,color)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));
  const boardTexture=(title,subtitle,accent='#d0342c')=>{
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=180;
    const context=canvas.getContext('2d');context.fillStyle='#fbf6e8';context.fillRect(0,0,640,180);
    context.fillStyle=accent;context.fillRect(0,0,12,180);context.fillStyle='#2e2a25';context.font='bold 30px Courier New';context.textAlign='left';
    const lines=[''];
    for(const word of title.split(' ')){
      const candidate=`${lines.at(-1)} ${word}`.trim();
      if(context.measureText(candidate).width>560&&lines.at(-1))lines.push(word);else lines[lines.length-1]=candidate;
    }
    lines.slice(0,2).forEach((line,index)=>context.fillText(line,34,48+index*35));
    context.fillStyle='#2f7f8c';context.font='bold 19px Courier New';context.fillText(subtitle,34,145);
    return new THREE.CanvasTexture(canvas);
  };
  const board=(title,subtitle,width=6.4)=>{
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width*.28125),new THREE.MeshBasicMaterial({map:boardTexture(title,subtitle),side:THREE.DoubleSide}));
    mesh.userData.noShadow=true;mesh.userData.noOutline=true;return mesh;
  };
  const portal=()=>{
    const group=new THREE.Group();
    for(const x of [-1.35,1.35]){
      const post=box(.34,3.3,.34,0x27302f);post.position.set(x,1.65,0);group.add(post);
      const glow=box(.12,2.65,.08,0xd0342c);glow.position.set(x,1.65,.22);group.add(glow);
    }
    const top=box(3.05,.48,.4,0x27302f);top.position.y=3.1;group.add(top);
    const sign=board('MEMORY DISTRICT','13 LOST HERITAGE RECONSTRUCTIONS',2.7);sign.position.set(0,3.1,.23);group.add(sign);
    const threshold=box(2.4,.06,.55,0xf2c14e);threshold.position.set(0,.04,0);group.add(threshold);return group;
  };
  const world=(()=>{
    const root=new THREE.Group();root.name='Memory District';root.position.copy(ORIGIN);root.visible=false;
    const ground=box(31,.28,190,0x203d3e);ground.position.set(0,-.18,-84);root.add(ground);
    const walk=box(9,.08,184,0xe8d5a3);walk.position.set(0,.01,-84);root.add(walk);
    const line=box(.12,.04,177,0xd0342c);line.position.set(0,.08,-86);root.add(line);
    for(let z=2;z>=-172;z-=6){const tick=box(1.1,.035,.08,z%18===2?0xd0342c:0x2f7f8c);tick.position.set(0,.105,z);root.add(tick);}
    const entrance=portal();entrance.position.set(0,0,7.4);entrance.rotation.y=Math.PI;root.add(entrance);
    const framing=board('MEMORY DISTRICT','CURATED TIMELINE · NOT A GEOGRAPHIC MAP',7.2);framing.position.set(0,2.2,4.9);root.add(framing);
    for(const chunk of registry.chunks){
      state.chunks.set(chunk.id,{status:'idle',token:0,errors:[]});
      const marker=board(chunk.label,'DEMOLITION ERA',3.6);marker.position.set(0,1.8,chunk.startZ-1);root.add(marker);
    }
    root.userData.entrySlots=new Map();
    for(const entry of registry.entries){
      const anchor=new THREE.Group();anchor.name=entry.name;anchor.position.set(entry.position.x,0,entry.position.z);anchor.rotation.y=THREE.MathUtils.degToRad(entry.heading);root.add(anchor);
      const signX=entry.position.x<0?-3.25:3.25,plaque=board(entry.name,`${entry.opened} → ${entry.removed}`,5.5);plaque.position.set(signX,1.35,entry.position.z);root.add(plaque);
      const post=box(.12,1.35,.12,0x27302f);post.position.set(signX,.67,entry.position.z-.04);root.add(post);
      const dot=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.06,18),material(0xf2c14e));dot.position.set(0,.12,entry.position.z);root.add(dot);
      root.userData.entrySlots.set(entry.id,{anchor,interaction:new THREE.Vector3(signX,0,entry.position.z)});
    }
    const lampA=new THREE.PointLight(0xf2c14e,1.4,70);lampA.position.set(0,12,-40);root.add(lampA);
    const lampB=new THREE.PointLight(0x78c7c4,1.5,80);lampB.position.set(0,14,-125);root.add(lampB);
    scene.add(root);return root;
  })();
  const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath('/draco/');draco.setWorkerLimit(2);loader.setDRACOLoader(draco);
  const worldPosition=()=>ORIGIN.clone().add(state.position);
  const disposeObject=root=>root.traverse(object=>{
    if(!object.isMesh)return;object.geometry?.dispose?.();
    for(const item of Array.isArray(object.material)?object.material:[object.material]){
      if(!item||item===outlineMaterial)continue;
      for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap'])if(item[key]&&item[key]!==gradientTexture)item[key].dispose?.();
      item.dispose?.();
    }
  });
  const audit=()=>{
    const chunks=[...state.chunks].map(([id,value])=>({id,status:value.status,errors:value.errors.length}));
    const loadedEntries=registry.entries.filter(entry=>world.userData.entrySlots.get(entry.id).anchor.children.length).length;
    const result={registered:registry.entryCount,chunks,loadedEntries,failed:chunks.reduce((sum,chunk)=>sum+chunk.errors,0),mode:getWorldMode(),sourceManifestVersion:registry.sourceManifestVersion};
    window.__memoryDistrictAudit=result;document.documentElement.dataset.memoryRegistered=String(result.registered);document.documentElement.dataset.memoryLoaded=String(result.loadedEntries);document.documentElement.dataset.memoryFailed=String(result.failed);document.documentElement.dataset.memoryMode=result.mode;return result;
  };
  const fit=(model,entry)=>{
    toonify(model);model.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()),longest=Math.max(size.x,size.z);
    if(Number.isFinite(longest)&&longest>1e-4)model.scale.setScalar(entry.targetLongest/longest);
    alignLowestPoint(model,0);model.updateMatrixWorld(true);
  };
  const loadChunk=id=>{
    const chunkState=state.chunks.get(id);if(!chunkState||chunkState.status==='loading'||chunkState.status==='loaded')return;
    const entries=registry.entries.filter(entry=>entry.chunk===id);chunkState.status='loading';chunkState.errors=[];chunkState.token+=1;
    const token=chunkState.token;let pending=entries.length;
    const finish=()=>{if(chunkState.token!==token)return;if(--pending<=0){chunkState.status='loaded';audit();}};
    for(const entry of entries)loader.load(entry.modelPath,gltf=>{
      if(chunkState.token!==token){disposeObject(gltf.scene);return;}
      const slot=world.userData.entrySlots.get(entry.id);if(!slot){disposeObject(gltf.scene);finish();return;}
      fit(gltf.scene,entry);gltf.scene.userData.memoryAssetId=entry.id;slot.anchor.add(gltf.scene);finish();
    },undefined,error=>{if(chunkState.token!==token)return;chunkState.errors.push({id:entry.id,message:error?.message||String(error)});finish();});
    audit();
  };
  const unloadChunk=id=>{
    const chunkState=state.chunks.get(id);if(!chunkState||chunkState.status==='idle')return;
    chunkState.token+=1;chunkState.status='idle';chunkState.errors=[];
    for(const entry of registry.entries.filter(item=>item.chunk===id)){
      const anchor=world.userData.entrySlots.get(entry.id)?.anchor;if(!anchor)continue;
      for(const child of [...anchor.children]){anchor.remove(child);disposeObject(child);}
    }
    audit();
  };
  const chunkDistance=(z,chunk)=>z>chunk.startZ?z-chunk.startZ:z<chunk.endZ?chunk.endZ-z:0;
  const stream=(force=false)=>{for(const chunk of registry.chunks){const distance=chunkDistance(state.position.z,chunk);if(distance<=34)loadChunk(chunk.id);else if(force||distance>72)unloadChunk(chunk.id);}};
  const nearest=(maxDistance=5.4)=>{
    let result=null,best=maxDistance;
    for(const entry of registry.entries){const point=world.userData.entrySlots.get(entry.id).interaction,distance=Math.hypot(state.position.x-point.x,state.position.z-point.z);if(distance<best){best=distance;result=entry;}}
    return result;
  };
  const story=document.getElementById('memoryStory');let storyOpen=false;
  const closeStory=()=>{storyOpen=false;state.activeEntry=null;story.classList.remove('show');};
  const openStory=entry=>{
    storyOpen=true;state.activeEntry=entry.id;
    document.getElementById('memoryStoryYears').textContent=`Opened ${entry.opened} · Removed ${entry.removed}`;
    document.getElementById('memoryStoryName').textContent=entry.name;document.getElementById('memoryStoryLocation').textContent=entry.location;document.getElementById('memoryStoryText').textContent=entry.story;document.getElementById('memoryStoryDisclosure').textContent=entry.disclosure;
    document.getElementById('memoryStoryEvidence').textContent=`Evidence: ${entry.evidenceStatus.replaceAll('-',' ')} · Publisher: ${registry.responsiblePublisher.name}`;
    document.getElementById('memoryStorySource').href=entry.sourceUrl;story.classList.add('show');document.getElementById('memoryStoryClose').focus();
  };
  document.getElementById('memoryStoryClose').addEventListener('click',closeStory);
  addEventListener('keydown',event=>{if(storyOpen&&event.key==='Escape'){event.preventDefault();closeStory();}});
  const setUrl=active=>{
    const url=new URL(location.href);if(active)url.searchParams.set('district','memory');else url.searchParams.delete('district');
    history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash}`);
  };
  const returnToSurface=()=>{
    if(getWorldMode()!=='memory'||transitioning)return;transitioning=true;
    worldTransition(()=>{
      restoreSurface(surfacePosition,surfaceForward);setWorldMode('surface');closeStory();for(const chunk of registry.chunks)unloadChunk(chunk.id);world.visible=false;setUrl(false);
      document.body.classList.remove('is-memory');document.getElementById('memoryHud').classList.remove('show');document.getElementById('chit').classList.add('show');hideCompass();transitioning=false;showToast('Memory District','Returned to the Island. Your round is exactly where you left it.');
    });
  };
  audit();
  return {
    get storyOpen(){return storyOpen;},
    setVisible(value){world.visible=value;},
    enter({direct=false}={}){
      const lifecycle=getLifecycle();if(transitioning||!lifecycle.started||lifecycle.finished||lifecycle.mode!=='surface'||lifecycle.dialogueOpen||lifecycle.diagnosing||lifecycle.vanMode!=='foot')return;
      const surface=getSurface(),distance=surface.position.clone().normalize().angleTo(surface.portalUnit)*surface.radius;
      if(!direct&&distance>3.8){showToast('Memory District',`The portal is ${Math.round(distance)}m away — walk closer to enter.`);return;}
      transitioning=true;surfacePosition=direct?surface.portalUnit.clone().multiplyScalar(surface.radius):surface.position;surfaceForward=direct?surface.directForward:surface.forward;
      worldTransition(()=>{
        state.position.set(0,0,6);state.forward.set(0,0,-1);player.position.copy(worldPosition());world.visible=true;stream();setWorldMode('memory');setUrl(true);
        document.getElementById('chit').classList.remove('show');document.body.classList.add('is-memory');document.getElementById('memoryHud').classList.add('show');hideCompass();transitioning=false;showToast('Memory District','Follow the demolition timeline. Press Enter beside a record to inspect its sourced story.');
      });
    },
    release(){closeStory();for(const chunk of registry.chunks)unloadChunk(chunk.id);world.visible=false;},
    returnToSurface,
    audit,
    step(dt){state.streamTimer-=dt;if(state.streamTimer<=0){state.streamTimer=.35;stream();}},
    stepPlayer(dt){
      const {keys,joyVec,speed,turnSpeed}=getControls();let throttle=0,turn=0;
      if(keys.w||keys.arrowup)throttle+=1;if(keys.s||keys.arrowdown)throttle-=.55;if(keys.a||keys.arrowleft)turn-=1;if(keys.d||keys.arrowright)turn+=1;
      throttle=THREE.MathUtils.clamp(throttle-joyVec.y,-.55,1);turn=THREE.MathUtils.clamp(turn+joyVec.x,-1,1);
      if(turn)state.forward.applyAxisAngle(UP,-turn*turnSpeed*dt);state.forward.y=0;state.forward.normalize();
      if(throttle){state.position.x+=state.forward.x*throttle*speed*dt;state.position.z+=state.forward.z*throttle*speed*dt;}
      state.position.x=THREE.MathUtils.clamp(state.position.x,BOUNDS.minX,BOUNDS.maxX);state.position.z=THREE.MathUtils.clamp(state.position.z,BOUNDS.minZ,BOUNDS.maxZ);
      const speedAbs=Math.abs(throttle);walkPhase+=dt*(speedAbs>0?11:2);const swing=Math.sin(walkPhase)*.75*speedAbs,{mixer,actions,getWalkWeight,setWalkWeight}=getAnimation();
      if(mixer){const weight=getWalkWeight()+((speedAbs>.05?1:0)-getWalkWeight())*Math.min(1,dt*9);setWalkWeight(weight);if(actions.walk){actions.walk.setEffectiveWeight(weight);actions.walk.timeScale=.6+speedAbs*.7;}if(actions.idle)actions.idle.setEffectiveWeight(1-weight);mixer.update(dt);}
      else{const {legs,arms}=player.userData;legs[0].rotation.x=swing;legs[1].rotation.x=-swing;arms[0].rotation.x=-swing*.85;arms[1].rotation.x=swing*.85;}
      player.position.copy(worldPosition()).addScaledVector(UP,Math.abs(Math.sin(walkPhase))*.07*speedAbs);
      const z=state.forward.clone(),x=new THREE.Vector3().crossVectors(UP,z).normalize();player.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,UP,z));
    },
    stepCamera(dt){
      const base=worldPosition(),z=state.forward.clone().normalize(),desired=base.clone().addScaledVector(UP,6.4).addScaledVector(z,-11.5),look=base.clone().addScaledVector(UP,1.7).addScaledVector(z,4.2);
      camera.position.lerp(desired,1-Math.pow(.0015,dt));camera.up.copy(UP);camera.lookAt(look);dir.position.copy(base).add(new THREE.Vector3(24,42,18));rim.position.copy(base).add(new THREE.Vector3(-30,18,-24));dirTarget.position.copy(base);dirTarget.updateMatrixWorld();
    },
    getActionState(){return{nearExit:state.position.z>=4.7,entry:nearest()};},
    updateActionUi({isTouch,actionPrompt,vanBtn,stationBtn,memoryBtn}){
      vanBtn.style.display='none';stationBtn.style.display='none';const {entry,nearExit}=this.getActionState();
      actionPrompt.textContent=nearExit?(isTouch?'Entrance ready · tap RETURN':'ENTER · RETURN TO ISLAND'):(entry?(isTouch?'Timeline record nearby · tap INSPECT':`ENTER · INSPECT ${entry.name.toUpperCase()}`):'FOLLOW THE RED TIMELINE · RECORDS ALTERNATE LEFT AND RIGHT');actionPrompt.classList.add('show');
      if(isTouch){memoryBtn.style.display='block';memoryBtn.textContent=nearExit?'RETURN':'INSPECT';memoryBtn.setAttribute('aria-label',nearExit?'Return to the Island':'Inspect nearby heritage record');}
    },
    tryAction(){if(storyOpen){closeStory();return;}if(state.position.z>=4.7){returnToSurface();return;}const entry=nearest();if(entry)openStory(entry);else showToast('Memory District','Move closer to a timeline record to inspect its story.');},
  };
}
