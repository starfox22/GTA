# Chase view clouds

- Chase view: the clouds overhead are real cumulus again: firm, separate cells with blue between them and
  clear edges, down to the horizon, where a band of cloud now sits over the city's haze and sinks into the
  sky's colour, instead of a milky smear below 20 degrees and an empty horizon. Overcast and rain read as a
  deck with structure rather than flat grey. The top-down view, the flight view and the parachute's clouds
  are unchanged (identical pixels).
- The layer from below is hazed by the air's own visibility (`skyCloudHaze()`: about 30 km fair, 15 km under
  a grey deck, a few km in rain), never by the street's short haze that hides the edge of the draw distance.
- HIGH/ULTRA: the march from below has its own loop (`cloudMarchBelow`: coarse steps through clear air,
  quarter steps in cloud, 20 km reach) with a new step jitter and sub-texel offset each frame, averaged by
  SKY CLOUD HISTORY (clouds3d-sky-history.js: one half-size pass, reprojected, neighbourhood-clamped): no
  more diagonal stripes or grain. The sky reads a half-float copy of the noise volume (`cloudNoiseSky`, made
  at boot by the same generator), so far billows have no contour rings. LOW/MEDIUM's layer takes the same
  haze and noise.
- Console: `skyCloudBench(rounds)`; `cloudLayer().view.sky` adds `cloudAirKm`, `reachKm`, `history`.
