// Game State
const STATE = {
    START: 'start',
    PLAYING: 'playing',
    RESULT: 'result'
};

// Explicitly hide result screen on load
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
});

let currentState = STATE.START;
let score = 0;
let currentQuestion = null;
let timer = null;
let timeLeft = 0;
let maxTime = 10000; // Initial 10 seconds
let playerPosition = 50; // 0 (Lost) to 100 (Won)
let consecutiveWrong = 0;
let consecutiveCorrect = 0;
let wrongQuestions = []; // Store wrong questions to repeat
let difficultyMultiplier = 1.0; // Adjusts based on speed
let isBoss = false;
let isAnimating = false;

// Audio Setup - Using audio files
let bgmNormal;
let bgmBoss;
let attackSound;
let currentBGM = null;
let isMuted = false;

function initAudio() {
    // Load audio files
    bgmNormal = new Audio('assets/sounds/bgm_normal.mp3');
    bgmBoss = new Audio('assets/sounds/bgm_boss.mp3');
    attackSound = new Audio('assets/sounds/attack.mp3');

    // Set BGM to loop
    bgmNormal.loop = true;
    bgmBoss.loop = true;

    // Set volumes
    bgmNormal.volume = 0.3;
    bgmBoss.volume = 0.3;
    attackSound.volume = 0.5;
}

function playAttackSound() {
    if (isMuted || !attackSound) return;
    attackSound.currentTime = 0; // Reset to start
    attackSound.play().catch(e => console.log("Attack sound play failed:", e));
}

function playBGM(isBossMode = false) {
    if (isMuted) return;

    stopBGM();

    currentBGM = isBossMode ? bgmBoss : bgmNormal;
    if (currentBGM) {
        currentBGM.currentTime = 0;
        currentBGM.play().catch(e => console.log("BGM play failed:", e));
    }
}

function stopBGM() {
    if (bgmNormal) {
        bgmNormal.pause();
        bgmNormal.currentTime = 0;
    }
    if (bgmBoss) {
        bgmBoss.pause();
        bgmBoss.currentTime = 0;
    }
    currentBGM = null;
}

function toggleMute() {
    isMuted = !isMuted;
    const soundBtn = document.getElementById('sound-toggle');
    soundBtn.textContent = isMuted ? '🔇' : '🔊';

    if (isMuted) {
        stopBGM();
    } else if (currentState === STATE.PLAYING) {
        playBGM(isBoss);
    }
}

// DOM Elements
const gameContainer = document.getElementById('game-container');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const endBtn = document.getElementById('end-btn');
const winsDisplay = document.getElementById('wins');
const playerElem = document.getElementById('player');
const opponentElem = document.getElementById('opponent');
const qNum1 = document.getElementById('q-num1');
const qOp = document.getElementById('q-op');
const qNum2 = document.getElementById('q-num2');
const qAns = document.getElementById('q-ans');
const timerBar = document.getElementById('timer-bar');
const ansBtns = document.querySelectorAll('.ans-btn');
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');
const resultTitle = document.getElementById('result-title');
const resultRank = document.getElementById('result-rank');

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);
endBtn.addEventListener('click', endGame);
ansBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const val = parseInt(e.target.dataset.value);
        checkAnswer(val);
    });
});

// Game Loop
function startGame() {
    initAudio();
    currentState = STATE.PLAYING;
    startScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');

    // Reset Game State
    score = 0;
    winsDisplay.textContent = score;
    playerPosition = 50;
    maxTime = 10000;
    consecutiveWrong = 0;
    consecutiveCorrect = 0;
    wrongQuestions = [];
    isBoss = false;
    isAnimating = false;

    updateWrestlerPositions();
    generateQuestion();

    // Start BGM
    playBGM(false);
}

function resetGame() {
    startGame();
}

