import * as THREE from "./node_modules/three/build/three.module.js";

// Original procedural meshes. No model assets or code from the reel are bundled.
export function createGarden3D() {
  const surface=document.createElement("canvas");
  const renderer=new THREE.WebGLRenderer({canvas:surface,alpha:true,antialias:true,powerPreference:"low-power"});
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(39,4/3,.1,40);
  camera.position.set(0,.55,7.5);camera.lookAt(0,.05,0);
  scene.add(new THREE.HemisphereLight(0xdbeaff,0x251323,2));
  const key=new THREE.DirectionalLight(0xffd9cf,3.2);key.position.set(3,5,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0x849eff,4);rim.position.set(-3,2,-3);scene.add(rim);
  const plant=new THREE.Group();scene.add(plant);
  const green=new THREE.MeshStandardMaterial({color:0x3c8755,roughness:.48,metalness:.08});
  const red=new THREE.MeshPhysicalMaterial({color:0xe61943,roughness:.36,metalness:.08,side:THREE.DoubleSide,clearcoat:.45,clearcoatRoughness:.3});
  const filament=new THREE.MeshStandardMaterial({color:0xff8793,roughness:.45,emissive:0x3f0814,emissiveIntensity:.4});
  const gold=new THREE.MeshStandardMaterial({color:0xffd69b,roughness:.35,metalness:.25});
  const stems=new THREE.Group();plant.add(stems);
  const heads=[];
  const baseY=-1.9;
  function tube(points,radius,material=green,segments=28){
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,5,false),material);
  }
  const positions=[[0,1.18,0],[-.9,.5,.24],[.83,.17,-.16],[-.55,-.15,-.5],[.68,.88,-.36]];
  for(let i=0;i<positions.length;i++){
    const [x,y,z]=positions[i];
    stems.add(tube([[0,baseY,0],[x*.1,-1.05,z*.3],[x*.85,y-.65,z],[x,y,z]],i===0?.034:.021));
  }
  // Lance-shaped leaves have a folded center ridge, catching the side light.
  const leafGeometry=new THREE.BufferGeometry();
  const leafVertices=[],leafIndices=[];
  for(let i=0;i<=16;i++){
    const t=i/16,w=Math.sin(Math.PI*t)*.105;
    for(let j=0;j<3;j++)leafVertices.push(t*.8,(j===1?.045:0)*Math.sin(Math.PI*t)+Math.sin(t*Math.PI)*.12,(j-1)*w);
  }
  for(let i=0;i<16;i++)for(let j=0;j<2;j++){const k=i*3+j;leafIndices.push(k,k+3,k+1,k+1,k+3,k+4);}
  leafGeometry.setAttribute("position",new THREE.Float32BufferAttribute(leafVertices,3));leafGeometry.setIndex(leafIndices);leafGeometry.computeVertexNormals();
  const leafMaterial=new THREE.MeshStandardMaterial({color:0x42865b,roughness:.55,side:THREE.DoubleSide});
  for(let i=0;i<7;i++){
    const leaf=new THREE.Mesh(leafGeometry,leafMaterial);
    leaf.position.set(0,-1.65+i*.21,0);leaf.rotation.set(.4,i*2.39996,.35+i*.05);stems.add(leaf);
  }
  const petalGeometry=new THREE.BufferGeometry(),petalVertices=new Float32Array(33*7*3),petalIndices=[];
  for(let i=0;i<32;i++)for(let j=0;j<6;j++){const k=i*7+j;petalIndices.push(k,k+7,k+1,k+1,k+7,k+8);}
  petalGeometry.setAttribute("position",new THREE.BufferAttribute(petalVertices,3));petalGeometry.setIndex(petalIndices);
  let previousBloom=-1;
  function shapePetals(bloom){
    if(Math.abs(bloom-previousBloom)<.002)return;
    previousBloom=bloom;
    for(let i=0;i<=32;i++)for(let j=0;j<7;j++){
      const t=i/32,u=j/6*2-1,k=(i*7+j)*3;
      const width=(.017+Math.sin(Math.PI*t)*.09)*(1+.15*Math.sin(t*21));
      const outward=(.08*t+bloom*(.86*Math.sin(t*1.75)-.29*Math.pow(t,5)));
      petalVertices[k]=outward;
      petalVertices[k+1]=.92*t*(1-bloom*.5)-bloom*.72*Math.pow(t,3)+.028*Math.cos(u*Math.PI)*Math.sin(t*Math.PI);
      petalVertices[k+2]=u*width*(.35+bloom*.65)+.025*Math.sin(t*13)*u*u*bloom;
    }
    petalGeometry.attributes.position.needsUpdate=true;petalGeometry.computeVertexNormals();petalGeometry.computeBoundingSphere();
  }
  const stamenGeometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,0),new THREE.Vector3(.26,.35,0),new THREE.Vector3(.71,.57,0),new THREE.Vector3(1.04,.47,0)
  ]),20,.0055,4,false);
  const antherGeometry=new THREE.SphereGeometry(.025,8,5);
  const calyxGeometry=new THREE.SphereGeometry(.075,10,8);
  positions.forEach((position,index)=>{
    const head=new THREE.Group();head.userData.position=position;head.userData.size=index===0?1:.64+index*.03;
    // Each six-petal corolla is tilted a little differently for visible depth.
    head.rotation.set(.13+index*.06,index*.7,index%2?.18:-.13);
    for(let i=0;i<6;i++){const petal=new THREE.Mesh(petalGeometry,red);petal.rotation.y=i*Math.PI/3;head.add(petal);}
    const stamens=new THREE.Group();head.add(stamens);head.userData.stamens=stamens;
    for(let i=0;i<9;i++){
      const spoke=new THREE.Group();spoke.rotation.y=i*Math.PI*2/9+.18;
      spoke.rotation.z=(i%3-1)*.08;
      spoke.add(new THREE.Mesh(stamenGeometry,filament));
      const tip=new THREE.Mesh(antherGeometry,gold);tip.position.set(1.04,.47,0);tip.scale.set(1.45,.6,.65);spoke.add(tip);stamens.add(spoke);
    }
    const calyx=new THREE.Mesh(calyxGeometry,green);calyx.scale.y=.65;head.add(calyx);
    heads.push(head);plant.add(head);
  });
  let lost=false,lastWidth=0,lastHeight=0;
  surface.addEventListener("webglcontextlost",event=>{event.preventDefault();lost=true;});
  surface.addEventListener("webglcontextrestored",()=>{lost=false;});
  function render({width,height,growth,bloom,angle=0,now=0}){
    if(lost)throw new Error("3D graphics context was interrupted");
    if(width!==lastWidth||height!==lastHeight){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();lastWidth=width;lastHeight=height;}
    const g=Math.max(.025,growth);
    shapePetals(bloom);
    stems.scale.y=g;stems.position.y=baseY*(1-g);
    heads.forEach((head,index)=>{
      const [x,y,z]=head.userData.position;
      head.position.set(x,baseY+(y-baseY)*g,z);
      const appear=Math.max(.001,Math.min(1,(g-.15-index*.07)*2.8));
      head.scale.setScalar(head.userData.size*appear);
      head.userData.stamens.scale.set(.08+bloom*.92,.55+bloom*.45,.08+bloom*.92);
    });
    plant.rotation.y=angle+Math.sin(now*.0003)*.04;
    renderer.render(scene,camera);
    return surface;
  }
  function dispose(){
    const geometries=new Set(),materials=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();
  }
  return {render,dispose};
}
