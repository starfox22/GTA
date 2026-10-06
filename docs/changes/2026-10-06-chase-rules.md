# Chase view: what the player can see
- In the chase view enemies fire only from inside the chase camera's frame, within 150 m and not from behind a building; the street view's on-screen rule is unchanged.
- People, traffic, police, ambulances and street scenes spawn and leave out of the chase camera's sight (outside its frame, beyond 200 m, or hidden behind a building from wherever the camera can swing), and the streams lean toward where the camera looks so the street ahead stays busy: nothing pops into view, even while the camera spins.
- The reticle is the aim for every device in the chase view: shots, the soft lock, the drive-by window, the tank, the mounted guns, the Apache, the volleyball; the body faces the aim only in a fight or aiming over the shoulder.
- The mission card folds for the player's box as the chase camera sees it.
- chase-rules.js holds the shared helpers (chaseInView, spotUnseen, chaseShooterInView, chaseAim, chasePlayerBox); new console methods `viewRules(x, y, margin)` and `viewPopAudit(seconds, keys, turn)`; tests chase-view-mode, chase-walk, chase-shooter, chase-in-view, chase-hud-box, chase-aim, chase-streams.
