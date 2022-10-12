import { OpenSheetMusicDisplay, Instrument, Voice } from "opensheetmusicdisplay";
import { InstrumentPlayer, PlaybackInstrument } from "./players/InstrumentPlayer";
import { IAudioContext } from "standardized-audio-context";
export declare enum PlaybackState {
    INIT = "INIT",
    PLAYING = "PLAYING",
    STOPPED = "STOPPED",
    PAUSED = "PAUSED"
}
export declare enum PlaybackEvent {
    STATE_CHANGE = "state-change",
    ITERATION = "iteration"
}
interface PlaybackSettings {
    bpm: number;
    masterVolume: number;
}
export default class PlaybackEngine {
    private ac;
    private defaultBpm;
    private cursor;
    private sheet;
    private scheduler;
    private instrumentPlayer;
    private events;
    private iterationSteps;
    private currentIterationStep;
    private timeoutHandles;
    playbackSettings: PlaybackSettings;
    state: PlaybackState;
    availableInstruments: PlaybackInstrument[];
    scoreInstruments: Instrument[];
    ready: boolean;
    constructor(context?: IAudioContext, instrumentPlayer?: InstrumentPlayer);
    get wholeNoteLength(): number;
    getPlaybackInstrument(voiceId: number): PlaybackInstrument;
    setInstrument(voice: Voice, midiInstrumentId: number): Promise<void>;
    loadScore(osmd: OpenSheetMusicDisplay): Promise<void>;
    private initInstruments;
    private loadInstruments;
    private fallbackToPiano;
    play(): Promise<void>;
    stop(): Promise<void>;
    pause(): void;
    jumpToStep(step: any): void;
    setBpm(bpm: number): void;
    on(event: PlaybackEvent, cb: (...args: any[]) => void): void;
    private countAndSetIterationSteps;
    private notePlaybackCallback;
    private setState;
    private stopPlayers;
    private clearTimeouts;
    private iterationCallback;
}
export {};
