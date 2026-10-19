import fs from 'node:fs';
import vm from 'node:vm';
const read=n=>fs.readFileSync('src/'+n+'.js','utf8');
const county=read('county-map');
const scope=vm.createContext({Math,Map,Set,UNITS_PER_METRE:8,BLOCK_SIZE:512,BRIDGES:[],KMH:8/3.6,KNOTS:8/3.6*1.852,GRAVITY:9.81*8,PAINT_EVERYDAY:[],PAINT_LUXURY:[],PAINT_SPORT:[]});
const countyPrefix=county.slice(0,county.indexOf('    const countyGroundTiles'));
const a=vm.runInContext(read('geography-regions')+'\n'+countyPrefix+'\n'+read('physics-shapes')+'\n'+read('game-vehicles')+';({AIRPORT_JETBRIDGES,AIRPORT_SCENERY_SOLIDS,airportOverheadVolumes,vehicleSpec,vehicleCollisionHeight,boxContact,vehicleShape,COUNTY_ROADS})',scope);
const road=a.COUNTY_ROADS.find(r=>r.name==='OCEANVIEW PARKWAY'),p=road.points[7],q=road.points[8],dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
const result={road:{name:road.name,from:p,to:q,width:road.width,laneOffset:25},crossings:[],parkedBus:{x:4400,y:8760,a:0},types:{}};
const blocks=a.airportOverheadVolumes();
for(const type of ['sedan','bus','truck','ambulance'])result.types[type]={l:a.vehicleSpec({type}).l,w:a.vehicleSpec({type}).w,collisionHeight:a.vehicleCollisionHeight({type})};
for(const b of a.AIRPORT_JETBRIDGES){
 const cy=p[1]+(b.x-p[0])/dx*dy;
 const x={gate:b.gate,x:b.x,roadY:cy,carriagewayY:[cy-road.width/2*Math.sqrt(1+(dy/dx)**2),cy+road.width/2*Math.sqrt(1+(dy/dx)**2)],currentBottom:22,lanes:[]};
 for(const lane of [-25,25])for(const type of ['sedan','bus','truck','ambulance']){
  const v={type,x:b.x-uy*lane,y:cy+ux*lane,a:Math.atan2(dy,dx)};
  const hits=blocks.filter(s=>a.vehicleCollisionHeight(v)>=s.minHeight&&a.boxContact(a.vehicleShape(v),s));
  x.lanes.push({lane,type,x:v.x,y:v.y,hits:hits.map(s=>s.kind)});
 }
 result.crossings.push(x);
}
const v={type:'bus',...result.parkedBus};result.parkedBus.hits=blocks.filter(s=>a.vehicleCollisionHeight(v)>=s.minHeight&&a.boxContact(a.vehicleShape(v),s)).map(s=>({x:s.x,y:s.y,kind:s.kind,minHeight:s.minHeight}));
result.proposal={roadUnderside:40,roadClearanceM:5,keepDockUnderside:22,mainBridgeHeight:23,rampLength:220,rampGradePercent:100*18/220,highEndY:a.AIRPORT_JETBRIDGES.map(b=>({gate:b.gate,y:b.to-220})),supportPlan:'Move first support from from+86 (inside carriageway) to from+20 (terminal-side verge); second support remains to-80 on apron and follows ramp floor.'};
fs.writeFileSync('work/airport-scene/road-clearance-inspection.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
