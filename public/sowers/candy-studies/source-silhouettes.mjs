/** Original, dependency-free y-up paths. The same XY geometry drives the
 * mascot, monochrome reviews and positive-master conversation aids. */
const freezePoints = points => Object.freeze(points.map(point => Object.freeze(point)));
const spec = (name,character,face,points) => Object.freeze({ name,character,cornerRadius:.060,depth:.20,
  face:Object.freeze(face),points:freezePoints(points) });
export const CANDY_VARIANTS = Object.freeze({
  scout: spec('Scout / Seed Packet','A broad rounded helmet crown, compact packet body and integral mitten tabs.',
    {x:0,y:.745,width:.56,height:.245,radius:.09},[
      [-.25,0],[-.065,0],[-.055,.105],[.055,.105],[.065,0],[.25,0],
      [.28,.075],[.23,.25],[.25,.36],[.34,.335],[.385,.405],[.355,.49],
      [.29,.55],[.38,.62],[.40,.875],[.30,1],[-.30,1],[-.40,.875],
      [-.38,.62],[-.29,.55],[-.355,.49],[-.385,.405],[-.34,.335],[-.25,.36],[-.23,.25],[-.28,.075],
    ]),
  seed: spec('Seed / Little Voyager','A broad blunt tilted seed crown, tapered torso and two short boots.',
    {x:0,y:.630,width:.46,height:.215,radius:.075},[
      [-.265,0],[-.065,0],[-.055,.105],[.055,.105],[.065,0],[.265,0],
      [.30,.075],[.245,.23],[.27,.35],[.36,.325],[.405,.395],[.365,.50],
      [.30,.54],[.31,.66],[.255,.80],[.14,.915],[-.025,1],[-.11,.975],
      [-.18,.85],[-.28,.75],[-.315,.63],[-.30,.54],[-.365,.50],[-.405,.395],
      [-.36,.325],[-.27,.35],[-.245,.23],[-.30,.075],
    ]),
  bud: spec('Bud / Leaf Ranger','A low outward leaf crown over a compact explorer helmet and broad mitten tabs.',
    {x:0,y:.620,width:.46,height:.21,radius:.075},[
      [-.265,0],[-.065,0],[-.055,.105],[.055,.105],[.065,0],[.265,0],
      [.30,.075],[.245,.23],[.27,.35],[.375,.355],[.415,.425],[.355,.51],
      [.295,.54],[.30,.74],[.405,.865],[.405,1],[.255,.985],[0,.835],
      [-.255,.985],[-.405,1],[-.405,.865],[-.30,.74],[-.295,.54],
      [-.355,.51],[-.415,.425],[-.375,.355],[-.27,.35],[-.245,.23],[-.30,.075],
    ]),
});
export function describeCandyOutline(variant='scout') { return CANDY_VARIANTS[variant] || CANDY_VARIANTS.scout; }
export function getCandyOutline(variant='scout',{height=1}={}) {
  const scale=Number.isFinite(height)&&height>0?height:1;
  return describeCandyOutline(variant).points.map(([x,y])=>[x*scale,y*scale]);
}
/** Quadratic tangent cuts. A generous cut removes acute tiny crown corners.
 * cornerRadius is a tangent distance; actual curvature is tested separately. */