function endGame() {
    currentState = STATE.RESULT;
    resultScreen.classList.remove('hidden');

    // Stop BGM
    stopBGM();

    // Calculate Rank
    let rank = "序ノ口";
    if (score > 5) rank = "幕下";
    if (score > 10) rank = "十両";
    if (score > 20) rank = "前頭";
    if (score > 30) rank = "小結";
    if (score > 40) rank = "関脇";
    if (score > 50) rank = "大関";
    if (score > 60) rank = "横綱";

    resultTitle.textContent = "これにて千秋楽！";
    resultRank.textContent = `あなたの番付: ${rank} (${score}勝)`;
}

// Question Generation
function generateQuestion() {
    try {
        // Check if we should repeat a wrong question
        // Higher chance if player is in danger (position < 30)
        const dangerMode = playerPosition < 30;
        const repeatChance = dangerMode ? 0.7 : 0.3;

        if (wrongQuestions.length > 0 && Math.random() < repeatChance) {
            currentQuestion = wrongQuestions.pop(); // Take the last wrong question
        } else {
            // Generate new question with boss difficulty scaling
            const types = ['+', '-', '*', '/'];
            const type = types[Math.floor(Math.random() * types.length)];
            let n1, n2, ans;

            // Boss mode increases difficulty
            const maxNum = isBoss ? 50 : 20;
            const maxMultiply = isBoss ? 12 : 9;

            switch (type) {
                case '+':
                    n1 = Math.floor(Math.random() * maxNum) + 1;
                    n2 = Math.floor(Math.random() * maxNum) + 1;
                    ans = n1 + n2;
                    break;
                case '-':
                    n1 = Math.floor(Math.random() * maxNum) + 1;
                    n2 = Math.floor(Math.random() * maxNum) + 1;
                    if (n1 < n2) [n1, n2] = [n2, n1]; // Ensure positive result
                    ans = n1 - n2;
                    break;
                case '*':
                    n1 = Math.floor(Math.random() * maxMultiply) + 1;
                    n2 = Math.floor(Math.random() * maxMultiply) + 1;
                    ans = n1 * n2;
                    break;
                case '/':
                    n2 = Math.floor(Math.random() * maxMultiply) + 1;
                    ans = Math.floor(Math.random() * maxMultiply) + 1;
                    n1 = n2 * ans; // Ensure clean division
                    break;
            }
            currentQuestion = { n1, n2, type, ans };
        }

        // Display Question
        qNum1.textContent = currentQuestion.n1;
        qOp.textContent = currentQuestion.type.replace('*', '×').replace('/', '÷');
        qNum2.textContent = currentQuestion.n2;
        qAns.textContent = "?";

        // Generate Answers (1 correct, 3 wrong for 4 total)
        let answers = [currentQuestion.ans];
        const variance = isBoss ? 20 : 10;
        while (answers.length < 4) {
            let wrong = currentQuestion.ans + Math.floor(Math.random() * variance) - Math.floor(variance / 2);
            if (wrong !== currentQuestion.ans && wrong >= 0 && !answers.includes(wrong)) {
                answers.push(wrong);
            }
        }
        // Shuffle answers
        answers.sort(() => Math.random() - 0.5);

        // Update Buttons
        ansBtns.forEach((btn, i) => {
            btn.textContent = answers[i];
            btn.dataset.value = answers[i];
        });

        // Start Timer
        startTimer();
    } catch (e) {
        console.error("Error in generateQuestion:", e);
    }
}

function startTimer() {
    if (timer) clearInterval(timer);
    timeLeft = maxTime;
    updateTimerBar();

    timer = setInterval(() => {
        timeLeft -= 100;
        updateTimerBar();
        if (timeLeft <= 0) {
            clearInterval(timer);
            handleTimeUp();
        }
    }, 100);
}

function updateTimerBar() {
    const pct = (timeLeft / maxTime) * 100;
    timerBar.style.transform = `scaleX(${pct / 100})`;
    if (pct < 30) timerBar.style.backgroundColor = 'red';
    else timerBar.style.backgroundColor = '#d32f2f';
}

function handleTimeUp() {
    showMessage("時間切れ！");
    handleWrongAnswer();
}

function checkAnswer(val) {
    if (currentState !== STATE.PLAYING || isAnimating) return;
    clearInterval(timer);

    if (val === currentQuestion.ans) {
        handleCorrectAnswer();
    } else {
        handleWrongAnswer();
    }
}

