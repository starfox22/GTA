// Exact ordered visitors/contact geometry from production crowd and gate kernels, including migrations and openings.
import { performanceKernelAudit } from '../performance-kernels-check.mjs';
export default async function (t) {
  const report = performanceKernelAudit();
  t.assert(report.crowd.checked > 30000 && report.crowd.encounterFrames === 240, 'crowd query coverage incomplete');
  t.assert(report.gates.checked > 4000 && report.gates.reusedContacts === report.gates.checked, 'gate geometry/reuse coverage incomplete');
  t.note(JSON.stringify(report));
}
