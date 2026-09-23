// Deterministic software-in-the-loop bench controller. No physical hardware I/O.
export class BenchNode {
  constructor(id) { this.id=id; this.mode='STOWED'; this.angle=0; this.sequence=0; this.lastCommand=-Infinity; this.fault=null; this.loadW=0; this.controlW=0; this.netWh=0; this.rejected=0; }
  command(command,now) {
    if(!Number.isFinite(now)||!Number.isFinite(command?.expiresAt)||command.expiresAt<=now||!Number.isInteger(command.sequence)||command.sequence<=this.sequence) {this.rejected++;return false;}
    if(!['DEPLOY','RESET'].includes(command.type)) {this.rejected++;return false;}
    this.sequence=command.sequence;this.lastCommand=now;
    if(command.type==='DEPLOY'&&this.mode==='STOWED')this.mode='DEPLOYING';
    if(command.type==='RESET'&&this.mode==='SAFE') {this.fault=null;this.mode='STOWED';}
    return true;
  }
  step({sunAngle=25,irradiance=1,temperature=25,connected=true,sensorValid=true},dt,now) {
    if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(now))throw new Error('Invalid simulation time');
    const valid=Number.isFinite(sunAngle)&&Number.isFinite(irradiance)&&irradiance>=0&&Number.isFinite(temperature);
    if(!connected||!sensorValid||!valid||temperature>60) {this.mode='SAFE';this.fault=!connected?'disconnected':!sensorValid||!valid?'sensor':'overtemperature';}
    let moved=false;
    if(this.mode==='DEPLOYING')this.mode='TRACK';
    if(this.mode==='TRACK'){const target=Math.max(-60,Math.min(60,sunAngle));const error=target-this.angle;const travel=Math.sign(error)*Math.min(Math.abs(error),dt*12);this.angle+=travel;moved=Math.abs(travel)>0.01;}
    this.controlW=connected?(moved?0.65:0.2):0;
    this.loadW=this.mode==='TRACK'?Math.max(0,10*irradiance*Math.cos((sunAngle-this.angle)*Math.PI/180)*0.8):0;
    this.netWh+=(this.loadW-this.controlW)*dt/3600;
    return {...this,autonomous:now-this.lastCommand>30,netW:this.loadW-this.controlW};
  }
}
