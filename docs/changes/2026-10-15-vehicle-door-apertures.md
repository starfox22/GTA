# Doors reveal the cabin

- Opening a car door now removes its closed body skin and front window, revealing the actual seats and dashboard instead of a fixed painted or upholstered wall.
- Move the door's paint, trim and front window together; preserve rear-quarter windows and lowered/shattered window states.
- Use the C8's original separated doors, hinge pivots, inner cards, mirrors and indicators. Other supported car bodies extract their moving door from their real close geometry.
- Preserve source UVs, PBR finish, paint/livery, existing dents and bullet marks through entry, exit, simultaneous front-door swings and repair.
- Restore source door materials after repairing a wreck whose first door was created after the body had already charred.
- Keep the player's shoes planted during the exit crouch, fixing shoes and lower pants clipping through the road.
- Cache immutable door geometry across identical vehicles and restore the exact closed source geometry after closure; active openings retain close detail.
- Add production geometry/damage regression checks and a frozen-build native screenshot recorder with named door/cabin diagnostics. See `docs/areas/vehicles-and-driving-doors.md`.
