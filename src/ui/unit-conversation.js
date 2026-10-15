const SLOTS=['melchior','balthasar','casper']
export function unitConversationFrame(campus,slots,elapsed){
  if(campus?.dispatchMode!=='free-15-3A'||campus.mode!=='awake'||!Number.isFinite(elapsed))return null
  const idle=new Set(slots.filter(s=>s.status==='idle').map(s=>s.slotId))
  const accepted=(campus.free?.conversation??[]).filter(line=>line.source==='accepted-luna-turn'&&SLOTS.includes(line.slotId)&&idle.has(line.slotId)&&
    typeof line.text==='string'&&line.text.length>0&&line.text.length<=360&&['observation','reflection','question'].includes(line.kind)&&
    typeof line.submissionId==='string'&&/^[a-f0-9]{64}$/.test(line.submissionDigest??'')&&Number.isFinite(line.acceptedAt))
  const newest=new Map()
  for(const line of accepted)if(!newest.has(line.slotId)||line.acceptedAt>=newest.get(line.slotId).acceptedAt)newest.set(line.slotId,line)
  const lines=accepted.filter(line=>line.submissionId===newest.get(line.slotId).submissionId)
  if(!lines.length)return null
  return lines[Math.floor(Math.max(0,elapsed)/11)%lines.length]
}
