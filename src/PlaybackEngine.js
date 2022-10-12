var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import PlaybackScheduler from "./PlaybackScheduler";
import { SoundfontPlayer } from "./players/SoundfontPlayer";
import { getNoteDuration, getNoteVolume, getNoteArticulationStyle } from "./internals/noteHelpers";
import { EventEmitter } from "./internals/EventEmitter";
import { AudioContext } from "standardized-audio-context";
export var PlaybackState;
(function (PlaybackState) {
    PlaybackState["INIT"] = "INIT";
    PlaybackState["PLAYING"] = "PLAYING";
    PlaybackState["STOPPED"] = "STOPPED";
    PlaybackState["PAUSED"] = "PAUSED";
})(PlaybackState || (PlaybackState = {}));
export var PlaybackEvent;
(function (PlaybackEvent) {
    PlaybackEvent["STATE_CHANGE"] = "state-change";
    PlaybackEvent["ITERATION"] = "iteration";
})(PlaybackEvent || (PlaybackEvent = {}));
export default class PlaybackEngine {
    constructor(context = new AudioContext(), instrumentPlayer = new SoundfontPlayer()) {
        this.defaultBpm = 100;
        this.scoreInstruments = [];
        this.ready = false;
        this.ac = context;
        this.ac.suspend();
        this.instrumentPlayer = instrumentPlayer;
        this.instrumentPlayer.init(this.ac);
        this.availableInstruments = this.instrumentPlayer.instruments;
        this.events = new EventEmitter();
        this.cursor = null;
        this.sheet = null;
        this.scheduler = null;
        this.iterationSteps = 0;
        this.currentIterationStep = 0;
        this.timeoutHandles = [];
        this.playbackSettings = {
            bpm: this.defaultBpm,
            masterVolume: 1,
        };
        this.setState(PlaybackState.INIT);
    }
    get wholeNoteLength() {
        return Math.round((60 / this.playbackSettings.bpm) * 4000);
    }
    getPlaybackInstrument(voiceId) {
        if (!this.sheet)
            return null;
        const voice = this.sheet.Instruments.flatMap(i => i.Voices).find(v => v.VoiceId === voiceId);
        return this.availableInstruments.find(i => i.midiId === voice.midiInstrumentId);
    }
    setInstrument(voice, midiInstrumentId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.instrumentPlayer.load(midiInstrumentId);
            voice.midiInstrumentId = midiInstrumentId;
        });
    }
    loadScore(osmd) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ready = false;
            this.sheet = osmd.Sheet;
            this.scoreInstruments = this.sheet.Instruments;
            this.cursor = osmd.cursor;
            if (this.sheet.HasBPMInfo) {
                this.setBpm(this.sheet.DefaultStartTempoInBpm);
            }
            yield this.loadInstruments();
            this.initInstruments();
            this.scheduler = new PlaybackScheduler(this.wholeNoteLength, this.ac, (delay, notes) => this.notePlaybackCallback(delay, notes));
            this.countAndSetIterationSteps();
            this.ready = true;
            this.setState(PlaybackState.STOPPED);
        });
    }
    initInstruments() {
        for (const i of this.sheet.Instruments) {
            for (const v of i.Voices) {
                v.midiInstrumentId = i.MidiInstrumentId;
            }
        }
    }
    loadInstruments() {
        return __awaiter(this, void 0, void 0, function* () {
            let playerPromises = [];
            for (const i of this.sheet.Instruments) {
                const pbInstrument = this.availableInstruments.find(pbi => pbi.midiId === i.MidiInstrumentId);
                if (pbInstrument == null) {
                    this.fallbackToPiano(i);
                }
                playerPromises.push(this.instrumentPlayer.load(i.MidiInstrumentId));
            }
            yield Promise.all(playerPromises);
        });
    }
    fallbackToPiano(i) {
        console.warn(`Can't find playback instrument for midiInstrumentId ${i.MidiInstrumentId}. Falling back to piano`);
        i.MidiInstrumentId = 0;
        if (this.availableInstruments.find(i => i.midiId === 0) == null) {
            throw new Error("Piano fallback failed, grand piano not supported");
        }
    }
    play() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ac.resume();
            if (this.state === PlaybackState.INIT || this.state === PlaybackState.STOPPED) {
                this.cursor.show();
            }
            this.setState(PlaybackState.PLAYING);
            this.scheduler.start();
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            this.setState(PlaybackState.STOPPED);
            this.stopPlayers();
            this.clearTimeouts();
            this.scheduler.reset();
            this.cursor.reset();
            this.currentIterationStep = 0;
            this.cursor.hide();
        });
    }
    pause() {
        this.setState(PlaybackState.PAUSED);
        this.ac.suspend();
        this.stopPlayers();
        this.scheduler.setIterationStep(this.currentIterationStep);
        this.scheduler.pause();
        this.clearTimeouts();
    }
    jumpToStep(step) {
        this.pause();
        if (this.currentIterationStep > step) {
            this.cursor.reset();
            this.currentIterationStep = 0;
        }
        while (this.currentIterationStep < step) {
            this.cursor.next();
            ++this.currentIterationStep;
        }
        let schedulerStep = this.currentIterationStep;
        if (this.currentIterationStep > 0 && this.currentIterationStep < this.iterationSteps)
            ++schedulerStep;
        this.scheduler.setIterationStep(schedulerStep);
    }
    setBpm(bpm) {
        this.playbackSettings.bpm = bpm;
        if (this.scheduler)
            this.scheduler.wholeNoteLength = this.wholeNoteLength;
    }
    on(event, cb) {
        this.events.on(event, cb);
    }
    countAndSetIterationSteps() {
        this.cursor.reset();
        let steps = 0;
        while (!this.cursor.Iterator.EndReached) {
            if (this.cursor.Iterator.CurrentVoiceEntries) {
                this.scheduler.loadNotes(this.cursor.Iterator.CurrentVoiceEntries);
            }
            this.cursor.next();
            ++steps;
        }
        this.iterationSteps = steps;
        this.cursor.reset();
    }
    notePlaybackCallback(audioDelay, notes) {
        if (this.state !== PlaybackState.PLAYING)
            return;
        let scheduledNotes = new Map();
        for (let note of notes) {
            if (note.isRest()) {
                continue;
            }
            const noteDuration = getNoteDuration(note, this.wholeNoteLength);
            if (noteDuration === 0)
                continue;
            const noteVolume = getNoteVolume(note);
            const noteArticulation = getNoteArticulationStyle(note);
            const midiPlaybackInstrument = note.ParentVoiceEntry.ParentVoice.midiInstrumentId;
            const fixedKey = note.ParentVoiceEntry.ParentVoice.Parent.SubInstruments[0].fixedKey || 0;
            if (!scheduledNotes.has(midiPlaybackInstrument)) {
                scheduledNotes.set(midiPlaybackInstrument, []);
            }
            scheduledNotes.get(midiPlaybackInstrument).push({
                note: note.halfTone - fixedKey * 12,
                duration: noteDuration / 1000,
                gain: noteVolume,
                articulation: noteArticulation,
            });
        }
        for (const [midiId, notes] of scheduledNotes) {
            this.instrumentPlayer.schedule(midiId, this.ac.currentTime + audioDelay, notes);
        }
        this.timeoutHandles.push(window.setTimeout(() => this.iterationCallback(), Math.max(0, audioDelay * 1000 - 35)), // Subtracting 35 milliseconds to compensate for update delay
        window.setTimeout(() => this.events.emit(PlaybackEvent.ITERATION, notes), audioDelay * 1000));
    }
    setState(state) {
        this.state = state;
        this.events.emit(PlaybackEvent.STATE_CHANGE, state);
    }
    stopPlayers() {
        for (const i of this.sheet.Instruments) {
            for (const v of i.Voices) {
                this.instrumentPlayer.stop(v.midiInstrumentId);
            }
        }
    }
    // Used to avoid duplicate cursor movements after a rapid pause/resume action
    clearTimeouts() {
        for (let h of this.timeoutHandles) {
            clearTimeout(h);
        }
        this.timeoutHandles = [];
    }
    iterationCallback() {
        if (this.state !== PlaybackState.PLAYING)
            return;
        if (this.currentIterationStep > 0)
            this.cursor.next();
        ++this.currentIterationStep;
    }
}
