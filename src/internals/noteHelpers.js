import { ArticulationStyle } from "../players/NotePlaybackOptions";
export function getNoteArticulationStyle(note) {
    if (note.ParentVoiceEntry.isStaccato()) {
        return ArticulationStyle.Staccato;
    }
    else {
        return ArticulationStyle.None;
    }
}
export function getNoteDuration(note, wholeNoteLength) {
    let duration = note.Length.RealValue * wholeNoteLength;
    if (note.NoteTie) {
        if (Object.is(note.NoteTie.StartNote, note) && note.NoteTie.Notes[1]) {
            duration += note.NoteTie.Notes[1].Length.RealValue * wholeNoteLength;
        }
        else {
            duration = 0;
        }
    }
    return duration;
}
export function getNoteVolume(note) {
    return note.ParentVoiceEntry.ParentVoice.Volume;
}
