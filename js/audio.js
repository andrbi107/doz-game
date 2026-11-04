/* ============================================
   AUDIO.JS - Web Audio API sound effects
   No external sound files needed - all synthesized
   ============================================ */

const Audio = (function () {
    let ctx = null;
    let enabled = true;
    let volume = 0.6;
    let lastPlayTime = 0;

    function ensureContext() {
        if (!ctx) {
            try {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                ctx = new AC();
            } catch (e) {
                console.warn('Web Audio not supported', e);
                return null;
            }
        }
        // Resume if suspended (autoplay policy)
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        return ctx;
    }

    /**
     * Play a synthesized tone.
     * @param {Object} opts
     * @param {number} opts.freq - frequency in Hz
     * @param {number} opts.duration - seconds
     * @param {OscillatorType} opts.type - 'sine' | 'square' | 'triangle' | 'sawtooth'
     * @param {number} opts.gain - peak gain 0..1
     * @param {number} opts.attack - attack time
     * @param {number} opts.release - release time
     * @param {number} opts.slideTo - target frequency for slide
     */
    function tone({ freq, duration = 0.15, type = 'sine', gain = 0.3, attack = 0.005, release = 0.08, slideTo = null }) {
        if (!enabled) return;
        const context = ensureContext();
        if (!context) return;

        // Throttle - don't play more than ~12 tones/sec
        const now = context.currentTime;
        if (now - lastPlayTime < 0.05) return;
        lastPlayTime = now;

        const osc = context.createOscillator();
        const gainNode = context.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
        }

        // ADSR envelope (simplified)
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(gain * volume, now + attack);
        gainNode.gain.linearRampToValueAtTime(gain * volume * 0.7, now + attack + duration * 0.4);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + duration + release);

        osc.connect(gainNode);
        gainNode.connect(context.destination);

        osc.start(now);
        osc.stop(now + attack + duration + release + 0.05);
    }

    /**
     * Play a short noise burst (used for taps, soft sounds).
     */
    function noise({ duration = 0.05, gain = 0.15, filterFreq = 2000 }) {
        if (!enabled) return;
        const context = ensureContext();
        if (!context) return;

        const now = context.currentTime;
        const bufferSize = Math.floor(context.sampleRate * duration);
        const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = context.createBufferSource();
        source.buffer = buffer;

        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;

        const gainNode = context.createGain();
        gainNode.gain.value = gain * volume;

        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(context.destination);

        source.start(now);
    }

    return {
        setEnabled(v) { enabled = !!v; },
        setVolume(v) { volume = Math.max(0, Math.min(1, v)); },
        isEnabled() { return enabled; },
        getVolume() { return volume; },

        // Must be called from a user gesture to unlock audio on mobile
        unlock() {
            ensureContext();
        },

        // Sound effects
        placeMark(player = 'x') {
            const baseFreq = player === 'x' ? 520 : 380;
            tone({
                freq: baseFreq,
                slideTo: baseFreq * 1.5,
                duration: 0.08,
                type: 'triangle',
                gain: 0.25,
                release: 0.1,
            });
        },

        click() {
            tone({
                freq: 660,
                duration: 0.04,
                type: 'square',
                gain: 0.12,
                release: 0.05,
            });
        },

        hover() {
            tone({
                freq: 880,
                duration: 0.02,
                type: 'sine',
                gain: 0.05,
                release: 0.03,
            });
        },

        win() {
            // Ascending arpeggio
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
            notes.forEach((f, i) => {
                setTimeout(() => {
                    tone({
                        freq: f,
                        duration: 0.15,
                        type: 'triangle',
                        gain: 0.3,
                        release: 0.15,
                    });
                }, i * 90);
            });
        },

        lose() {
            // Descending tones
            const notes = [440, 349.23, 261.63]; // A4 F4 C4
            notes.forEach((f, i) => {
                setTimeout(() => {
                    tone({
                        freq: f,
                        duration: 0.2,
                        type: 'sawtooth',
                        gain: 0.2,
                        release: 0.15,
                    });
                }, i * 130);
            });
        },

        draw() {
            tone({
                freq: 440,
                duration: 0.15,
                type: 'sine',
                gain: 0.2,
                release: 0.1,
            });
            setTimeout(() => {
                tone({
                    freq: 440,
                    duration: 0.2,
                    type: 'sine',
                    gain: 0.2,
                    release: 0.15,
                });
            }, 160);
        },

        invalid() {
            tone({
                freq: 200,
                duration: 0.1,
                type: 'square',
                gain: 0.15,
                release: 0.08,
            });
        },

        achievement() {
            // Sparkly achievement unlock sound
            const notes = [659.25, 880, 1046.50, 1318.51]; // E5 A5 C6 E6
            notes.forEach((f, i) => {
                setTimeout(() => {
                    tone({
                        freq: f,
                        duration: 0.12,
                        type: 'triangle',
                        gain: 0.25,
                        release: 0.18,
                    });
                }, i * 75);
            });
        },

        timerWarn() {
            // Urgent ticking when timer is low
            tone({
                freq: 880,
                duration: 0.05,
                type: 'square',
                gain: 0.15,
                release: 0.04,
            });
        },

        timerExpire() {
            // Buzz when timer runs out
            tone({
                freq: 150,
                slideTo: 80,
                duration: 0.4,
                type: 'sawtooth',
                gain: 0.2,
                release: 0.2,
            });
        },

        startGame() {
            const notes = [392, 523.25, 659.25]; // G4 C5 E5
            notes.forEach((f, i) => {
                setTimeout(() => {
                    tone({
                        freq: f,
                        duration: 0.1,
                        type: 'triangle',
                        gain: 0.22,
                        release: 0.1,
                    });
                }, i * 70);
            });
        },

        matchWin() {
            // Big victory fanfare
            const seq = [
                { f: 523.25, d: 0.15 },
                { f: 659.25, d: 0.15 },
                { f: 783.99, d: 0.15 },
                { f: 1046.50, d: 0.3 },
                { f: 783.99, d: 0.1 },
                { f: 1046.50, d: 0.4 },
            ];
            let t = 0;
            seq.forEach(n => {
                setTimeout(() => {
                    tone({
                        freq: n.f,
                        duration: n.d,
                        type: 'triangle',
                        gain: 0.3,
                        release: 0.15,
                    });
                }, t * 1000);
                t += n.d * 0.8;
            });
        },
    };
})();
