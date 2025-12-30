// WebMIDI Music Generator
// Generates procedural music in C major, 4/4 time

export class MusicGenerator {
    private midiOutput: MIDIOutput | null = null;
    private isPlaying: boolean = false;
    private currentBeat: number = 0;
    private tempo: number = 120; // BPM
    private intervalId: number | null = null;
    
    // C major scale MIDI notes (C4 to C5)
    private readonly scale = [60, 62, 64, 65, 67, 69, 71, 72];
    // Bass notes (C2 to C3)
    private readonly bassScale = [36, 38, 40, 41, 43, 45, 47, 48];
    
    // Chord progressions in C major (I-IV-V-vi)
    private readonly chordProgressions = [
        [0, 3, 4, 5], // C-F-G-Am
        [0, 4, 5, 3], // C-G-Am-F
        [0, 2, 3, 4], // C-Em-F-G
        [5, 3, 0, 4], // Am-F-C-G
    ];
    
    private currentProgression: number[] = [];
    private currentChordIndex: number = 0;
    
    async init(): Promise<boolean> {
        try {
            if (!navigator.requestMIDIAccess) {
                console.log('WebMIDI not supported, using fallback audio');
                return false;
            }
            
            const midiAccess = await navigator.requestMIDIAccess();
            const outputs = Array.from(midiAccess.outputs.values());
            
            if (outputs.length > 0 && outputs[0]) {
                this.midiOutput = outputs[0];
                console.log('MIDI output connected:', this.midiOutput.name);
                return true;
            }
            
            console.log('No MIDI outputs available');
            return false;
        } catch (error) {
            console.log('MIDI access denied or error:', error);
            return false;
        }
    }
    
    setTempo(bpm: number): void {
        this.tempo = bpm;
        if (this.isPlaying) {
            this.stop();
            this.play();
        }
    }
    
    play(): void {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.currentBeat = 0;
        this.currentChordIndex = 0;
        
        // Pick a random progression
        const progIndex = Math.floor(Math.random() * this.chordProgressions.length);
        const prog = this.chordProgressions[progIndex];
        this.currentProgression = prog ?? [0, 3, 4, 5];
        
        // Calculate interval for 16th notes
        const msPerBeat = 60000 / this.tempo;
        const msPerSixteenth = msPerBeat / 4;
        
        this.intervalId = window.setInterval(() => {
            this.tick();
        }, msPerSixteenth);
    }
    
    stop(): void {
        this.isPlaying = false;
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Send all notes off
        if (this.midiOutput) {
            for (let i = 0; i < 128; i++) {
                this.sendNoteOff(i);
            }
        }
    }
    
    private tick(): void {
        if (!this.isPlaying) return;
        
        // 4/4 time: 16 sixteenth notes per bar
        const beatInBar = this.currentBeat % 16;
        const barNumber = Math.floor(this.currentBeat / 16);
        
        // Change chord every 4 beats (1 bar = 4 chord changes would be too fast, so every bar)
        if (beatInBar === 0) {
            this.currentChordIndex = barNumber % 4;
        }
        
        const chordDegree = this.currentProgression[this.currentChordIndex] ?? 0;
        
        // Play bass on beats 1 and 3 (sixteenth 0 and 8)
        if (beatInBar === 0 || beatInBar === 8) {
            const bassNote = this.bassScale[chordDegree] ?? 36;
            this.playNote(bassNote, 80, 400);
        }
        
        // Play chord tones on various patterns
        if (beatInBar === 0) {
            // Root
            const note = this.scale[chordDegree] ?? 60;
            this.playNote(note, 70, 300);
        }
        
        if (beatInBar === 4 || beatInBar === 12) {
            // Third
            const thirdDegree = (chordDegree + 2) % 7;
            const note = this.scale[thirdDegree] ?? 60;
            this.playNote(note, 60, 200);
        }
        
        // Melody - syncopated pattern
        if (beatInBar === 0 || beatInBar === 3 || beatInBar === 6 || beatInBar === 10 || beatInBar === 14) {
            // Random melody note from the current chord
            const melodyOptions = [chordDegree, (chordDegree + 2) % 7, (chordDegree + 4) % 7];
            const optionIndex = Math.floor(Math.random() * melodyOptions.length);
            const melodyDegree = melodyOptions[optionIndex] ?? 0;
            const melodyNote = (this.scale[melodyDegree] ?? 60) + 12; // One octave up
            this.playNote(melodyNote, 75, 150);
        }
        
        // Occasional passing tones
        if (Math.random() < 0.15 && (beatInBar === 2 || beatInBar === 7 || beatInBar === 11)) {
            const passingNote = this.scale[Math.floor(Math.random() * this.scale.length)] ?? 60;
            this.playNote(passingNote + 12, 50, 100);
        }
        
        this.currentBeat++;
    }
    
