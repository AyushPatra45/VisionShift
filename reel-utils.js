// Browser adaptation of the face-relative rules in gazijarin/itsgiving.
// See THIRD_PARTY_NOTICES.md for attribution and license.
export const REACTIONS = {
  open_mouth: "Gasp", heart: "Heart hands", cover_nose: "Cover mouth",
  crashing_out: "Hands on head", flirty: "Finger on lips", hand_up: "Hand up",
  disgusted: "Disgust", suspicious: "Side-eye", spin: "Leave frame",
};
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function chooseReaction(points, hands, shapes, baseline = {}) {
  if (!points?.[454]) return hands.length ? null : "spin";
  const width = Math.max(.04,distance(points[234],points[454]));
  const near = (a,b,k) => distance(a,b)<width*k;
  const nose=points[1], mouth=points[13];
  const jaw=(shapes.jawOpen||0)-(baseline.jawOpen||0);
  if(hands.length>1) {
    const [a,b]=hands;
    if(near(a[8],b[8],.3)&&near(a[4],b[4],.3)&&a[8].y+b[8].y<a[4].y+b[4].y) return "heart";
    if(near(a[9],mouth,.6)&&near(b[9],mouth,.6)) return "cover_nose";
    if(jaw>.35 && [a,b].every(h=>h[9].y<points[33].y&&Math.abs(h[9].x-nose.x)<width*1.1)) return "crashing_out";
  }
  for(const h of hands) {
    if(near(h[8],mouth,.22)&&!near(h[9],mouth,.3)) return "flirty";
    if(h[9].y<nose.y&&Math.abs(h[9].x-nose.x)>width*.8&&distance(h[12],h[0])>distance(h[10],h[0])*1.13) return "hand_up";
  }
  if(jaw>.25) return "open_mouth";
  if(Math.max((shapes.noseSneerLeft||0)-(baseline.noseSneerLeft||0),(shapes.noseSneerRight||0)-(baseline.noseSneerRight||0))>.3) return "disgusted";
  const center=(points[234].x+points[454].x)/2;
  if(Math.abs(nose.x-center)/width>.16&&Math.max(shapes.eyeSquintLeft||0,shapes.eyeSquintRight||0)>.3) return "suspicious";
  return null;
}

export function handQuad(hands,w,h) {
  if(hands.length<2) return null;
  const pts=hands.slice(0,2).flatMap(hand=>[hand[4],hand[8]]).map(p=>({x:p.x*w,y:p.y*h}));
  if(!pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
  const center={x:pts.reduce((s,p)=>s+p.x,0)/4,y:pts.reduce((s,p)=>s+p.y,0)/4};
  pts.sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x));
  const first=pts.reduce((best,p,i)=>p.x+p.y<pts[best].x+pts[best].y?i:best,0);
  const q=pts.map((_,i)=>pts[(first+i)%4]);
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
  if(q.some((p,i)=>cross(p,q[(i+1)%4],q[(i+2)%4])<10))return null;
  const area=Math.abs(q.reduce((s,p,i)=>s+p.x*q[(i+1)%4].y-p.y*q[(i+1)%4].x,0))/2;
  return area>1800?q:null;
}

// A steady two-hand transform for people who do not want to hold four exact
// fingertip corners. Palm centers control position, distance controls size and
// the line between the palms controls rotation.
export function easyFrameQuad(hands, w, h, aspect = 1.42) {
  const a = hands?.[0]?.[9], b = hands?.[1]?.[9];
  if (!a || !b || ![a.x, a.y, b.x, b.y, w, h].every(Number.isFinite)) return null;
  const ax = a.x * w, ay = a.y * h, bx = b.x * w, by = b.y * h;
  const distance = Math.hypot(bx - ax, by - ay);
  if (distance < Math.min(w, h) * .12) return null;
  const width = Math.max(150, Math.min(w * .76, distance * 1.16));
  const height = Math.min(h * .62, width / aspect);
  const angle = Math.atan2(by - ay, bx - ax);
  const ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux;
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const corner = (sx, sy) => ({ x: cx + ux * width * sx + vx * height * sy, y: cy + uy * width * sx + vy * height * sy });
  const q = [corner(-.5, -.5), corner(.5, -.5), corner(.5, .5), corner(-.5, .5)];
  const minX = Math.min(...q.map(p => p.x)), maxX = Math.max(...q.map(p => p.x));
  const minY = Math.min(...q.map(p => p.y)), maxY = Math.max(...q.map(p => p.y));
  const dx = minX < 16 ? 16 - minX : maxX > w - 16 ? w - 16 - maxX : 0;
  const dy = minY < 16 ? 16 - minY : maxY > h - 16 ? h - 16 - maxY : 0;
  return q.map(p => ({ x: p.x + dx, y: p.y + dy }));
}

// Homography for a unit square projected onto four corners.
export function projectQuad(q,u,v) {
  const [a,b,c,d]=q;
  const dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x;
  const dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y;
  const det=dx1*dy2-dx2*dy1;
  const g=Math.abs(det)<1e-8?0:(dx3*dy2-dx2*dy3)/det;
  const k=Math.abs(det)<1e-8?0:(dx1*dy3-dx3*dy1)/det;
  const denominator=g*u+k*v+1;
  return {x:((b.x-a.x+g*b.x)*u+(d.x-a.x+k*d.x)*v+a.x)/denominator,
    y:((b.y-a.y+g*b.y)*u+(d.y-a.y+k*d.y)*v+a.y)/denominator};
}
