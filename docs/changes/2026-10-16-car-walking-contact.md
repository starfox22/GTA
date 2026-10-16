# Walk away from overlapping vehicle contacts

- Fixed getting stuck beside a car when its collision padding overlaps the player: walking away or along its side now releases the contact, including beside rotated cars.
- Nearby pedestrians share the same recovery. Walking into parked vehicles, adjacent cars, buildings and street furniture remains blocked.
- Added production movement regressions for 384 rotated side/corner escapes, blocked inward steps, tangential movement, nearby walls/cars and ordinary movement keys.
