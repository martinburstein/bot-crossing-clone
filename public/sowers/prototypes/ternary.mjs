/** Design-recipe geometry only. This does not classify or synthesize images. */
export const VERTICES = Object.freeze([[500,80],[90,790],[910,790]].map(Object.freeze));
export function validateWeights(weights) {
  if(!Array.isArray(weights)||weights.length!==3||weights.some(n=>!Number.isFinite(n)||n<0||n>100)||Math.abs(weights.reduce((a,b)=>a+b,0)-100)>1e-8) throw Error('A recipe needs three nonnegative weights summing to 100.');
  return weights;
}
export function recipePoint(weights) {
  validateWeights(weights);
  return [0,1].map(axis=>weights.reduce((total,n,index)=>total+n*VERTICES[index][axis]/100,0));
}
export function gridLines(step=10) {
  if(!Number.isInteger(step)||step<1||step>50) throw Error('Grid step must be an integer from 1 to 50.');
  const result=[];
  for(let axis=0;axis<3;axis++) for(let value=step;value<100;value+=step) {
    const others=[0,1,2].filter(i=>i!==axis), a=[0,0,0], b=[0,0,0];
    a[axis]=b[axis]=value;a[others[0]]=100-value;b[others[1]]=100-value;
    result.push({axis,value,from:recipePoint(a),to:recipePoint(b)});
  }
  return result;
}
