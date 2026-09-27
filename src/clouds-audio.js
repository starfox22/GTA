    // Cloud sound: inside a cloud the rush of air goes deep and damp (a low, soft roar and a fine hiss of
    // droplets), following cloudLayer.immersion and the airspeed; outside cloud it is silent.
    let cloudAudio = null;
    function buildCloudAudio() {
      if (!audio || !master || !ambienceBus) return null;
      const seconds = 3,
        n = Math.floor(audio.sampleRate * seconds),
        buffer = audio.createBuffer(1, n, audio.sampleRate),
        data = buffer.getChannelData(0);
      // Brown-ish noise: a deep, even roar with no hiss of its own.
      let brown = 0;
      for (let i = 0; i < n; i++) {
        brown = brown * 0.985 + (Math.random() * 2 - 1) * 0.06;
        data[i] = brown * 3;
      }
      const fade = Math.floor(audio.sampleRate * 0.25);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        data[i] = data[i] * t + data[n - fade + i] * (1 - t);
      }
      const source = audio.createBufferSource(),
        roar = audio.createBiquadFilter(),
        roarGain = audio.createGain(),
        hiss = audio.createBiquadFilter(),
        hissGain = audio.createGain();
      source.buffer = buffer;
      source.loop = true;
      roar.type = 'lowpass';
      roar.frequency.value = 320;
      roar.Q.value = 0.9;
      hiss.type = 'highpass';
      hiss.frequency.value = 4200;
      roarGain.gain.value = hissGain.gain.value = 0;
      source.connect(roar).connect(roarGain).connect(ambienceBus);
      source.connect(hiss).connect(hissGain).connect(ambienceBus);
      source.start(0, Math.random() * seconds);
      return { source, roar, roarGain, hissGain };
    }
    function updateCloudAudio() {
      if (!audio || !master) return;
      const inCloud = cloudLayer.immersion;
      if (!cloudAudio) {
        if (inCloud < 0.02 || !soundOn) return;
        cloudAudio = buildCloudAudio();
        if (!cloudAudio) return;
      }
      const p = player.parachute,
        craft = player.car && isAircraft(player.car) ? player.car : null,
        // Airspeed through the cloud, 0..1 at a freefall's 50 m/s.
        speed = p
          ? Math.hypot(p.vx || 0, p.vy || 0, p.vz || 0)
          : craft
            ? craft.airspeed || Math.hypot(craft.vx || 0, craft.vy || 0, craft.vz || 0)
            : 0,
        rush = clamp(speed / (50 * UNITS_PER_METRE), 0, 1),
        on = soundOn && gameMode === 'play' ? inCloud : 0,
        now = audio.currentTime;
      cloudAudio.roarGain.gain.setTargetAtTime(on * (0.05 + rush * 0.16), now, 0.25);
      cloudAudio.hissGain.gain.setTargetAtTime(on * (0.008 + rush * 0.03), now, 0.3);
      cloudAudio.roar.frequency.setTargetAtTime(220 + rush * 260, now, 0.3);
    }