export function roundedPolygonSegments(points,cornerRadius=.06) {
  return points.map((point,index)=>{
    const before=points[(index+points.length-1)%points.length],after=points[(index+1)%points.length];
    const cut=other=>{const length=Math.hypot(other[0]-point[0],other[1]-point[1]);
      const fraction=Math.min(.48,cornerRadius/length);
      return point.map((n,k)=>n+(other[k]-n)*fraction);};
    return {before:cut(before),corner:[...point],after:cut(after)};
  });
}
export function getCandyRoundedSegments(variant='scout') {
  const {points,cornerRadius}=describeCandyOutline(variant);
  return roundedPolygonSegments(points,cornerRadius);
}
export function sampleCandySegments(segments,steps=12) {
  const n=Math.max(2,Math.floor(steps));
  return segments.flatMap(({before,corner,after})=>[before,...Array.from({length:n},(_,i)=>{
    const t=(i+1)/n;return before.map((a,k)=>(1-t)**2*a+2*(1-t)*t*corner[k]+t*t*after[k]);
  })]);
}
export function candySegmentsPath(segments) {
  const pair=point=>point.map(value=>Number(value.toFixed(6))).join(' ');
  return `M ${pair(segments[0].before)} `+segments.map(({before,corner,after},index)=>
    `${index?`L ${pair(before)} `:''}Q ${pair(corner)} ${pair(after)}`).join(' ')+' Z';
}
export function getCandyContour(variant='scout') { return candySegmentsPath(getCandyRoundedSegments(variant)); }
function roundedRectSegments({x,y,width,height,radius}) {
  const l=x-width/2,r=x+width/2,b=y-height/2,t=y+height/2;
  const d=Math.min(radius,width/2,height/2);
  return [
    {before:[l+d,b],corner:[l,b],after:[l,b+d]},
    {before:[l,t-d],corner:[l,t],after:[l+d,t]},
    {before:[r-d,t],corner:[r,t],after:[r,t-d]},
    {before:[r,b+d],corner:[r,b],after:[r-d,b]},
  ];
}
const translated = (segments,x,y)=>segments.map(seg=>Object.fromEntries(Object.entries(seg).map(([key,p])=>[key,[p[0]+x,p[1]+y]])));
// A single friendly closed arc; the exact profile and centers are shared with
// tooling. No inferred circles, strokes or independent physical eye spacing.
const EYE_SEGMENTS=[
  {before:[-.037,-.017],corner:[-.037,.046],after:[0,.046]},
  {before:[0,.046],corner:[.037,.046],after:[.037,-.017]},
  {before:[.037,-.017],corner:[.027,-.033],after:[.016,-.017]},
  {before:[.016,-.017],corner:[.014,.019],after:[0,.019]},
  {before:[0,.019],corner:[-.014,.019],after:[-.016,-.017]},
  {before:[-.016,-.017],corner:[-.027,-.033],after:[-.037,-.017]},
];
const pathFeature=(id,segments,surface,extra={})=>({id,segments,points:sampleCandySegments(segments),surface,...extra});
/** Fresh canonical front paths in GLOBAL normalized body XY, not local face XY.
 * Surface values describe nominal relief in mm at 30mm height, independent of
 * the supplier's body depth/draft. Digital colors are optional; paths are not.
 * `helmet`/`chest`: raised; `face`: recess in helmet; eyes: raised inside mask.
 */
export function getCandyFeatures(variant='scout') {
  const {face}=describeCandyOutline(variant);
  const helmet={x:face.x,y:face.y,width:face.width+(variant==='seed'?.075:.105),height:face.height+.105,radius:.10};
  return {
    helmet:pathFeature('helmet',roundedRectSegments(helmet),{kind:'raised',heightMm:.65,edgeRoundMm:.12},helmet),
    face:pathFeature('face',roundedRectSegments(face),{kind:'recess',depthMm:.30,edgeRoundMm:.05},face),
    eyes:[-1,1].map(side=>pathFeature(side<0?'left-eye':'right-eye',translated(EYE_SEGMENTS,face.x+side*.09,face.y+.008),
      {kind:'raised',heightMm:.22,edgeRoundMm:.05},{x:face.x+side*.09,y:face.y+.008})),
    chest:pathFeature('chest',roundedPolygonSegments([[-.063,.285],[-.061,.352],[.002,.405],[.071,.408],[.051,.342],[-.005,.294]],.015),
      {kind:'raised',heightMm:.40,edgeRoundMm:.05},{x:0,y:.343}),
  };
}

/** A shallow digital front crown. It does not alter XY silhouette or imply the
 * physical master has this profile. Actual STL geometry is reviewed separately. */
export function getCandyFrontBulge(variant,x,y) {
  const {face}=describeCandyOutline(variant);
  const width=variant==='scout'?.38:.29;
  const headX=Math.max(0,1-(x/width)**2)**2;
  const headY=Math.max(0,1-((y-face.y)/.235)**2)**2;
  const torsoX=Math.max(0,1-(x/.25)**2)**2;
  const torsoY=Math.max(0,1-((y-.30)/.21)**2)**2;
  return .025*headX*headY+.012*torsoX*torsoY;
}
