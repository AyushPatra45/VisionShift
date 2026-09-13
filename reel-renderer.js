import { REACTIONS, chooseReaction, handQuad, projectQuad } from "./reel-utils.js";
import { HeldAction } from "./studio-utils.js";
import { isPinching } from "./interaction-utils.js";

export function createReelRenderer(video,canvas,ctx) {
  const assets=new Map(), gate=new HeldAction(220);
  let shown=null, until=0, manualUntil=0, baseline={}, calibratingUntil=0, samples=[];
  let quad=null,pinchLatched=false, captured=false, lastStyleAt=0;
  const photo=document.createElement("canvas"), texture=document.createElement("canvas");
  photo.width=texture.width=320;photo.height=texture.height=320;
  const pc=photo.getContext("2d"),tc=texture.getContext("2d",{willReadFrequently:true});
  const overlay=document.createElement("img");
  overlay.className="reaction-overlay";overlay.alt="";overlay.hidden=true;
  document.querySelector("#stage").append(overlay);
  for(const name of Object.keys(REACTIONS)) {
    const img=new Image();img.src=`./assets/reactions/${name}.${name==="spin"?"gif":"jpeg"}`;assets.set(name,img);
  }
  const info=document.querySelector("#reactionInfo"), select=document.querySelector("#reactionSelect");
  for(const [value,text] of Object.entries(REACTIONS))select.add(new Option(text,value));
  document.querySelector("#testConfetti").textContent="Preview selected meme";
  document.querySelector("#testConfetti").addEventListener("click",()=>{shown=select.value;manualUntil=performance.now()+2500;});
  document.querySelector("#calibrateFace").addEventListener("click",()=>{samples=[];calibratingUntil=performance.now()+7000;});
  const upload=document.querySelector("#reactionUpload");
  upload.addEventListener("change",()=>{
    const file=upload.files[0];if(!file)return;
    if(!["image/png","image/jpeg","image/gif","image/webp"].includes(file.type)||file.size>12*1024*1024){info.textContent="Choose a PNG, JPEG, GIF or WebP under 12 MB.";return;}
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{const old=assets.get(select.value);if(old?.src.startsWith("blob:"))URL.revokeObjectURL(old.src);assets.set(select.value,img);info.textContent="Custom meme ready. Kept only in this session.";};
    img.onerror=()=>{URL.revokeObjectURL(url);info.textContent="Could not read that image.";};img.src=url;
  });
  function hide(){overlay.hidden=true;gate.reset();shown=null;until=0;manualUntil=0;calibratingUntil=0;}
  function reactions(points,hands,shapes,now,ready) {
    if(calibratingUntil) {
      if(points)samples.push({...shapes});
      info.textContent=`Keep a relaxed neutral face: ${Math.max(0,Math.ceil((calibratingUntil-now)/1000))}s`;
      if(now>=calibratingUntil){calibratingUntil=0;
        if(samples.length<20)info.textContent="Not enough face samples. Face the camera and calibrate again.";
        else {baseline={};for(const key of Object.keys(samples[0]))baseline[key]=samples.reduce((s,x)=>s+(x[key]||0),0)/samples.length;info.textContent="Neutral face calibrated. Try the gestures below.";}
      }
      overlay.hidden=true;return "CALIBRATING";
    }
    if(!ready){overlay.hidden=true;return null;}
    if(now>manualUntil){const hit=gate.update(chooseReaction(points,hands,shapes,baseline),now);if(hit){shown=hit;until=now+450;}else if(now>until)shown=null;}
    const img=assets.get(shown);
    if(!img?.complete||!img.naturalWidth){overlay.hidden=true;return null;}
    let x=canvas.width*.5,y=canvas.height*.35,w=canvas.width*.38;
    if(points?.[454]){w=Math.max(110,Math.hypot(points[234].x-points[454].x,points[234].y-points[454].y)*canvas.width*1.6);x=points[1].x*canvas.width;y=points[10].y*canvas.height-w*.35;}
    w=Math.min(canvas.width*.65,w);const h=Math.min(canvas.height*.65,w*img.naturalHeight/img.naturalWidth);
    x=Math.max(w/2,Math.min(canvas.width-w/2,x));y=Math.max(h/2+20,Math.min(canvas.height-h/2,y));
    overlay.src=img.src;overlay.hidden=false;
    overlay.style.left=`${(1-(x+w/2)/canvas.width)*100}%`;overlay.style.top=`${(y-h/2)/canvas.height*100}%`;
    overlay.style.width=`${w/canvas.width*100}%`;overlay.style.height=`${h/canvas.height*100}%`;
    overlay.alt=REACTIONS[shown];
    // Mirror the bitmap once before the output canvas is mirrored by CSS.
    ctx.save();ctx.translate(x+w/2,y-h/2);ctx.scale(-1,1);ctx.drawImage(img,0,0,w,h);ctx.restore();
    return REACTIONS[shown].toUpperCase();
  }
  function capture(){if(!video.videoWidth)return;const size=Math.min(video.videoWidth,video.videoHeight);pc.drawImage(video,(video.videoWidth-size)/2,(video.videoHeight-size)/2,size,size,0,0,320,320);captured=true;}
  document.querySelector("#recaptureFrame").addEventListener("click",capture);
  function stylize(style){
    tc.drawImage(photo,0,0);
    if(style==="normal")return;
    const image=tc.getImageData(0,0,320,320),src=new Uint8ClampedArray(image.data),d=image.data;
    const palettes=[[16,10,45],[77,28,145],[202,37,111],[255,135,40],[255,241,137]];
    for(let y=0;y<320;y++)for(let x=0;x<320;x++){
      const i=(y*320+x)*4,l=(src[i]+src[i+1]+src[i+2])/3;
      const edge=x<319&&y<319?Math.abs(l-(src[i+4]+src[i+5]+src[i+6])/3)+Math.abs(l-(src[i+1280]+src[i+1281]+src[i+1282])/3):0;
      if(style==="thermal") {const c=palettes[Math.min(4,Math.floor(l/52))];d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];}
      else if(style==="sketch"){d[i]=d[i+1]=d[i+2]=Math.max(0,255-edge*6);}
      else if(style==="pixel"){const j=(Math.floor(y/10)*10*320+Math.floor(x/10)*10)*4;d[i]=src[j];d[i+1]=src[j+1];d[i+2]=src[j+2];}
      else if(style==="mono"){d[i]=d[i+1]=d[i+2]=l;}
      else if(style==="neon"){d[i]=l*.6+edge*3;d[i+1]=edge*4;d[i+2]=l+edge*3;}
      else {for(let c=0;c<3;c++)d[i+c]=edge>24?20:Math.round(src[i+c]/64)*64;}
    }
    tc.putImageData(image,0,0);
  }
  function triangle(source,dest){
    const [a,b,c]=source,[p,q,r]=dest;
    const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(det)<.001)return;
    const A=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det;
    const C=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det;
    const B=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det;
    const D=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;
    ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();
    ctx.transform(A,B,C,D,p.x-A*a.x-C*a.y,p.y-B*a.x-D*a.y);ctx.drawImage(texture,0,0);ctx.restore();
  }
  function frame(hands,style,frozen,now){
    const pinching=hands.some(hand=>isPinching(hand,.4));
    if(pinching&&!pinchLatched){capture();document.querySelector("#frameHint").textContent="Photo captured. Open your hands to tilt it; pinch again to recapture.";}
    pinchLatched=pinching;
    const target=handQuad(hands,canvas.width,canvas.height);
    if(target&&!pinching){if(!quad)quad=target;else quad=quad.map((p,i)=>({x:p.x+(target[i].x-p.x)*.25,y:p.y+(target[i].y-p.y)*.25}));}
    if(!quad)return "SHOW BOTH THUMBS + INDEX FINGERS";
    if(!captured||(!frozen&&document.querySelector("#liveFrame").checked))capture();
    if(now-lastStyleAt>100){stylize(style);lastStyleAt=now;}
    const steps=8;
    for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){
      const uv=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([a,b])=>({x:a/steps,y:b/steps}));
      const dst=uv.map(p=>projectQuad(quad,p.x,p.y)),src=uv.map(p=>({x:p.x*320,y:p.y*320}));
      triangle([src[0],src[1],src[2]],[dst[0],dst[1],dst[2]]);triangle([src[0],src[2],src[3]],[dst[0],dst[2],dst[3]]);
    }
    ctx.strokeStyle="#c8ff42";ctx.lineWidth=2;ctx.beginPath();quad.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
    return "PINCH TO CAPTURE · TILT TO MOVE";
  }
  return {reactions,frame,hide};
}
