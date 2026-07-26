/**
 * @file soundEngine.js
 * @description محرك الصوت التفاعلي المعتمد على Web Audio API لتوليد أصوات النقرات والإشعارات بنقاء فائق بدون حزم خارجية.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  isSoundEnabled() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('student_sound_enabled') !== 'false';
  }

  getVolume() {
    if (typeof window === 'undefined') return 0.5;
    const vol = parseFloat(localStorage.getItem('student_sound_volume') || '0.6');
    return isNaN(vol) ? 0.6 : Math.max(0, Math.min(1, vol));
  }

  getSelectedTone() {
    if (typeof window === 'undefined') return 'default';
    return localStorage.getItem('student_notification_tone') || 'default';
  }

  /**
   * تشغيل صوت النقر البسيط (Click/Tap)
   */
  playClick() {
    if (!this.isSoundEnabled()) return;
    this.initContext();
    if (!this.ctx) return;

    const volume = this.getVolume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(volume * 0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  /**
   * تشغيل صوت مفتاح التبديل (Toggle Switch)
   */
  playToggle(on = true) {
    if (!this.isSoundEnabled()) return;
    this.initContext();
    if (!this.ctx) return;

    const volume = this.getVolume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = on ? 520 : 780;
    const endFreq = on ? 780 : 520;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(volume * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  /**
   * تشغيل صوت فتح القائمة الجانبية (Drawer Open)
   */
  playDrawerOpen() {
    if (!this.isSoundEnabled()) return;
    this.initContext();
    if (!this.ctx) return;

    const volume = this.getVolume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(650, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(volume * 0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  /**
   * تشغيل صوت السحب والإفلات (Pop/Release)
   */
  playRelease() {
    if (!this.isSoundEnabled()) return;
    this.initContext();
    if (!this.ctx) return;

    const volume = this.getVolume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(volume * 0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  /**
   * تشغيل صوت النجاح (Success Fanfare)
   */
  playSuccess() {
    if (!this.isSoundEnabled()) return;
    this.initContext();
    if (!this.ctx) return;

    const volume = this.getVolume();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.07);

      gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.07);
      gain.gain.linearRampToValueAtTime(volume * 0.35, this.ctx.currentTime + idx * 0.07 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.07 + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * 0.07);
      osc.stop(this.ctx.currentTime + idx * 0.07 + 0.18);
    });
  }

  /**
   * تشغيل نغمة الإشعارات والتنبيهات المحددة
   * @param {string} customTone - اختيار اختياري للنغمة (default / chime / bell / futuristic / success)
   */
  playNotification(customTone = null) {
    if (!this.isSoundEnabled()) return;
    this.initContext();
    if (!this.ctx) return;

    const volume = this.getVolume();
    const tone = customTone || this.getSelectedTone();

    switch (tone) {
      case 'chime': {
        const freqs = [880, 1320]; // A5, E6
        freqs.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.09);
          gain.gain.setValueAtTime(volume * 0.35, this.ctx.currentTime + i * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.09 + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(this.ctx.currentTime + i * 0.09);
          osc.stop(this.ctx.currentTime + i * 0.09 + 0.25);
        });
        break;
      }
      case 'bell': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
        gain.gain.setValueAtTime(volume * 0.45, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
        break;
      }
      case 'futuristic': {
        const freqs = [440, 880, 1760];
        freqs.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.05);
          gain.gain.setValueAtTime(volume * 0.15, this.ctx.currentTime + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.05 + 0.12);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(this.ctx.currentTime + i * 0.05);
          osc.stop(this.ctx.currentTime + i * 0.05 + 0.12);
        });
        break;
      }
      case 'success': {
        this.playSuccess();
        break;
      }
      case 'default':
      default: {
        const freqs = [587.33, 880]; // D5, A5
        freqs.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.08);
          gain.gain.setValueAtTime(volume * 0.35, this.ctx.currentTime + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(this.ctx.currentTime + i * 0.08);
          osc.stop(this.ctx.currentTime + i * 0.08 + 0.2);
        });
        break;
      }
    }
  }
}

export const soundEngine = new SoundEngine();
export default soundEngine;
