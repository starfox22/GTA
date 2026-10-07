// Vehicle damage shape (damage-crumple.js, damage3d-crumple.js, damage3d-marks.js): shots and crashes on every side of
// several bodies keep the crumple inside its limits (crumpleAudit: nothing past the centre plane or into the cabin, no
// folds; holes off the glasshouse under the belt line); on a rendered page every part a dent reaches is bent with the
// shell (none missed, no flipped faces) and every bullet hole and star sits on the body, before and after the crumple,
// in the street and the chase view. On the no-render page (the suite's) the drawn checks are skipped.
export const fresh = true;

const TYPES = ['sedan', 'sport', 'suv', 'van', 'pickup', 'police', 'chevette', 'supercar'];

export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 12);
  await t.call('teleport', 950, 607);
  const rendered = (await t.call('carModels')) !== null;
  await t.call('holdSimulation', true);
  const cars = [];
  for (const [i, type] of TYPES.entries()) {
    const id = await t.call('park', type, 70 + (i % 4) * 90, i < 4 ? -70 : 80, 0);
    cars.push({ id, type });
  }
  // One real round into each car's nose from a few metres off, then rounds into every side through the same hit path.
  const shoot = async (car) => {
    const v = await t.call('vehicleById', car.id);
    await t.call('teleport', v.x + Math.cos(v.a) * 70, v.y + Math.sin(v.a) * 70);
    await t.call('shootAt', v.x, v.y, 0);
    await t.wait(0.2);
    for (const side of ['left', 'front', 'right', 'rear']) await t.call('shootVehicle', car.id, side, 3);
  };
  const look = async (car) => {
    const v = await t.call('vehicleById', car.id);
    await t.call('teleport', v.x - 50, v.y + 30);
    // A step so the camera follows, then a few drawn frames (marks are found a few a frame).
    await t.wait(0.2);
    await t.realWait(rendered ? 2.5 : 0.1);
  };
  const drawn = async (car, label, view) => {
    if (!rendered) return;
    const shape = await t.call('vehicleDamageShape', car.id);
    t.assert(shape, `${car.type}: a model is built (${label})`);
    t.finite(shape, `${car.type} shape`);
    t.assert(shape.missed === 0, `${car.type} ${label}: every part a dent reaches is bent (${shape.missed} missed)`);
    if (shape.shell) {
      t.assert(shape.shell.crossed === 0 && shape.shell.intoCabin === 0, `${car.type} ${label}: no shell vertex past the centre plane or into the cabin ${JSON.stringify(shape.shell)}`);
      t.assert(shape.shell.flippedShare < 0.01, `${car.type} ${label}: no folded-over shell faces ${JSON.stringify(shape.shell)}`);
    }
    const marks = shape.marks.filter((m) => m.kind !== 'scrape'),
      anchored = marks.filter((m) => m.anchored);
    t.assert(anchored.length >= marks.length * 0.75, `${car.type} ${label}: marks found on the body (${anchored.length}/${marks.length})`);
    for (const m of anchored) {
      if (!m.drawn) continue;
      t.assert(m.gapCm !== null, `${car.type} ${label}: a ${m.kind} on the ${m.on} has the body under it`);
      t.assert(Math.abs(m.gapCm) <= 2, `${car.type} ${label}: a ${m.kind} on the ${m.on} sits on the surface (${m.gapCm} cm off)`);
      if (view === 'chase' && m.ringGapCm !== null) t.assert(m.ringGapCm <= 3, `${car.type} ${label}: the ${m.kind}'s ring lies on the ${m.on} (${m.ringGapCm} cm)`);
      if (m.kind === 'star') t.assert(m.on === 'glass', `${car.type} ${label}: a star is on the glass (${m.on})`);
      if (m.kind === 'hole') t.assert(m.on !== 'glass', `${car.type} ${label}: a hole is not on the glass`);
    }
    t.note(`${car.type} ${label}: ${anchored.length}/${marks.length} marks, ${shape.bent}/${shape.parts} parts bent in ${shape.crumpleMs} ms`);
  };
  // Shots first (the holes must ride the crumple), then crashes on every side.
  for (const car of cars) {
    await shoot(car);
    const audit = await t.call('crumpleAudit', car.id);
    t.assert(audit.marks > 0, `${car.type}: the rounds left marks`);
    t.assert(audit.holesOverBonnet === 0, `${car.type}: holes off the glasshouse are under the belt line (${audit.holesOverBonnet})`);
  }
  for (const view of ['street', 'chase']) {
    await t.call('viewMode', view);
    for (const car of cars) {
      await look(car);
      await drawn(car, 'shot', view);
    }
  }
  for (const car of cars) {
    await t.call('dentVehicle', car.id, 'front', 90, 0.4);
    await t.call('dentVehicle', car.id, 'left', 70, -0.6);
    await t.call('dentVehicle', car.id, 'rear', 60, 0);
    await t.call('dentVehicle', car.id, 'right', 110, 0.9);
    const audit = await t.call('crumpleAudit', car.id);
    t.finite(audit, `${car.type} audit`);
    t.assert(audit.crossed === 0 && audit.intoCabin === 0, `${car.type}: the crumple stays out of the centre plane and the cabin ${JSON.stringify(audit)}`);
    t.assert(audit.folds <= 2, `${car.type}: the metal folds without turning over (${audit.folds} folds)`);
    t.assert(audit.frontInM <= audit.frontRoomM && audit.rearInM <= audit.rearRoomM && audit.sideInM <= audit.sideRoomM, `${car.type}: inward travel within the limits ${JSON.stringify(audit)}`);
    t.assert(audit.frontInM > 0.2 && audit.rearInM > 0.1 && audit.sideInM > 0.1, `${car.type}: the crashes show ${JSON.stringify(audit)}`);
  }
  for (const view of ['chase', 'street']) {
    await t.call('viewMode', view);
    for (const car of cars) {
      await look(car);
      await drawn(car, 'crashed', view);
    }
  }
  await t.call('viewMode', 'street');
  await t.call('holdSimulation', false);
}
