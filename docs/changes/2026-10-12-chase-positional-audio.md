# Positioned sounds follow the chase camera

- Sounds on the right of the chase view now play on the right, including while looking
  behind: shots, impacts, sirens, traffic engines and horns, skids, nearby runners,
  passing cars, venues, water, sea life, thunder and bridge machinery.
- One shared horizontal projection follows the final chase camera yaw. Top-down stereo
  placement, distance attenuation, occlusion, Doppler and volume settings remain exact.
  Continuous loops follow camera rotation; one-shots keep their orientation at emission.
- Added a host regression that checks 500 offsets against the renderer's camera basis
  and executes the real sample, horn, water, impact, stadium, siren, traffic-engine,
  skid, footstep, whizz and pass-by callers with recording audio nodes.
