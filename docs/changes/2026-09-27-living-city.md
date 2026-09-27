# The living city: busy streets, sirens, ambulances and bag snatches
- The streets round the player carry real traffic now (was two or three moving cars in view of a whole district): busier in the rush hours, quiet at 3 am, with the district's own cars (cabs on Broadway, limousines at North Point, trucks at the docks, roadsters on Ocean Drive).
- Drivers make way for sirens: they crawl over to the kerb and stop while a cruiser under lights or an ambulance goes by, and hold at a junction while one crosses.
- A body left in a city street brings an ambulance with lights and siren; two paramedics work on the victim, who often comes round and staggers off.
- Bag and phone snatches: catch the thief on foot (red on the radar) for a reward.
- Police see less far at night (about 40 m on foot on the lit streets, 51 m in a car) and in heavy rain; a unit already on you keeps you a little longer.
- Internals: livingcity*.js (traffic pool streamed round the player and bounded, `emergencyBeacons`, `sirenPullOver`, `emergencyRunControl`, the ambulance service, street events), `policeSightRange`; trafficControl skips its junction scans when they cannot matter.
- Console (`livingCity`): `trafficReport`, `trafficMix`, `trafficBenchmark`, `trafficStreaming`, `sirenPass`/`sirenPassState`, `medicReport`, `medicTest`, `streetEvents`, `snatchTest`; `policeReport().sightRange`.
