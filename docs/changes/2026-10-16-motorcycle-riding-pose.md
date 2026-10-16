# Motorcycle rider weight and corner animation

- Sport riders tuck as speed rises, brace under braking, shift their hips and torso with Up/Down, and move into corners while looking through the bend. Parked input leaves the pose unchanged.
- Head posture compensates for the tank tuck, hills and wheelies so the rider watches the road. The existing drive-by aiming pose takes precedence.
- Smoothed renderer state reads the physics' settled bank and rider weight. Actual source grips and footrests remain pinned; body motion adapts to each adult's physical arm reach without stretching bones.
- Production queue/character-IK regressions cover source sport, enduro and Dolcati rigs at three adult heights, parked input, braking plus Down, 60/120 Hz easing and aiming overrides.
