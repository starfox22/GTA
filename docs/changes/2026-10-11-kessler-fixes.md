# Kessler leaves from his house, in a pristine car
- Mission 4 (Borrowed Stripes): Kessler no longer starts at Fort Sentinel. The moment the job is taken he is pulling
  away from his house on Broadway (by the Palm Sound Causeway), about 50 s from the Marea: head for the beach club or
  intercept him. The opening brief says so; Vinny adds a warning that shooting at the car brings the army.
- His red muscle car is in perfect condition when he leaves and stays so on his way: the old start drove him through
  the fort's closed gate arm, which sprang a door and dented the body. Knocks from traffic are now mended at once while
  he drives (never damage the player does).
- No more "You lost Kessler" message: far behind him the objective simply stays on his car, which the map always shows.
- Waiting at the club puts his car on its last approach after 10 s (was 14).
- Internals: `fortHomeSpot`, `fortKeepPristine`, `fortJob()` reports `car.id`, `car.condition` and `line`; the
  stakeout stage and `lostFor` are gone; the job's map start moved to his house.
