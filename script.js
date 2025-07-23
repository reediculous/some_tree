const SCENARIO_URL = 'scenarios/node.json';
const SOUNDS_DIR = 'sounds/';

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
let quizState = {
    currentNodeId: null,
};
let scenarioTree = null;

// Helper: Find any active looper (returns the first one it finds)
function findActiveLooper() {
    // Option: you could select the "newest" or just the first found
    let found = null;
    for (let key in audioLoopers) {
        if (audioLoopers[key].isPlaying) {
            found = audioLoopers[key];
        }
    }
    return found;
}

async function start() {
    const response = await fetch(SCENARIO_URL);
    const treeArr = await response.json();
    scenarioTree = treeArr[0];
    quizState.currentNodeId = "1";
    showCurrentNode();
}

function showCurrentNode() {
    const nodeId = quizState.currentNodeId;
    const node = scenarioTree[nodeId];
    app.innerHTML = "";

    if (node.image) {
        const img = document.createElement('img');
        img.src = `/some_tree/images/${node.image}`;
        img.alt = '';
        app.appendChild(img);
    }

    const questionEl = document.createElement('div');
    questionEl.className = 'question-text';
    questionEl.textContent = node.question;
    app.appendChild(questionEl);

    if (node.options && node.options.length > 0) {
        const optionsDiv = document.createElement('div');
        optionsDiv.style.display = "flex";
        optionsDiv.style.flexDirection = "column";

        node.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option.text;
            btn.onclick = () => {
                // SYNC NEW AUDIO TO ACTIVE LOOPER, IF EXISTS
                if (option.action) {
                    option.action.split(';').map(s => s.trim()).forEach(actionStr => {
                        if (!actionStr) return;
                        if (actionStr.startsWith('+')) {
                            // Play loop (if not already active)
                            const audioKey = actionStr.substring(1) + ".wav";
                            if (!audioLoopers[audioKey]) {
                                audioLoopers[audioKey] = new AudioLooper(audioKey);
                            }
                            const looper = audioLoopers[audioKey];
                            if (!looper.isPlaying) {
                                // *** Here is the sync logic: ***
                                const prevLooper = findActiveLooper();
                                if (prevLooper) {
                                    // Wait for next loop of the latest active looper!
                                    const trySync = () => {
                                        const syncTo = prevLooper.getNextLoopStartTime();
                                        if (syncTo === null) {
                                            setTimeout(trySync, 30);
                                        } else {
                                            looper.play(syncTo);
                                        }
                                    };
                                    trySync();
                                } else {
                                    looper.play();
                                }
                            }
                        } else if (actionStr.startsWith('-')) {
                            // Schedule stop for that loop
                            const audioKey = actionStr.substring(1) + ".wav";
                            if (audioLoopers[audioKey]) {
                                audioLoopers[audioKey].scheduleStopAfterLoop();
                            }
                        }
                    });
                }
                if (option.next && scenarioTree[option.next]) {
                    quizState.currentNodeId = option.next;
                    showCurrentNode();
                } else {
                    showEndState();
                }
            };
            optionsDiv.appendChild(btn);
        });

        app.appendChild(optionsDiv);
    } else {
        showEndState();
    }
}

function showEndState() {
    app.innerHTML = "";

    const creditsDiv = document.createElement('div');
    creditsDiv.className = 'end-credits';

    creditsDiv.innerHTML = `
        <div class="credit-item">
            Идея и музыка: <a href="https://vk.com/buongiorno001" target="_blank" rel="noopener" class="credit-link">Софья Филянина</a>
        </div>
        <div class="credit-item">
            Запрограммировал: <a href="https://vk.com/nizamovdanil" target="_blank" rel="noopener" class="credit-link">Данил Низамов</a>
        </div>
    `;

    app.appendChild(creditsDiv);
}

start();
