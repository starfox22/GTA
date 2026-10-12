# Camera, windows, touch HUD and vehicle efficiency

- Keep the chase camera's shoulder and boom outside nearby walls, including while aiming.
- Broken and lowered vehicle windows reveal the cabin; repair restores the panes.
- Keep seated and drive-by feet above low cabin floors instead of protruding below the chassis.
- Place touch dispatch captions below the measured mission card and refresh clearance when touch mode changes.
- Holding movement, driving, jump or fire controls no longer counts as voluntary surrender when blocked.
- Cache vehicle paint state without per-frame strings; distinguish wear from heat and retain respray updates.
- Dispose of burnt-car materials that exceed the reuse pool's limit after repair.
- Keep parked-car physics shortcuts active away from raised drawbridges; audit skipped settles against the full path.
- Clamp AUTO's downward resolution steps to its intended 60% minimum.
- Report skipped renderer checks honestly, honour the selected test build, isolate the rider-fall fixture and fail smoke/tours on runtime errors.
- Build branch ZIP artifacts and a public prerelease for this review; only main updates the rolling release, and branches cannot cancel each other's builds.
