# Wheelie lift, rear-brake control and tyre contact

- W + ↑ lifts the front; ↓ lowers it reliably even with W held. The hint and riding controls now show both lift and lower inputs. ↑ alone remains throttle.
- Lowering cuts drive torque, shifts the rider forward and limits rear braking by rain, tyre surface and remaining grip in a turn. Space also lowers a raised front while W is held.
- Brake load/bias, ABS, lateral grip, skid marks and spray/mud/tracks follow the contacting tyres; the lifted front contributes no force or ground effects.
- Pitch and fork response now substep at 240 Hz, with smooth body movement and a landing bump stop that dissipates excess compression energy.
- Corrected motorcycle and bicycle wheelie pivots to preserve rear axle height through bank, pitch and terrain tilt, keeping the rear tyre on the road and the rider attached to the same chassis transform.
- Added timestep/grip/input regressions, real Arrow Down set-down coverage and axle-position assertions on packed and procedural models.
