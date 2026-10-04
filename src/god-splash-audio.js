    /**
     * GOD MODE SPLASH SOUND (god-splash.js): ON is a riser into an impact (sub boom, thump, metallic shing), a wide
     * detuned power chord with an angelic pad and a glitter run; OFF is a glitchy hit and a tape-stop power-down.
     */
    // Lands with the title in god-splash.css (godTitleSlam at 0.55 s; the CRT power-off at 2.15 s).
    const GOD_SPLASH_IMPACT = 0.55,
      GOD_SPLASH_POWER_OFF = 2.15;
    let godNoiseBuffer = null;
    function godNoise() {
      if (godNoiseBuffer) return godNoiseBuffer;
      const n = Math.floor(audio.sampleRate * 2),
        data = (godNoiseBuffer = audio.createBuffer(1, n, audio.sampleRate)).getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      return godNoiseBuffer;
    }
    // One voice: oscillator (or noise when `type` is 'noise') → filter → gain → pan → master (+ reverb).
    function godVoice(o) {
      const src =
          o.type === 'noise'
            ? Object.assign(audio.createBufferSource(), { buffer: godNoise(), loop: true })
            : Object.assign(audio.createOscillator(), { type: o.type }),
        filter = audio.createBiquadFilter(),
        g = audio.createGain(),
        pan = audio.createStereoPanner(),
        end = o.at + o.length;
      if (o.type !== 'noise') {
        src.frequency.setValueAtTime(o.f, o.at);
        if (o.fTo) src.frequency.exponentialRampToValueAtTime(o.fTo, o.at + (o.fTime || o.length));
        if (o.detune) src.detune.setValueAtTime(o.detune, o.at);
      }
      filter.type = o.filter || 'lowpass';
      filter.frequency.setValueAtTime(o.cut || 20000, o.at);
      if (o.cutTo) filter.frequency.exponentialRampToValueAtTime(o.cutTo, o.at + (o.cutTime || o.length));
      filter.Q.value = o.q || 0.7;
      // Envelope: attack to the peak, an optional hold, then an exponential tail to the end.
      g.gain.setValueAtTime(0.0001, o.at);
      if (o.swell) g.gain.exponentialRampToValueAtTime(o.peak, o.at + o.attack);
      else g.gain.linearRampToValueAtTime(o.peak, o.at + (o.attack || 0.005));
      if (o.hold) g.gain.setValueAtTime(o.peak, o.at + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      pan.pan.value = o.pan || 0;
      src.connect(filter).connect(g).connect(pan).connect(master);
      if (o.wet && reverbSend) {
        const send = audio.createGain();
        send.gain.value = o.wet;
        pan.connect(send).connect(reverbSend);
        src.addEventListener('ended', () => send.disconnect());
      }
      // Vibrato for the pad.
      let lfo = null;
      if (o.vibrato) {
        lfo = audio.createOscillator();
        const depth = audio.createGain();
        lfo.frequency.value = 5.2;
        depth.gain.value = o.vibrato;
        lfo.connect(depth).connect(src.detune);
        lfo.start(o.at);
        lfo.stop(end + 0.05);
      }
      src.start(o.at);
      src.stop(end + 0.05);
      src.addEventListener('ended', () => {
        src.disconnect();
        filter.disconnect();
        g.disconnect();
        pan.disconnect();
        if (lfo) lfo.disconnect();
      });
    }
    function godFanfare(on) {
      if (!audio || !soundOn) return;
      const t0 = audio.currentTime + 0.03;
      if (on) godActivatedSound(t0, t0 + GOD_SPLASH_IMPACT);
      else godDeactivatedSound(t0, t0 + GOD_SPLASH_POWER_OFF);
    }
    function godActivatedSound(t0, hit) {
      const rise = hit - t0;
      // Riser: a noise sweep and a climbing saw that cut dead on the impact.
      godVoice({ type: 'noise', at: t0, length: rise, filter: 'bandpass', cut: 400, cutTo: 9000, q: 1.4, peak: 0.32, attack: rise, swell: true, hold: rise - 0.01, wet: 0.4 });
      godVoice({ type: 'sawtooth', at: t0, length: rise, f: 98, fTo: 784, cut: 600, cutTo: 5000, peak: 0.07, attack: rise, swell: true, hold: rise - 0.01 });
      godVoice({ type: 'sawtooth', at: t0, length: rise, f: 98, fTo: 784, detune: 24, cut: 600, cutTo: 5000, peak: 0.05, attack: rise, swell: true, hold: rise - 0.01, pan: 0.4 });
      // Impact: sub boom, body thump, a bright crack and a metallic shing ringing into the reverb.
      godVoice({ type: 'sine', at: hit, length: 1.5, f: 110, fTo: 30, fTime: 0.9, peak: 0.7, attack: 0.004 });
      godVoice({ type: 'noise', at: hit, length: 0.35, cut: 220, cutTo: 60, peak: 0.7, attack: 0.002 });
      godVoice({ type: 'noise', at: hit, length: 0.16, filter: 'highpass', cut: 2500, peak: 0.35, attack: 0.001, wet: 0.6 });
      const shing = [2349, 3136, 3951, 4699, 6272];
      for (let i = 0; i < shing.length; i++)
        godVoice({ type: 'sine', at: hit, length: 1.8 - i * 0.2, f: shing[i] * (1 + i * 0.0021), peak: 0.05, attack: 0.002, pan: (i - 2) * 0.3, wet: 0.9 });
      // The chord: C major across three octaves, three detuned saws per note, the filter opening on the hit.
      const chord = [65.41, 130.81, 196.0, 261.63, 329.63, 392.0, 523.25];
      for (let i = 0; i < chord.length; i++)
        for (let k = -1; k <= 1; k++)
          godVoice({
            type: 'sawtooth',
            at: hit,
            length: 3.3,
            f: chord[i],
            detune: k * 14,
            cut: 500,
            cutTo: i === 0 ? 900 : 5200,
            cutTime: 0.45,
            peak: i === 0 ? 0.045 : 0.021,
            attack: 0.02,
            hold: 1.4,
            pan: k * 0.55,
            wet: 0.35,
          });
      // An angelic pad swelling in behind it.
      const pad = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < pad.length; i++)
        godVoice({ type: 'triangle', at: hit + 0.1, length: 3.2, f: pad[i], cut: 2600, peak: 0.035, attack: 0.7, swell: true, hold: 1.9, vibrato: 9, pan: (i - 1.5) * 0.35, wet: 1 });
      // A glitter run up the octaves, bouncing left and right.
      const glitter = [1046.5, 1318.5, 1568.0, 2093.0, 2637.0, 3136.0, 4186.0];
      for (let i = 0; i < glitter.length; i++)
        godVoice({ type: 'triangle', at: hit + 0.16 + i * 0.055, length: 0.45, f: glitter[i], peak: 0.06, attack: 0.003, pan: i % 2 ? 0.6 : -0.6, wet: 0.8 });
    }
    function godDeactivatedSound(t0, off) {
      // A dark hit: sub drop, a falling minor chord and digital glitch blips while the title jitters.
      godVoice({ type: 'sine', at: t0, length: 1.1, f: 80, fTo: 34, fTime: 0.7, peak: 0.6, attack: 0.004 });
      godVoice({ type: 'noise', at: t0, length: 0.25, cut: 300, cutTo: 80, peak: 0.5, attack: 0.002 });
      const minor = [73.42, 146.83, 174.61, 220.0, 293.66];
      for (let i = 0; i < minor.length; i++)
        for (let k = -1; k <= 1; k += 2)
          godVoice({ type: 'sawtooth', at: t0, length: 1.9, f: minor[i], fTo: minor[i] * 0.94, detune: k * 10, cut: 2600, cutTo: 260, peak: 0.024, attack: 0.01, pan: k * 0.5, wet: 0.4 });
      const blips = [1760, 220, 3520, 440, 2637, 147, 1975];
      for (let i = 0; i < blips.length; i++)
        godVoice({ type: 'square', at: t0 + 0.08 + i * 0.075, length: 0.045, f: blips[i], cut: 6000, peak: 0.035, attack: 0.001, pan: i % 2 ? 0.7 : -0.7 });
      // The CRT power-off: a tape-stop sweep down to nothing and the tube's last click.
      godVoice({ type: 'sawtooth', at: off, length: 0.6, f: 880, fTo: 40, cut: 4000, cutTo: 150, peak: 0.08, attack: 0.004 });
      godVoice({ type: 'sine', at: off, length: 0.5, f: 1200, fTo: 60, peak: 0.07, attack: 0.002 });
      godVoice({ type: 'noise', at: off + 0.32, length: 0.06, filter: 'highpass', cut: 3000, peak: 0.25, attack: 0.001, wet: 0.5 });
    }
    // Console: render a splash sound offline (no speakers) and measure it; godFanfareRender() starts it and
    // godFanfareReport() returns { on, seconds, peak, rms, loudestRms (50 ms window) } once done, or an error.
    let godFanfareResult = null;
    function godFanfareRender(on) {
      const live = { audio, master, reverbSend },
        rate = 44100,
        offline = new OfflineAudioContext(2, rate * 4, rate);
      godFanfareResult = { pending: true };
      try {
        audio = offline;
        master = offline.createGain();
        master.connect(offline.destination);
        reverbSend = null;
        godNoiseBuffer = null;
        if (on) godActivatedSound(0.03, 0.03 + GOD_SPLASH_IMPACT);
        else godDeactivatedSound(0.03, 0.03 + GOD_SPLASH_POWER_OFF);
      } catch (error) {
        godFanfareResult = { error: String(error) };
      } finally {
        audio = live.audio;
        master = live.master;
        reverbSend = live.reverbSend;
        godNoiseBuffer = null;
      }
      if (godFanfareResult.error) return godFanfareResult;
      offline.startRendering().then(
        (buffer) => {
          const data = buffer.getChannelData(0),
            span = Math.round(rate * 0.05);
          let peak = 0,
            sum = 0,
            loudest = 0,
            windowSum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = data[i] * data[i];
            peak = Math.max(peak, Math.abs(data[i]));
            sum += v;
            windowSum += v;
            if (i >= span) windowSum -= data[i - span] * data[i - span];
            if (i >= span) loudest = Math.max(loudest, windowSum / span);
          }
          godFanfareResult = {
            on: !!on,
            seconds: buffer.duration,
            peak: Math.round(peak * 1000) / 1000,
            rms: Math.round(Math.sqrt(sum / data.length) * 1000) / 1000,
            loudestRms: Math.round(Math.sqrt(loudest) * 1000) / 1000,
          };
        },
        (error) => (godFanfareResult = { error: String(error) }),
      );
      return godFanfareResult;
    }
