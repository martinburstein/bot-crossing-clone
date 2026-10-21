import {createRoArmWorksite} from './roarm-worksite.js'
import {createFreeCampusScene} from './free-campus-scene.js'
import {createMemorialWall} from './memorial-wall.js'

// One shared visual canon. Generic projects reuse the existing Waveshare campus
// geometry; the protocol and its fifteen real worker identities stay untouched.
export function canonicalCampusResponse(value) {
  if (!(value.threads?.length===15&&value.threads.every(t=>t.worldProfile==='15-3A'))) return value
  const threads=(value.threads??[]).map(t=>({...t,sceneLayout:'canonical-campus',displayRoleId:`r${t.shellId?.slice(1)}`}))
  const displaySlots=['melchior','balthasar','casper'].map(slotId=>{
    const crew=threads.filter(t=>t.clusterId===slotId),active=crew.find(t=>t.running===true),reserved=crew.find(t=>t.assignmentState==='reserved')
    return {slotId,status:active?'running':reserved?'reserved':'idle',roleId:(active??reserved)?.displayRoleId??null}
  })
  // The two permanent role-library bodies are scenic residents, not extra workers.
  for(const [shellId,roleId]of [['w00','pilot'],['w16','camper']])threads.push({
    ...threads[0],id:`visual:${roleId}`,shellId,project:`Visual ${roleId}`,shellName:roleId==='pilot'?'Pilot':'Camper',
    title:roleId==='pilot'?'Pilot role file':'Camper role file',projectLabel:roleId==='pilot'?'Pilot':'Camper',
    worldProfile:'roarm-campus',dispatchMode:'free-15-3A',roleId,displayRoleId:roleId,displayOnly:true,
    clusterId:'roles',slotId:null,running:false,hasError:false,assignmentState:'idle',assignmentRole:'idle',
    shellStatus:'Role file available',taskId:null,taskTitle:null,workerBackend:null,tokenUsage:null,
    earnedRewards:[],milestones:[],vehicleId:null,protocolExecution:'idle',roleActivated:false,
    suitColor:roleId==='pilot'?0x274c70:0x9daa86
  })
  return {...value,threads,worksite:{...(value.worksite??{}),sceneLayout:'canonical-campus',displaySlots}}
}

export function createCanonicalCampus(scene) {
  const base=createRoArmWorksite(scene)
  const campus=createFreeCampusScene(scene,base)
  const memorial=createMemorialWall(scene)
  const scenery=value=>({stale:value.stale!==false,executorSlots:value.displaySlots??[],campus:{dispatchMode:'free-15-3A',mode:'awake',free:{chargingRoleIds:[],history:[]}}})
  function update(value={}) {
    base.update(value)
    campus.update(scenery(value))
    base.armModel.group.visible=false
  }
  update()
  return {...base,profile:'canonical-campus',campusGroup:campus.group,cores:campus.cores,pods:campus.pods,
    memorial,target(thread,elapsed,agent){return memorial.target(thread)??campus.target({...thread,roleId:thread.displayRoleId},elapsed,agent)},
    update,animate:(elapsed,agents)=>{campus.animate(elapsed,agents);memorial.animate(elapsed,agents)},
    surfaceHeight:campus.surfaceHeight,clearings:()=>[...campus.clearings(),...memorial.clearings()],obstacles:()=>[...campus.obstacles(),...memorial.obstacles()],
    updateObservation(){return {state:'disabled',reason:'Presentation-only campus has no hardware feed.'}},
    dispose(){memorial.dispose();campus.dispose();base.dispose()}}
}