    private playNote(note: number, velocity: number, duration: number): void {
        if (!this.midiOutput) return;
        
        this.sendNoteOn(note, velocity);
        setTimeout(() => {
            this.sendNoteOff(note);
        }, duration);
    }
    
    private sendNoteOn(note: number, velocity: number): void {
        if (!this.midiOutput) return;
        this.midiOutput.send([0x90, note, velocity]);
    }
    
    private sendNoteOff(note: number): void {
        if (!this.midiOutput) return;
        this.midiOutput.send([0x80, note, 0]);
    }
}

// Fallback Web Audio synth for when MIDI is not available
export class AudioSynth {
    private audioContext: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private isPlaying: boolean = false;
    private intervalId: number | null = null;
    private currentBeat: number = 0;
    private tempo: number = 120;
    
    // C major scale frequencies (C4 to C5)
    private readonly scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    private readonly bassScale = [65.41, 73.42, 82.41, 87.31, 98.00, 110.00, 123.47, 130.81];
    
    private readonly chordProgressions = [
        [0, 3, 4, 5],
        [0, 4, 5, 3],
        [0, 2, 3, 4],
        [5, 3, 0, 4],
    ];
    
    private currentProgression: number[] = [];
    private currentChordIndex: number = 0;
    
    init(): void {
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = 0.3;
    }
    
    setTempo(bpm: number): void {
        this.tempo = bpm;
        if (this.isPlaying) {
            this.stop();
            this.play();
        }
    }
    
    play(): void {
        if (this.isPlaying || !this.audioContext || !this.gainNode) return;
        
        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = true;
        this.currentBeat = 0;
        this.currentChordIndex = 0;
        
        const progIndex = Math.floor(Math.random() * this.chordProgressions.length);
        const prog = this.chordProgressions[progIndex];
        this.currentProgression = prog ?? [0, 3, 4, 5];
        
        const msPerBeat = 60000 / this.tempo;
        const msPerSixteenth = msPerBeat / 4;
        
        this.intervalId = window.setInterval(() => {
            this.tick();
        }, msPerSixteenth);
    }
    
    stop(): void {
        this.isPlaying = false;
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    private tick(): void {
        if (!this.isPlaying || !this.audioContext || !this.gainNode) return;
        
        const beatInBar = this.currentBeat % 16;
        const barNumber = Math.floor(this.currentBeat / 16);
        
        if (beatInBar === 0) {
            this.currentChordIndex = barNumber % 4;
        }
        
        const chordDegree = this.currentProgression[this.currentChordIndex] ?? 0;
        
        // Bass on beats 1 and 3
        if (beatInBar === 0 || beatInBar === 8) {
            const bassFreq = this.bassScale[chordDegree] ?? 65.41;
            this.playTone(bassFreq, 0.4, 0.3);
        }
        
        // Chord tones
        if (beatInBar === 0) {
            const freq = this.scale[chordDegree] ?? 261.63;
            this.playTone(freq, 0.3, 0.25);
        }
        
        if (beatInBar === 4 || beatInBar === 12) {
            const thirdDegree = (chordDegree + 2) % 7;
            const freq = this.scale[thirdDegree] ?? 261.63;
            this.playTone(freq, 0.2, 0.2);
        }
        
        // Melody
        if (beatInBar === 0 || beatInBar === 3 || beatInBar === 6 || beatInBar === 10 || beatInBar === 14) {
            const melodyOptions = [chordDegree, (chordDegree + 2) % 7, (chordDegree + 4) % 7];
            const optionIndex = Math.floor(Math.random() * melodyOptions.length);
            const melodyDegree = melodyOptions[optionIndex] ?? 0;
            const melodyFreq = (this.scale[melodyDegree] ?? 261.63) * 2; // One octave up
            this.playTone(melodyFreq, 0.15, 0.15);
        }
        
        // Passing tones
        if (Math.random() < 0.15 && (beatInBar === 2 || beatInBar === 7 || beatInBar === 11)) {
            const passingFreq = (this.scale[Math.floor(Math.random() * this.scale.length)] ?? 261.63) * 2;
            this.playTone(passingFreq, 0.1, 0.1);
        }
        
        this.currentBeat++;
    }
    
    private playTone(frequency: number, duration: number, volume: number): void {
        if (!this.audioContext || !this.gainNode) return;
        
        const oscillator = this.audioContext.createOscillator();
        const noteGain = this.audioContext.createGain();
        
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;
        
        noteGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.connect(noteGain);
        noteGain.connect(this.gainNode);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }
}
