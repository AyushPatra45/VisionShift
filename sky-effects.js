// Original, bounded simulation shared by the constellation and sparkler scenes.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function createSkySimulation(random = Math.random) {
  let stars = [], sparks = [], charge = 0, palmSince = null, burstAt = -Infinity;
  let lastTip = null, emission = 0, previousAt = null, serial = 0;
  const reset = () => { stars = []; sparks = []; charge = 0; palmSince = null; burstAt = -Infinity; lastTip = null; emission = 0; previousAt = null; serial = 0; };
  function spark(x, y, speed, hue, now) {
    const angle = random() * Math.PI * 2;
    const velocity = speed * (.3 + random() * .7);
    sparks.push({ x, y, px:x, py:y, vx:Math.cos(angle)*velocity, vy:Math.sin(angle)*velocity,
      born:now, life:650+random()*1250, hue, size:.7+random()*1.7 });
  }
  function update({ mode, now, point = null, fist = false, palm = false, width = 720, height = 540 }) {
    const dt = clamp(previousAt === null ? 1/60 : (now-previousAt)/1000, 0, .05);
    previousAt = now;
    if (mode === "stars") {
      if (point && !palm && !fist) {
        if (!stars.some(s=>Math.hypot(s.x-point.x,s.y-point.y)<30)) {
          stars.push({x:point.x,y:point.y,born:now,id:serial++,radius:2+random()*2});
          if(stars.length>80)stars.shift();
        }
      }
      if (fist && stars.length>=2) charge=clamp(charge+dt/.9,0,1);
      // A brief false open-palm detection must not erase a constellation.
      if(palm){palmSince ??= now;}else palmSince=null;
      if(palmSince!==null && now-palmSince>=120 && charge>=.35 && stars.length>=2){
        for(const star of stars)for(let i=0;i<10;i++)spark(star.x,star.y,100+charge*180,190+random()*105,now);
        stars=[];charge=0;burstAt=now;
      }
    } else {
      if(point){
        emission+=dt*160;
        const count=Math.min(20,Math.floor(emission));emission-=count;
        // Break a trail after reacquisition rather than drawing across the frame.
        const previous=lastTip&&Math.hypot(point.x-lastTip.x,point.y-lastTip.y)<width*.3?lastTip:point;
        for(let i=0;i<count;i++){
          const t=(i+1)/count;
          spark(previous.x+(point.x-previous.x)*t,previous.y+(point.y-previous.y)*t,60+random()*150,32+random()*24,now);
        }
        lastTip={...point};
      }else{lastTip=null;emission=0;}
    }
    if(sparks.length>1000)sparks.splice(0,sparks.length-1000);
    for(const p of sparks){
      p.px=p.x;p.py=p.y;p.vy+=(mode==="stars"?35:100)*dt;
      p.vx*=Math.exp(-.8*dt);p.vy*=Math.exp(-.3*dt);p.x+=p.vx*dt;p.y+=p.vy*dt;
    }
    sparks=sparks.filter(p=>now-p.born<p.life&&p.y<height+60&&p.x>-80&&p.x<width+80);
    const label=mode==="sparkler"?(point?"SPARKLER · WRITE WITH LIGHT":"POINT TO LIGHT THE SPARKLER"):
      now-burstAt<1800?"MAKE A WISH":!stars.length?"POINT TO PLACE STARS":
      charge>=1?"CHARGED · OPEN YOUR PALM":fist?`CHARGING ${Math.round(charge*100)}%`:
      charge>=.35?"OPEN PALM TO RELEASE":"CLOSE YOUR FIST TO CHARGE";
    return {stars,sparks,charge,label,burst:now-burstAt<1800};
  }
  return {update,reset,get stats(){return {stars:stars.length,sparks:sparks.length,charge};}};
}

export function paintSky(ctx, canvas, state, now, point = null) {
  ctx.save();ctx.globalCompositeOperation="screen";
  // Distant stars provide a quiet depth layer, not an opaque camera replacement.
  for(let i=0;i<60;i++){
    const x=((i*137.508)%997)/997*canvas.width,y=((i*81.337)%719)/719*canvas.height;
    ctx.fillStyle=`rgba(176,196,255,${.12+.1*Math.sin(now*.001+i)})`;
    ctx.fillRect(x,y,1.2,1.2);
  }
  const {stars,sparks,charge}=state;
  for(let i=0;i<stars.length;i++){
    const a=stars[i];
    const neighbors=stars.slice(0,i).map(b=>({b,d:Math.hypot(a.x-b.x,a.y-b.y)})).filter(n=>n.d<canvas.width*.32).sort((a,b)=>a.d-b.d).slice(0,2);
    for(const {b,d} of neighbors){
      ctx.strokeStyle=`rgba(145,194,255,${(.22+charge*.65)*(1-d/(canvas.width*.4))})`;
      ctx.lineWidth=1+charge;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    const r=a.radius*(1+charge*.8),born=clamp((now-a.born)/180,0,1);
    const glow=ctx.createRadialGradient(a.x,a.y,0,a.x,a.y,r*6);
    glow.addColorStop(0,"rgba(171,210,255,.7)");glow.addColorStop(1,"rgba(105,121,255,0)");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(a.x,a.y,r*6*born,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff5dc";ctx.beginPath();ctx.arc(a.x,a.y,r*born,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#d1e8ff";ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(a.x-r*3,a.y);ctx.lineTo(a.x+r*3,a.y);ctx.moveTo(a.x,a.y-r*3);ctx.lineTo(a.x,a.y+r*3);ctx.stroke();
  }
  ctx.lineCap="round";
  for(const p of sparks){
    const fade=clamp(1-(now-p.born)/p.life,0,1);
    ctx.strokeStyle=`hsla(${p.hue},100%,${60+fade*30}%,${fade})`;ctx.lineWidth=p.size*fade;
    ctx.beginPath();ctx.moveTo(p.px,p.py);ctx.lineTo(p.x,p.y);ctx.stroke();
    if(fade>.6){ctx.fillStyle=`hsla(${p.hue},100%,72%,.13)`;ctx.beginPath();ctx.arc(p.x,p.y,p.size*3,0,Math.PI*2);ctx.fill();}
  }
  if(point){const glow=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,25);glow.addColorStop(0,"#fffce0");glow.addColorStop(.12,"#ffe199");glow.addColorStop(1,"rgba(255,157,42,0)");ctx.fillStyle=glow;ctx.fillRect(point.x-25,point.y-25,50,50);}
  ctx.restore();
}
