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

    // Reset boss/enemy visual state
    updateEnemyAppearance();

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

function getDifficultyLevel(currentScore) {
    if (currentScore < 2) return 1; // 0-1: Easy
    if (currentScore < 4) return 2; // 2-3: Moderate
    if (currentScore < 5) return 3; // 4: Harder
    // Level 4 skipped or merged into pre-boss for faster progression
    return 5; // 5+: Boss
}

function updateEnemyAppearance() {
    const level = getDifficultyLevel(score);
    const opponentSprite = opponentElem.querySelector('.sprite');

    // Reset classes
    opponentSprite.className = 'sprite';
    opponentSprite.style.backgroundImage = '';
    document.getElementById('dohyo-area').classList.remove('boss-mode');

    // Apply level-based styling
    if (isBoss) {
        opponentSprite.classList.add('boss');
        document.getElementById('dohyo-area').classList.add('boss-mode');
    } else if (level >= 4) {
        opponentSprite.classList.add('strong');
    } else if (level >= 3) {
        opponentSprite.classList.add('medium');
    }
}

// Question Generation
function generateQuestion() {
    try {
        const level = getDifficultyLevel(score);

        // Check if we should repeat a wrong question
        const dangerMode = playerPosition < 30;
        const repeatChance = dangerMode ? 0.7 : 0.3;

        if (wrongQuestions.length > 0 && Math.random() < repeatChance) {
            currentQuestion = wrongQuestions.pop();
        } else {
            let type, n1, n2, ans;
            const types = ['+', '-', '*', '/'];

            // Determine operation based on level
            let availableTypes = ['+', '-'];
            if (level >= 3) availableTypes.push('*');
            if (level >= 4) availableTypes.push('/');

            // Bias towards tricky questions in higher levels
            const trickyChance = (level - 1) * 0.2; // Lv1: 0%, Lv2: 20%, Lv3: 40%, Lv4: 60%, Lv5: 80%
            const isTricky = Math.random() < trickyChance;

            type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

            // Boss mode / High level settings
            const maxNum = isBoss ? 50 : (level * 10 + 10); // Lv1: 20, Lv2: 30...

            switch (type) {
                case '+':
                    if (isTricky && level >= 2) {
                        // Tricky: Sum > 10 or carry over (e.g. 8+5)
                        n1 = Math.floor(Math.random() * 9) + 2; // 2-10
                        n2 = Math.floor(Math.random() * 9) + 2;
                        if (n1 + n2 < 10) n1 += 5; // Ensure it's likely > 10
                    } else {
                        n1 = Math.floor(Math.random() * maxNum) + 1;
                        n2 = Math.floor(Math.random() * maxNum) + 1;
                    }
                    ans = n1 + n2;
                    break;
                case '-':
                    if (isTricky && level >= 2) {
                        // Tricky: Borrowing (e.g. 13-8)
                        n1 = Math.floor(Math.random() * 15) + 10; // 10-25
                        n2 = Math.floor(Math.random() * 9) + 2; // 2-10
                        // Ensure borrowing: unit digit of n1 < n2
                        if ((n1 % 10) >= n2) n1 -= (n1 % 10) + 1;
                    } else {
                        n1 = Math.floor(Math.random() * maxNum) + 1;
                        n2 = Math.floor(Math.random() * maxNum) + 1;
                    }
                    if (n1 < n2) [n1, n2] = [n2, n1];
                    ans = n1 - n2;
                    break;
                case '*':
                    if (isTricky || level >= 4) {
                        // Hard tables: 6, 7, 8, 9
                        const hard = [6, 7, 8, 9];
                        n1 = hard[Math.floor(Math.random() * hard.length)];
                        n2 = Math.floor(Math.random() * 9) + 1;
                    } else {
                        // Easy tables: 2, 3, 4, 5
                        const easy = [2, 3, 4, 5];
                        n1 = easy[Math.floor(Math.random() * easy.length)];
                        n2 = Math.floor(Math.random() * 9) + 1;
                    }
                    ans = n1 * n2;
                    break;
                case '/':
                    // Inverse of multiplication
                    const divBase = (level >= 4) ? [6, 7, 8, 9] : [2, 3, 4, 5];
                    n2 = divBase[Math.floor(Math.random() * divBase.length)];
                    ans = Math.floor(Math.random() * 9) + 1;
                    n1 = n2 * ans;
                    break;
            }
            currentQuestion = { n1, n2, type, ans };
        }

        // Display Question
        qNum1.textContent = currentQuestion.n1;
        qOp.textContent = currentQuestion.type.replace('*', '×').replace('/', '÷');
        qNum2.textContent = currentQuestion.n2;
        qAns.textContent = "?";

        // Generate Answers
        let answers = [currentQuestion.ans];
        const variance = isBoss ? 20 : 10;
        while (answers.length < 4) {
            let wrong = currentQuestion.ans + Math.floor(Math.random() * variance) - Math.floor(variance / 2);
            if (wrong !== currentQuestion.ans && wrong >= 0 && !answers.includes(wrong)) {
                answers.push(wrong);
            }
        }
        answers.sort(() => Math.random() - 0.5);

        ansBtns.forEach((btn, i) => {
            btn.textContent = answers[i];
            btn.dataset.value = answers[i];
        });

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
    if (timeLeft > maxTime * 0.5) {
        maxTime = Math.max(3000, maxTime - 200);
    }

    consecutiveCorrect++;
    consecutiveWrong = 0;

    isAnimating = true;
    playerElem.classList.add('attack-right');
    playAttackSound();

    setTimeout(() => {
        playerElem.classList.remove('attack-right');
        isAnimating = false;

        let move = 10;
        const timePercent = timeLeft / maxTime;
        if (timePercent > 0.8) move += 5;
        else if (timePercent > 0.6) move += 3;
        else if (timePercent > 0.4) move += 1;

        playerPosition += move;
        if (playerPosition > 100) playerPosition = 100;

        updateWrestlerPositions();

        if (playerPosition >= 100) {
            winRound();
        } else {
            generateQuestion();
        }
    }, 300);
}

function handleWrongAnswer() {
    maxTime = Math.min(15000, maxTime + 500);
    consecutiveCorrect = 0;
    consecutiveWrong++;
    wrongQuestions.push(currentQuestion);

    isAnimating = true;
    opponentElem.classList.add('attack-left');
    playAttackSound();

    setTimeout(() => {
        opponentElem.classList.remove('attack-left');
        isAnimating = false;

        let move = 15;
        playerPosition -= move;
        if (playerPosition < 0) playerPosition = 0;

        updateWrestlerPositions();

        if (playerPosition <= 0) {
            loseRound();
        } else {
            generateQuestion();
        }
    }, 300);
}

function showMessage(msg) {
    messageText.textContent = msg;
    messageOverlay.classList.remove('hidden');
    setTimeout(() => {
        messageOverlay.classList.add('hidden');
    }, 1000);
}

function updateWrestlerPositions() {
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
    currentState = STATE.RESULT;

    // Update enemy appearance for next round
    updateEnemyAppearance();

    if (isBoss) {
        setTimeout(() => {
            endGame();
        }, 2000);
        return;
    }

    // Check for Boss Trigger (Level 5 starts at 5 wins)
    if (score === 5 && !isBoss) {
        isBoss = true;

        setTimeout(() => {
            showMessage("謎の強敵現る...！");
            updateEnemyAppearance(); // Will apply boss styling

            maxTime = 8000;
            stopBGM();
            setTimeout(() => playBGM(true), 500);
        }, 1500);
    }

    setTimeout(() => {
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
