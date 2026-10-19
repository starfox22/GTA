# Measure the physical Space braking test in game time

- The jump regression now observes 1.2 seconds of simulation while pressing real Space in a car. Slow browser frames no longer shorten the braking interval to a fraction of the intended duration.
- The original 1.2-second wall-clock phase remains first, and the test reports its simulation duration plus the total game and wall time. Additional physical holds have a 30-second wall limit.
- The required speed reduction, jump checks and production driving physics are unchanged.
