// The 4x4 club's vehicle entrance (vehicle-entrances.js): nothing parked and no bike-share dock stands in the
// gate's lane or the track, and every other kept lane (the Monarch villa drives) is clear too.
export const fresh = true;
export default async function (t) {
  const lanes = await t.call('vehicleEntrances');
  const club = lanes.filter((e) => /4X4 CLUB/.test(e.name));
  t.assert(club.length === 2, 'club lanes: ' + JSON.stringify(lanes.map((e) => e.name)));
  for (const e of lanes) t.assert(!e.parked.length && !e.docks.length, e.name + ' is blocked: ' + JSON.stringify(e));
  // The club still has its bike-share station for the job that starts there, off the lanes.
  const share = await t.call('bikeShare');
  const station = share.list.find((s) => s.serves.includes('MISSION 3'));
  t.assert(station, 'mission 3 station: ' + JSON.stringify(share.skipped));
  t.note('mission 3 station at ' + station.x + ', ' + station.y);
}
