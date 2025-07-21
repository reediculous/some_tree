const SCENARIO_URL = '/scenarios/example.json';
const SOUNDS_DIR = '/sounds/';

const app = document.getElementById('app');

class AudioLooper {
    constructor(audioFile) {
        this.audioFile = audioFile;
        this.audio = null;
        this.ready = false;
        this.loopTimer = null;
        this.stopAfterLoop = false;
        this.isPlaying = false;
        this.startTime = null;
        this.duration = null;
        this._init();
    }

    _init() {
        this.audio = new Audio(SOUNDS_DIR + this.audioFile);
        this.audio.preload = "auto";
        this.audio.addEventListener("loadedmetadata", () => {
            this.ready = true;
            this.duration = this.audio.duration;
        });
    }

    play(syncToTime = null) {
        if (this.isPlaying) return;
        if (!this.ready) {
            this.audio.addEventListener("loadedmetadata", () => this._actualPlay(syncToTime), { once: true });
        } else {
            this._actualPlay(syncToTime);
        }
    }

    _actualPlay(syncToTime = null) {
        const kickOff = () => {
            this.isPlaying = true;
            this._playOnce();
        };

        if (syncToTime !== null) {
            const now = performance.now();
            const msTillSync = Math.max(0, syncToTime - now);
            setTimeout(kickOff, msTillSync);
        } else {
            kickOff();
        }
    }

    _playOnce() {
        this.audio.currentTime = 0;
        this.audio.play();
        this.startTime = performance.now();

        clearTimeout(this.loopTimer);

        if (this.duration) {
            this.loopTimer = setTimeout(() => {
                if (this.stopAfterLoop) {
                    this.audio.pause();
                    this.isPlaying = false;
                    this.stopAfterLoop = false;
                } else {
                    this._playOnce();
                }
            }, this.duration * 1000 - 30);
        } else {
            this.audio.addEventListener("ended", () => {
                if (this.stopAfterLoop) {
                    this.isPlaying = false;
                    this.stopAfterLoop = false;
                } else {
                    this._playOnce();
                }
            }, { once: true });
        }
    }

    getNextLoopStartTime() {
        if (!this.isPlaying || !this.duration || !this.startTime) {
            return null;
        }
        return this.startTime + (this.duration * 1000);
    }

    scheduleStopAfterLoop() {
        this.stopAfterLoop = true;
    }
}

const audioLoopers = {};
let scenarioStartTime = null;

async function start() {
    const response = await fetch(SCENARIO_URL);
    const scenario = await response.json();
    processScenario(scenario);
}

function processScenario(scenario) {
    let step = 0;
    app.innerHTML = "";

    function doStep() {
        if (step >= scenario.length) return;
        const action = scenario[step];

        if (action.action === "play") {
            const btn = document.createElement('button');
            btn.textContent = `play ${action.audio}`;
            btn.onclick = async () => {
                if (scenarioStartTime === null) scenarioStartTime = performance.now();

                if (!audioLoopers[action.audio]) {
                    audioLoopers[action.audio] = new AudioLooper(action.audio);
                }

                const thisLooper = audioLoopers[action.audio];

                if (thisLooper.isPlaying) {
                    btn.remove();
                    step++;
                    doStep();
                    return;
                }

                const prevLooper = findPreviousActiveLooper(step, scenario);
                if (prevLooper) {
                    const ensurePlayOnNextLoop = () => {
                        const nextLoopStart = prevLooper.getNextLoopStartTime();
                        if (nextLoopStart === null) {
                            setTimeout(ensurePlayOnNextLoop, 50);
                        } else {
                            thisLooper.play(nextLoopStart);
                        }
                    };
                    ensurePlayOnNextLoop();
                } else {
                    thisLooper.play();
                }
                btn.remove();
                step++;
                doStep();
            };
            app.appendChild(btn);
        }
        // --- CHOOSE action branch ---
        else if (action.action === "choose") {
            // Create a container for the buttons
            const container = document.createElement('div');
            container.style.margin = "1em 0";
            // Array to track the buttons to disable all after a choice
            const btns = [];
            for (const option of action.options) {
                const btn = document.createElement('button');
                btn.textContent = `choose ${option.audio}`;
                btn.onclick = async () => {
                    if (scenarioStartTime === null) scenarioStartTime = performance.now();

                    if (!audioLoopers[option.audio]) {
                        audioLoopers[option.audio] = new AudioLooper(option.audio);
                    }
                    const thisLooper = audioLoopers[option.audio];

                    if (thisLooper.isPlaying) {
                        container.remove();
                        step++;
                        doStep();
                        return;
                    }

                    // Sync with previous active looper as for play
                    const prevLooper = findPreviousActiveLooper(step, scenario);
                    if (prevLooper) {
                        const ensurePlayOnNextLoop = () => {
                            const nextLoopStart = prevLooper.getNextLoopStartTime();
                            if (nextLoopStart === null) {
                                setTimeout(ensurePlayOnNextLoop, 50);
                            } else {
                                thisLooper.play(nextLoopStart);
                            }
                        };
                        ensurePlayOnNextLoop();
                    } else {
                        thisLooper.play();
                    }
                    container.remove();
                    step++;
                    doStep();
                };
                container.appendChild(btn);
                btns.push(btn);
            }
            app.appendChild(container);
        }
        // --- END OF CHOOSE ---
        else if (action.action === "wait") {
            const targetElapsed = timeOfPreviousAction(step, scenario) + (action.seconds * 1000);
            const now = performance.now();
            let waitFor = 0;
            if (scenarioStartTime !== null)
                waitFor = Math.max(0, targetElapsed - (now - scenarioStartTime));
            else
                waitFor = action.seconds * 1000;
            setTimeout(() => {
                step++;
                doStep();
            }, waitFor);
        } else if (action.action === "stop") {
            const btn = document.createElement('button');
            btn.textContent = `stop ${action.audio}`;
            btn.onclick = () => {
                if (audioLoopers[action.audio]) {
                    audioLoopers[action.audio].scheduleStopAfterLoop();
                }
                btn.remove();
                step++;
                doStep();
            };
            app.appendChild(btn);
        } else {
            step++;
            doStep();
        }
    }

    doStep();
}

function findPreviousActiveLooper(step, scenario) {
    for (let i = step - 1; i >= 0; --i) {
        if (
            scenario[i].action === "play" ||
            scenario[i].action === "choose"
        ) {
            // For choose, consider all options
            let audios = [];
            if (scenario[i].action === "play") {
                audios = [scenario[i].audio];
            } else if (scenario[i].action === "choose") {
                audios = scenario[i].options.map(opt => opt.audio);
            }
            for (const audio of audios) {
                if (audioLoopers[audio] && audioLoopers[audio].isPlaying) {
                    return audioLoopers[audio];
                }
            }
        }
    }
    return null;
}

function timeOfPreviousAction(step, scenario) {
    let elapsedMs = 0;
    for (let i = 0; i < step; ++i) {
        const action = scenario[i];
        if (action.action === "wait") {
            elapsedMs += action.seconds * 1000;
        }
    }
    return elapsedMs;
}

start();
