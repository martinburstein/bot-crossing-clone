export const BASE = Object.freeze({area:1, au:1, efficiency:0.28, derating:0.8, conversion:0.9, housekeeping:12, count:100, failure:0, availability:0.8, deployment:0.9, annualFailure:0.05, degradation:0.02, delivery:0, unitCost:176000, lifetime:5});
export function calculate(p = {}) {
  const v = {...BASE,...p};
  for (const [key,value] of Object.entries(v)) if (!Number.isFinite(value)) throw new Error(`Invalid ${key}`);
  if(v.au<=0 || v.area<0 || v.count<0 || !Number.isInteger(v.count) || v.unitCost<0 || v.lifetime<=0 || !Number.isInteger(v.lifetime) || v.housekeeping<0) throw new Error('Invalid positive input');
  for(const k of ['efficiency','derating','conversion','failure','availability','delivery','deployment','annualFailure','degradation']) if(v[k]<0 || v[k]>1) throw new Error(`Invalid fraction: ${k}`);
  const incident = 1361 * v.area / v.au**2;
  const gross = incident*v.efficiency*v.derating*v.conversion;
  const net = Math.max(0,gross-v.housekeeping);
  const fleet = net*v.count*(1-v.failure)*v.availability*v.deployment;
  const delivered = fleet*v.delivery;
  let energy=0;
  for(let year=0;year<v.lifetime;year++)energy+=delivered/1000*8760*((1-v.annualFailure)*(1-v.degradation))**year;
  return {incident,gross,net,fleet,delivered,energy,capex:v.count*v.unitCost,capitalPerKwh:energy>0?v.count*v.unitCost/energy:null};
}
