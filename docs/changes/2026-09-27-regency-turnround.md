# Regency Road traffic turns round off Eagle Pass
- Monarch Isle's cars that drive up the Regency Road now turn round on it, 15 m short of
  its end, instead of in the middle of Eagle Pass's bend where cars coming down the pass
  ran into them; they wait while anything is ahead or across before turning.
- The scenic-road test autopilot (`mountainRoadDrive`) drives in the right-hand lane (it
  was in the left one, head-on to the island traffic) and clears island cars and the
  player's last car off the road first; tools/tests/mountain-road.mjs holds the simulation.
- New console `regencyTraffic(seconds)` and test tools/tests/regency-traffic.mjs: island
  cars keep right in the bends and turn round clear of Eagle Pass.
