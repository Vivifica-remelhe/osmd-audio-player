import { InstrumentPlayer, PlaybackInstrument } from "./InstrumentPlayer";
import { NotePlaybackStyle, NotePlaybackInstruction } from "./NotePlaybackOptions";
import { IAudioContext } from "standardized-audio-context";
export declare class SoundfontPlayer implements InstrumentPlayer {
    instruments: PlaybackInstrument[];
    private players;
    private audioContext;
    constructor();
    init(audioContext: IAudioContext): void;
    load(midiId: number): Promise<void>;
    play: (midiId: string | number, options: NotePlaybackStyle) => void;
    stop(midiId: number): void;
    schedule(midiId: number, time: number, notes: NotePlaybackInstruction[]): void;
    private applyDynamics;
    private verifyPlayerLoaded;
    private getSoundfontInstrumentName;
}
