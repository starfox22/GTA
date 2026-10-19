# Mission dialogue and carried cargo

- Mission dialogue clears the measured minimap, mission card and equipment in desktop
  street view, including the opening cargo job at 1000×700. Short, touch and chase
  layouts retain their existing placement and player-clearance rules.
- The mountain package draws a fitted olive backpack while carried on foot. It follows
  the torso through movement and falls, clears seats and the parachute container,
  and disappears when the cargo is stowed or the job ends.
- A native DOM regression checks subtitle clearance in twelve layout cases across four
  window sizes using the frozen build's actual stylesheet, HUD and measuring function.
