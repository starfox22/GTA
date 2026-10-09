# Downloaded period cars in traffic

- Six traffic types are now real downloaded models (Daniel Zhabotinsky, CC-BY 4.0): the sedan is a Fairheaven LT '80,
  the taxi a Canyon '75 checker cab, the coupe a Kiri '86, the sports car an early-90s JDM mid-engine coupe, the
  supercar an Italian '84 flat-twelve and the luxury car an '80 American sedan, with modelled interiors, chrome,
  grilles and wheels. Respray, wear, glass, lamps and beams, crash crumple, bullet holes, blood, seated people and
  drive-bys work on them as before; muscle, rally and every other type keep their models.
- Same cost as the procedural bodies (draw calls equal, triangles no higher in a busy street; programs prewarmed).
- tools/vehicle_models.py converts the glTF sources (decimation, one 2048x1024 atlas, measured glasshouse);
  src/vehicle-assets3d.js builds them; seats and glass bands re-recorded (DRIVEBY_SEATS, CAR_GLASS_BANDS).
- Console `assetCars()`, `assetCarsOn(on)` (before/after rows); `node tools/test.mjs --render` runs the rendered tests.