function handleCorrectAnswer() {
    // Adaptive Difficulty: If answered quickly (> 50% time left), reduce maxTime slightly for next
    if (timeLeft > maxTime * 0.5) {
        maxTime = Math.max(3000, maxTime - 200); // Min 3 sec
    }

    consecutiveCorrect++;
    consecutiveWrong = 0;

    // Attack Animation
    isAnimating = true;
    playerElem.classList.add('attack-right');
    playAttackSound();

    setTimeout(() => {
        playerElem.classList.remove('attack-right');
        isAnimating = false;

        // Move Player Forward based on answer speed
        let move = 10; // Base movement

        // Speed bonus: faster answers push harder
        const timePercent = timeLeft / maxTime;
        if (timePercent > 0.8) {
            move += 5; // Very fast: +5
        } else if (timePercent > 0.6) {
            move += 3; // Fast: +3
        } else if (timePercent > 0.4) {
            move += 1; // Medium: +1
        }
        // Slow answers (< 40% time): no bonus

        playerPosition += move;
        if (playerPosition > 100) playerPosition = 100;

        updateWrestlerPositions();

        if (playerPosition >= 100) {
            winRound();
        } else {
            generateQuestion();
        }
    }, 300); // Wait for animation
}

function handleWrongAnswer() {
    // Adaptive Difficulty: Increase maxTime slightly
    maxTime = Math.min(15000, maxTime + 500); // Max 15 sec

    consecutiveCorrect = 0;
    consecutiveWrong++;

    // Add to wrong questions pool
    wrongQuestions.push(currentQuestion);

    // Attack Animation (Opponent)
    isAnimating = true;
    opponentElem.classList.add('attack-left');
    playAttackSound();

    setTimeout(() => {
        opponentElem.classList.remove('attack-left');
        isAnimating = false;

        // Move Player Backward (fixed amount)
        let move = 15;
        playerPosition -= move;
        if (playerPosition < 0) playerPosition = 0;

        updateWrestlerPositions();

        if (playerPosition <= 0) {
            loseRound();
        } else {
            generateQuestion();
        }
    }, 300); // Wait for animation
}

function showMessage(msg) {
    messageText.textContent = msg;
    messageOverlay.classList.remove('hidden');
    setTimeout(() => {
        messageOverlay.classList.add('hidden');
    }, 1000);
}

function updateWrestlerPositions() {
    // Update wrestler positions based on playerPosition (0-100)
    const center = 20 + (playerPosition * 0.6);
    const offset = 15;
    const playerLeft = center - offset;
    const opponentLeft = center + offset;
    playerElem.style.left = `${playerLeft}%`;
    opponentElem.style.left = `${opponentLeft}%`;
}

function winRound() {
    score++;
    winsDisplay.textContent = score;
    showMessage("白星！");
    currentState = STATE.RESULT; // Pause briefly

    // Check if boss was defeated
    if (isBoss) {
        // Boss defeated! End game with victory
        setTimeout(() => {
            endGame();
        }, 2000);
        return; // Exit function to prevent continuing
    }

    // Check for Boss Trigger
    if (score === 5 && !isBoss) {
        isBoss = true;

        // Switch to boss appearance
        setTimeout(() => {
            showMessage("謎の強敵現る...！");

            // Change opponent to boss image
            const opponentSprite = opponentElem.querySelector('.sprite');
            opponentSprite.style.backgroundImage = "url('assets/boss.png')";
            opponentSprite.classList.add('boss-sprite');

            // Add boss mode styling
            document.getElementById('dohyo-area').classList.add('boss-mode');

            // Reduce time for boss battles
            maxTime = 8000;

            // Switch to boss BGM
            stopBGM();
            setTimeout(() => playBGM(true), 500);
        }, 1500);
    }

    setTimeout(() => {
        // Reset for next round
        currentState = STATE.PLAYING;
        playerPosition = 50;
        updateWrestlerPositions();
        generateQuestion();
    }, 2000);
}

function loseRound() {
    showMessage("黒星...");
    setTimeout(() => {
        endGame();
    }, 2000);
}
