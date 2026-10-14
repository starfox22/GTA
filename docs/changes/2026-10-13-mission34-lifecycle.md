# High Ground and Borrowed Stripes: cleanup and failure paths

- A truck borrowed to carry High Ground's package now regains its previous mission protection on cleanup.
  Restarting, failing or abandoning the job preserves the player's existing free-roam vehicle and its damage;
  active cargo still gets the intended slow-burn and retirement protection.
- Destroying Kessler's car while its bag is still inside fails Borrowed Stripes with a clear loss message and
  the normal saved retry. Previously the job pointed at a trunk that the lockpick refused because it was wrecked.
- Once the bag is taken, later destruction of that car or death of an escaped Kessler cannot send the player back
  to taking his keys. Before recovery, looting his corpse for keys still works.
- Blown cover before showing ID now uses the same pre-papers failure as blown cover inside the fort.
  Previously losing the police left a gate objective whose alarmed identity could never be shown again.
- The meeting compares objective coordinates and height before refreshing the HUD. Thirty unchanged snapshots
  now trigger one refresh instead of thirty; moving Varga, switching to the roof and wanted-state instructions
  still refresh immediately. This removes redundant work without changing the stage or marker location.
- `tools/tests/mission34-lifecycle.mjs` executes the actual mission functions in its host check (30 assertions),
  including the distinction between unrelated road damage and a player-caused wreck.
  Its browser regression uses real dig/load/boarding keys and the normal failure/retry list cleanup, with a
  public-story frontier fixture (three earlier jobs), named teleport/wreck fixtures and god mode off.
  Mission-playthrough coverage and evidence are recorded by the lead
  in the October 13 audit, separately from these controlled regressions.
