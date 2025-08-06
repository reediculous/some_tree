const SCENARIO_URL = '/some_tree/scenarios/node.json';
const SOUNDS_DIR = '/some_tree/sounds/';

// Preload animation frames
const ANIMATION_FRAMES = [
    "/some_tree/icons/delay_animation/delay_wait_1.png",
    "/some_tree/icons/delay_animation/delay_wait_2.png",
    "/some_tree/icons/delay_animation/delay_wait_3.png",
    "/some_tree/icons/delay_animation/delay_wait_4.png",
    "/some_tree/icons/delay_animation/delay_wait_5.png",
    "/some_tree/icons/delay_animation/delay_wait_6.png",
    "/some_tree/icons/delay_animation/delay_wait_7.png",
    "/some_tree/icons/delay_animation/delay_wait_8.png",
];

// Preload images on startup
const preloadedFrames = [];
ANIMATION_FRAMES.forEach((src, index) => {
    const img = new Image();
    img.src = src;
    preloadedFrames[index] = img;
});

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

function showCredits() {
    const creditsDiv = document.createElement('div');
    creditsDiv.className = 'end-credits';

    creditsDiv.innerHTML = `
        <div class="credit-item">
            Idea & music: <a href="https://vk.com/buongiorno001" target="_blank" rel="noopener" class="credit-link">Sofia Philianina</a>
        </div>
        <div class="credit-item">
            Development: <a href="https://vk.com/nizamovdanil" target="_blank" rel="noopener" class="credit-link">Danil Nizamov</a>
        </div>
    `;

    return creditsDiv;
}

function showCurrentNode() {
    const nodeId = quizState.currentNodeId;
    const node = scenarioTree[nodeId];
    const prevWarn = document.querySelector('.sound-warning-bottom');
    if (prevWarn) prevWarn.remove();
    app.innerHTML = "";


    let delayMs = (typeof node.delay === "number" && node.delay > 0) ? node.delay : 0;
    let animDiv, animInterval;
    if (delayMs > 0) {
        // Frame sequence (index into preloadedFrames array)
        const frameSequence = [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7];
        let currentFrame = 0;

        animDiv = document.createElement('div');
        animDiv.className = 'waiting-animation';

        const imageElements = preloadedFrames.map((img, index) => {
            const clone = img.cloneNode();
            clone.style.display = index === frameSequence[0] ? 'block' : 'none';
            clone.style.position = 'absolute';
            animDiv.appendChild(clone);
            return clone;
        });

        app.appendChild(animDiv);

        animInterval = setInterval(() => {
            imageElements[frameSequence[currentFrame]].style.display = 'none';
            currentFrame = (currentFrame + 1) % frameSequence.length;
            imageElements[frameSequence[currentFrame]].style.display = 'block';
        }, 100);
    }

    const renderEverything = () => {
        if (animDiv) {
            clearInterval(animInterval);
            app.removeChild(animDiv);
        }

        const isFinal = node.final === true;

        // Use a wrapper div only on final node for bottom-padding credits
        const mainContainer = isFinal
            ? document.createElement('div')
            : app; // use app itself for non-final

        if (isFinal) {
            mainContainer.className = 'final-node-container';
        }

        // === IMAGE ===
        // Temporarily removed

        // === QUESTION ===
        const questionEl = document.createElement('div');
        questionEl.className = 'question-text';
        questionEl.textContent = node.question;
        mainContainer.appendChild(questionEl);

        // === SUBTEXT ===
        const subheaderEl = document.createElement('div');
        subheaderEl.className = 'subheader-text';
        subheaderEl.textContent = node.subheader;
        mainContainer.appendChild(subheaderEl);

        // === OPTIONS ===
        const hasOptions = node.options && node.options.length > 0;

        if (hasOptions) {
            const optionsDiv = document.createElement('div');
            optionsDiv.style.display = "flex";
            optionsDiv.style.flexDirection = "column";

            node.options.forEach(option => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = option.text;
                btn.onclick = () => {
                    if (option.action && option.action.trim() === "refresh") {
                        window.location.reload();
                        return;
                    }
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
                    }
                };
                optionsDiv.appendChild(btn);
            });

            mainContainer.appendChild(optionsDiv);
        }

        // === END CREDITS ON FINAL NODES ONLY ===
        if (isFinal) {
            mainContainer.appendChild(showCredits());
            app.appendChild(mainContainer);
        }

        // === SOUND WARNING ON START NODE ===
        if (nodeId === "1") {
            const soundWarning = document.createElement('div');
            soundWarning.className = "sound-warning-bottom";
            soundWarning.innerHTML = `
                <img src="/some_tree/icons/sound_on.png" alt="sound on">
                <span>make sure to turn the sound on!</span>
            `;
            document.body.appendChild(soundWarning);
        }
    };

    setTimeout(renderEverything, delayMs);
}

start();
