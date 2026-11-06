import * as THREE from 'three';
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const MATERIAL_TYPES = new Set(['MeshStandardMaterial','MeshLambertMaterial','MeshBasicMaterial']);
const MATERIAL_PROPERTIES = ['type','map','normalMap','roughnessMap','metalnessMap','aoMap','aoMapIntensity','envMap','envMapIntensity','normalMapType','bumpMap','bumpScale','lightMap','lightMapIntensity','displacementMap','displacementScale','displacementBias','flatShading','blending','blendSrc','blendDst','depthFunc','colorWrite','toneMapped','opacity','metalness','roughness','side','depthTest','depthWrite','fog'];
// Live render proxies preserve original Mesh transforms, material references,
// visibility and collision data. Nothing is removed from the gameplay graph.
export class RenderBatches {
  constructor(scene, { minInstances = 3 } = {}) {
    this.minInstances=minInstances;
    this.scene=scene;this.records=[];this.seen=new WeakSet();this.shapes=new WeakMap();this.groups=new Map();this.lods=[];this.lastScan=-Infinity;this.frame=0;this.materialKeys=new WeakMap();
    this.matrix=new THREE.Matrix4();this.color=new THREE.Color();this.stats={instances:0,batches:0};
  }
  shape(mesh) {
    const g=mesh.geometry;
    if(g.type!=='BoxGeometry'||g.attributes.position.count!==24||g.attributes.position.version!==0||g.attributes.normal?.version!==0)return null;
    for(const name in g.morphAttributes)return null;
    let cached=this.shapes.get(g);if(cached)return cached;
    g.computeBoundingBox();const b=g.boundingBox,size=new THREE.Vector3(),center=new THREE.Vector3();b.getSize(size);b.getCenter(center);
    if(Math.max(size.x,size.y,size.z)>40||Math.min(size.x,size.y,size.z)<=0)return null;
    const p=g.attributes.position, uv=g.attributes.uv, baseUV=unitBox.attributes.uv;
    // Metre-scaled/custom facade UVs cannot be replaced by a unit-box mapping.
    if(!uv||uv.count!==baseUV.count)return null;
    for(let i=0;i<uv.array.length;i++)if(Math.abs(uv.array[i]-baseUV.array[i])>1e-6)return null;
    for(let i=0;i<p.count;i++)for(const [axis,min,max]of [['X',b.min.x,b.max.x],['Y',b.min.y,b.max.y],['Z',b.min.z,b.max.z]]){
      const v=p['get'+axis](i);if(Math.abs(v-min)>1e-5&&Math.abs(v-max)>1e-5)return null;
    }
    cached=new THREE.Matrix4().compose(center,new THREE.Quaternion(),size);this.shapes.set(g,cached);return cached;
  }
  eligible(o) {
    const m=o.material;
    return o.isMesh&&!o.isSkinnedMesh&&!o.isInstancedMesh&&!Array.isArray(m)&&
      MATERIAL_TYPES.has(m?.type)&&
      m.onBeforeCompile===THREE.Material.prototype.onBeforeCompile&&!m.displacementMap&&
      !m.transparent&&!m.vertexColors&&!m.wireframe&&!m.alphaTest&&!m.polygonOffset&&!m.clippingPlanes&&
      (!m.emissive||m.emissive.getHex()===0)&&o.onBeforeRender===THREE.Object3D.prototype.onBeforeRender&&this.shape(o);
  }
  materialKey(material) {
    let cache=this.materialKeys.get(material);
    if(cache?.frame===this.frame)return cache.key;
    const x=material.normalScale?.x,y=material.normalScale?.y;
    let same=!!cache&&cache.normalX===x&&cache.normalY===y;
    if(same)for(let i=0;i<MATERIAL_PROPERTIES.length;i++)if(cache.values[i]!==material[MATERIAL_PROPERTIES[i]]){same=false;break;}
    if(!same) {
      const values=MATERIAL_PROPERTIES.map(name=>material[name]);
      cache={values,normalX:x,normalY:y,key:values.map(value=>value?.isTexture?value.uuid:value).join('|')+`|${x}|${y}`};
      this.materialKeys.set(material,cache);
    }
    cache.frame=this.frame;return cache.key;
  }
  key(record) {
    const o=record.mesh,p=o.matrixWorld.elements,x=Math.floor(p[12]/96),z=Math.floor(p[14]/96),
      shadow=(o.castShadow?1:0)|(o.receiveShadow?2:0),material=this.materialKey(o.material);
    // Reuse the cell/signature string until a source actually changes. Colour
    // remains live instance data and never requires rebuilding the signature.
    if(record.x!==x||record.z!==z||record.shadow!==shadow||record.materialKey!==material){
      record.x=x;record.z=z;record.shadow=shadow;record.materialKey=material;
      record.key=`${x},${z}|${shadow}|${material}`;
    }
    return record.key;
  }
  scan(now) {
    if(now-this.lastScan<500)return;this.lastScan=now;
    // Removed vehicles must not leave proxy ghosts or retained source graphs.
    const attached=o=>{for(let p=o;p;p=p.parent)if(p===this.scene)return true;return false;};
    this.records=this.records.filter(r=>{if(attached(r.mesh))return true;r.mesh.layers.mask=r.mask;this.seen.delete(r.mesh);return false;});
    this.lods=this.lods.filter(o=>{if(attached(o))return true;o.autoUpdate=true;this.seen.delete(o);return false;});
    this.scene.traverse(o=>{
      if(o.userData.renderProxy)return;
      if(o.isLOD&&!this.seen.has(o)){o.autoUpdate=false;this.lods.push(o);this.seen.add(o);}
      else if(!this.seen.has(o)&&this.eligible(o)){this.records.push({mesh:o,shape:this.shape(o),mask:o.layers.mask});this.seen.add(o);}
    });
  }
  bucket(key,source) {
    let b=this.groups.get(key);if(b)return b;
    const material=source.material.clone();material.color.set(0xffffff);
    const mesh=new THREE.InstancedMesh(unitBox,material,16);mesh.userData.renderProxy=true;mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;
    this.scene.add(mesh);b={mesh,used:0,capacity:16};this.groups.set(key,b);return b;
  }
  update(camera,now=performance.now()) {
    this.frame++;this.scan(now);this.scene.updateMatrixWorld();camera.updateMatrixWorld();
    for(const lod of this.lods)lod.update(camera);
    for(const b of this.groups.values())b.used=0;
    let instances=0;
    const visibleGroups=new Map();
    for(const record of this.records){
      const o=record.mesh;
      if(!o.parent||!this.eligible(o)||o.matrixWorld.determinant()<0){o.layers.mask=record.mask;continue;}
      let visible=true,attached=false;
      for(let p=o;p;p=p.parent){if(!p.visible)visible=false;if(p===this.scene)attached=true;}
      o.layers.mask=record.mask;
      if(!visible||!attached)continue;
      const key=this.key(record);
      if(!visibleGroups.has(key))visibleGroups.set(key,[]);
      visibleGroups.get(key).push(record);
    }
    // Single objects gain nothing from instancing. Keep their original path,
    // avoiding hundreds of proxy materials and sparse buffers across the city.
    for(const [key,records] of visibleGroups){
      if(records.length<this.minInstances)continue;
      const b=this.bucket(key,records[0].mesh);
      for(const record of records){
      const o=record.mesh;o.layers.mask=0;
      if(b.used===b.capacity){
        const old=b.mesh,next=new THREE.InstancedMesh(unitBox,old.material,b.capacity*2);next.userData.renderProxy=true;next.castShadow=old.castShadow;next.receiveShadow=old.receiveShadow;next.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        next.instanceMatrix.array.set(old.instanceMatrix.array);if(old.instanceColor){next.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(b.capacity*2*3),3);next.instanceColor.array.set(old.instanceColor.array);}
        this.scene.remove(old);old.dispose();this.scene.add(next);b.mesh=next;b.capacity*=2;
      }
      this.matrix.multiplyMatrices(o.matrixWorld,record.shape);b.mesh.setMatrixAt(b.used,this.matrix);b.mesh.setColorAt(b.used,o.material.color);b.used++;instances++;
    }
    }
    for(const [key,b] of this.groups){
      if(!b.used){b.idleSince??=now;if(now-b.idleSince>10000){this.scene.remove(b.mesh);b.mesh.dispose();b.mesh.material.dispose();this.groups.delete(key);continue;}}else b.idleSince=null;
      b.mesh.count=b.used;b.mesh.visible=b.used>0;
      if(b.used){b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;b.mesh.computeBoundingSphere();}
    }
    this.stats={instances,batches:[...this.groups.values()].filter(b=>b.used).length};
  }
}
