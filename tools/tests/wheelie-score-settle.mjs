// Score production fixed-step travel only after contact rollback and terrain settle.
import fs from 'node:fs';
import vm from 'node:vm';
import { wheelieScoreFixture } from '../fixtures/wheelie-score.mjs';
export default async function(t) {
  const source=fs.readFileSync(new URL('../../src/physics-step.js',import.meta.url),'utf8');
  for(const correction of ['wall','takeoff','normal']){
    const f=wheelieScoreFixture(),c=f.bike();c.wheelie=.4;c.vx=120;
    Object.assign(f.c,{physicsClock:0,performance,vehicles:[c],profile:{parts:{}},
      controlVehicle(car){car.stepStartX=car.x;car.stepStartY=car.y;car.x+=1;},
      vehicleBroadphase(){},vehicleContactPasses(){},streetPropContacts(){},forestTrunkContacts(){},
      settleVehicle(car){if(correction==='wall')car.x=car.stepStartX;if(correction==='takeoff')car.rideAir=true;}});
    vm.runInContext(source.slice(source.indexOf('    function physicsStep(')),f.c);
    for(let i=0;i<24;i++)f.c.physicsStep(1/120,true);
    const score=f.f.wheelieScoreReport();
    t.assert(correction==='normal'?score.metres===3&&score.phase==='active':score.metres===0,
      correction+': speculative travel/contact reached score: '+JSON.stringify(score));
  }
  const fall=wheelieScoreFixture(),bike=fall.bike();
  fall.travel(bike,12);
  bike.fallen={roll:1};fall.c.player.car=null;fall.c.player.thrown={phase:'air'};
  fall.f.wheelieScoreStep(bike,1/120,bike.x,bike.y);
  t.assert(fall.f.wheelieScoreReport().reason==='crashed','rider ejection was classified as a voluntary exit');
}
