import StepQueue from "./internals/StepQueue";
export default class PlaybackScheduler {
    constructor(wholeNoteLength, audioContext, noteSchedulingCallback) {
        this.stepQueue = new StepQueue();
        this.stepQueueIndex = 0;
        this.scheduledTicks = new Set();
        this.currentTick = 0;
        this.currentTickTimestamp = 0;
        this.audioContextStartTime = 0;
        this.schedulerIntervalHandle = null;
        this.scheduleInterval = 200; // Milliseconds
        this.schedulePeriod = 500;
        this.tickDenominator = 1024;
        this.lastTickOffset = 300; // Hack to get the initial notes play better
        this.playing = false;
        this.noteSchedulingCallback = noteSchedulingCallback;
        this.wholeNoteLength = wholeNoteLength;
        this.audioContext = audioContext;
    }
    get schedulePeriodTicks() {
        return this.schedulePeriod / this.tickDuration;
    }
    get audioContextTime() {
        if (!this.audioContext)
            return 0;
        return (this.audioContext.currentTime - this.audioContextStartTime) * 1000;
    }
    get tickDuration() {
        return this.wholeNoteLength / this.tickDenominator;
    }
    get calculatedTick() {
        return this.currentTick + Math.round((this.audioContextTime - this.currentTickTimestamp) / this.tickDuration);
    }
    start() {
        this.playing = true;
        this.stepQueue.sort();
        this.audioContextStartTime = this.audioContext.currentTime;
        this.currentTickTimestamp = this.audioContextTime;
        if (!this.schedulerIntervalHandle) {
            this.schedulerIntervalHandle = window.setInterval(() => this.scheduleIterationStep(), this.scheduleInterval);
        }
    }
    setIterationStep(step) {
        step = Math.min(this.stepQueue.steps.length - 1, step);
        this.stepQueueIndex = step;
        this.currentTick = this.stepQueue.steps[this.stepQueueIndex].tick;
    }
    pause() {
        this.playing = false;
    }
    resume() {
        this.playing = true;
        this.currentTickTimestamp = this.audioContextTime;
    }
    reset() {
        this.playing = false;
        this.currentTick = 0;
        this.currentTickTimestamp = 0;
        this.stepQueueIndex = 0;
        clearInterval(this.scheduleInterval);
        this.schedulerIntervalHandle = null;
    }
    loadNotes(currentVoiceEntries) {
        let thisTick = this.lastTickOffset;
        if (this.stepQueue.steps.length > 0) {
            thisTick = this.stepQueue.getFirstEmptyTick();
        }
        for (let entry of currentVoiceEntries) {
            if (!entry.IsGrace) {
                for (let note of entry.Notes) {
                    this.stepQueue.addNote(thisTick, note);
                    this.stepQueue.createStep(thisTick + note.Length.RealValue * this.tickDenominator);
                }
            }
        }
    }
    scheduleIterationStep() {
        var _a, _b;
        if (!this.playing)
            return;
        this.currentTick = this.calculatedTick;
        this.currentTickTimestamp = this.audioContextTime;
        let nextTick = (_a = this.stepQueue.steps[this.stepQueueIndex]) === null || _a === void 0 ? void 0 : _a.tick;
        while (this.nextTickAvailableAndWithinSchedulePeriod(nextTick)) {
            let step = this.stepQueue.steps[this.stepQueueIndex];
            let timeToTick = (step.tick - this.currentTick) * this.tickDuration;
            if (timeToTick < 0)
                timeToTick = 0;
            this.scheduledTicks.add(step.tick);
            this.noteSchedulingCallback(timeToTick / 1000, step.notes);
            this.stepQueueIndex++;
            nextTick = (_b = this.stepQueue.steps[this.stepQueueIndex]) === null || _b === void 0 ? void 0 : _b.tick;
        }
        for (let tick of this.scheduledTicks) {
            if (tick <= this.currentTick) {
                this.scheduledTicks.delete(tick);
            }
        }
    }
    nextTickAvailableAndWithinSchedulePeriod(nextTick) {
        return (nextTick &&
            this.currentTickTimestamp + (nextTick - this.currentTick) * this.tickDuration <=
                this.currentTickTimestamp + this.schedulePeriod);
    }
}
