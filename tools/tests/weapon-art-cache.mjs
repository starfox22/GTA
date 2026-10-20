// Actual HUD icon writers with a recording Canvas2D: unchanged pictures across
// invalidations, with no repeated raster/DOM work during combat HUD refreshes.
import fs from 'node:fs';
import vm from 'node:vm';

export function checkWeaponArtCache(t, source = fs.readFileSync(new URL('../../src/game-ui.js', import.meta.url), 'utf8')) {
  const draws = [], style = {}, data = {}, pixels = [];
  let mutations = 0;
  const context = new Proxy({}, {
    get(_, name) {
      return (...args) => {
        const row = [name, ...args.map(x => typeof x === 'object' ? 'atlas' : x)];
        draws.push(row);
        if (name === 'clearRect') pixels.length = 0;
        pixels.push(row);
        return name.startsWith('create') ? { addColorStop() {} } : undefined;
      };
    },
    set(_, name, value) { style[name] = value; pixels.push([name, value]); return true; },
  });
  const canvas = { width: 328, height: 116, getContext: () => context,
    dataset: new Proxy(data, { deleteProperty(o,k) { mutations++; delete o[k]; return true; } }) };
  const c = vm.createContext({ WeakMap, Math, player: {car:null}, selectedWeaponIndex: 0,
    visualAssets: {arsenal:{width:1254,height:1254}}, getElement:()=>canvas,
    isApache:v=>v?.apache, mountedGunKind:v=>v?.mounted,
    FISTS_INDEX:7, LOCKPICK_INDEX:8, KNIFE_INDEX:6,
  });
  vm.runInContext(source+'\nglobalThis.draw=drawWeapon;',c);
  const pictures = [], facts = [];
  for (let weapon = 0; weapon <= 8; weapon++) {
    c.selectedWeaponIndex = weapon;
    const before = draws.length; c.draw();
    t.assert(draws.length > before, 'changing equipped weapon draws its new art '+weapon);
    const picture = JSON.stringify(pixels); pictures.push(picture);
    const rendered = draws.length;
    for (let i=0;i<120;i++) c.draw();
    t.assert(draws.length===rendered, '120 ammo/health-only refreshes do not rasterize unchanged weapon '+weapon);
    t.assert(JSON.stringify(pixels)===picture,'cached bitmap remains unchanged '+weapon);
  }
  for (const car of [{type:'tank'},{type:'helicopter',apache:true},{type:'apc',mounted:'apc'}]) {
    c.player.car=car; data.tankIcon='held-'+car.type;
    const raster=draws.length, writes=mutations;
    for(let i=0;i<120;i++) c.draw();
    t.assert(data.tankIcon==='held-'+car.type,'armed HUD icon identity survives refresh '+car.type);
    t.assert(draws.length===raster&&mutations===writes,'armed refresh has no canvas work or dataset deletion '+car.type);
    c.player.car=null;const prior=draws.length;c.draw();
    t.assert(!data.tankIcon&&draws.length>prior,'leaving armed vehicle restores the ordinary art exactly once '+car.type);
    const fresh=draws.length;c.draw();
    t.assert(draws.length===fresh,'ordinary cache resumes after exit '+car.type);
    facts.push({kind:car.type,redundantRefreshes:120});
  }
  for(const [label,change] of [
    ['canvas width',()=>canvas.width++],['canvas height',()=>canvas.height++],
    ['atlas identity',()=>c.visualAssets.arsenal={width:1254,height:1254}],
    ['image decoded width',()=>c.visualAssets.arsenal.width++],
    ['image decoded height',()=>c.visualAssets.arsenal.height++]]) {
    const before=draws.length;change();c.draw();
    t.assert(draws.length>before,label+' invalidates the art');
    const once=draws.length;c.draw();t.assert(draws.length===once,label+' redraws once');
  }
  c.selectedWeaponIndex=4;c.visualAssets.arsenal=null;c.draw();
  const fallback=JSON.stringify(pixels),count=draws.length;c.draw();
  t.assert(draws.length===count&&JSON.stringify(pixels)===fallback,'procedural fallback is cached while media is absent');
  c.visualAssets.arsenal={width:1254,height:1254};c.draw();
  t.assert(JSON.stringify(pixels)!==fallback,'loaded artwork replaces the fallback');
  return {pictures,facts,drawCalls:draws.length};
}

export default async function(t) {
  const r=checkWeaponArtCache(t);
  t.note(JSON.stringify({weapons:r.pictures.length,armedModes:r.facts,canvasCalls:r.drawCalls}));
}
