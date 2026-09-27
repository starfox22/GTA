# Ambulances get past jams; paramedics stay with their patient

- An ambulance grinding at walking pace through cars pulled over for it now counts as stuck
  (under 5 km/h over 2 s, not just stopped); out of view it goes on to the point of its
  route nearest the stop that nobody can see (`hopMedicPastJam`), instead of crawling for
  a minute (or giving up) when the player stands at the scene.
- A car an ambulance is held up by (stopped half across its way after pulling over for it)
  drives on out of the way instead of waiting for the ambulance that waits for it.
- Someone knocked down against a stopped car crawls out from under it and gets up; one
  lying at an ambulance's bumper used to hold it (and themselves) there for good.
- Paramedics on a job no longer leave the victim to watch, help or run at a knock-down,
  crash, body or crime down the street (or at people running from one); gunfire, blasts
  and fights still send them running.
- The paramedic on the radio who is blocked on the way radios in from where he stands; the
  treatment waits for the kneeling one, who sidesteps both ways and steps out of a car's
  outline when one was nudged onto him.
- `medicReport().job`: `hops` (times it went on past a jam); `ahead` is now the car it
  last braked for (`braked`, with `turn`), else the nearest ahead.
- Test: living-medics was flaky (about 1 run in 3, at e9ffe46 too) for these reasons.
