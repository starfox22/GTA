// Every island a car can reach has a respray garage (garages.js GARAGE_ISLANDS), the GPS
// routes to each one's apron from a road on that island, and a repair and respray work at
// one of the island shops (MONARCH COACHWORKS, Monarch Isle).
export const fresh = true;
// A road point on each island (the route starts from the player there).
const ROADS = {
  northbank: [1296, 2300],
  palmkeys: [-2432, 2700],
  ridgeline: [6720, 3700],
  monarch: [8800, -3000],
  oceanview: [2176, 7700],
  coralcoast: [6750, 8300],
  sunsetisle: [3500, -5900],
  sentinel: [9000, 8150],
};
export default async function (t) {
  const report = await t.call('garage');
  const byId = Object.fromEntries(report.garages.map((g) => [g.id, g]));
  for (const island of Object.keys(ROADS)) {
    const ids = report.islands[island] || [];
    t.assert(ids.length > 0, `${island}: no garage`);
    for (const id of ids) {
      const g = byId[id];
      t.assert(g && g.island === island, `${id}: listed for ${island} but reports ${g?.island}`);
      const [x, y] = ROADS[island];
      await t.call('teleport', x, y);
      const r = await t.call('route', g.apron.x, g.apron.y);
      t.assert(r.status === 'YOUR DESTINATION', `${id}: route from ${island} road says ${r.status}`);
      t.assert(r.last && Math.hypot(r.last.x - g.apron.x, r.last.y - g.apron.y) < 30, `${id}: route ends at ${JSON.stringify(r.last)}`);
      t.note(`${island} ${id}: ${Math.round(r.length / 8)} m`);
    }
  }
  // A repair and respray at MONARCH COACHWORKS: drive a damaged car in off the apron.
  const shop = byId.monarch;
  await t.call('god', true);
  await t.call('setCash', 5000);
  await t.call('teleport', shop.apron.x - 40, shop.apron.y + 30);
  await t.call('drive', 'sedan', 0, -Math.PI / 2);
  await t.call('placeVehicle', shop.apron.x + 60, shop.apron.y + 40, -Math.PI / 2);
  // A blast beside it dents and scorches it (god mode keeps the driver whole).
  for (let k = 0; k < 3; k++) {
    await t.call('blast', shop.apron.x + 60 + 26, shop.apron.y + 40, 0.5);
    await t.wait(0.5);
    if ((await t.call('garage')).vehicle?.damage > 0.02) break;
  }
  await t.call('placeVehicle', shop.door.x0 + 24, shop.apron.y + 10, -Math.PI / 2);
  let g = await t.call('garage');
  t.assert(g.vehicle?.approach === 'monarch', 'not lined up with the coachworks: ' + JSON.stringify(g.vehicle));
  t.assert(g.vehicle.offer.repair > 0, 'the blast did no damage: ' + JSON.stringify(g.vehicle.offer));
  const colour = g.vehicle.color;
  await t.call('interact');
  await t.wait(16);
  g = await t.call('garage');
  t.assert(!g.job, 'the job is still running: ' + JSON.stringify(g.job));
  t.assert(g.last && g.last.shop === 'monarch', 'no service at the coachworks: ' + JSON.stringify(g.last));
  t.assert(g.vehicle && g.vehicle.damage < 0.01, 'still damaged after the repair: ' + g.vehicle?.damage);
  t.assert(g.vehicle.color !== colour, 'same colour after the respray');
  t.assert(g.cash < 5000, 'nothing charged');
  await t.call('god', false);
}
