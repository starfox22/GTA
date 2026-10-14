// The actual rider queue, steering contacts and physical two-bone arm rig against
// the approved motorcycle pack, in addition to the retained old-pack regression.
import { runMotorcycleRiderFit } from './motorcycle-rider-fit.mjs';

export default async function (t) {
  for (const height of [1.65, 1.8, 1.9]) await runMotorcycleRiderFit(t, true, height);
}
