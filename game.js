const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvases = document.querySelectorAll('.next-canvas');
const nextCtxs = Array.from(nextCanvases).map(canvas => canvas.getContext('2d'));

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const comboElement = document.getElementById('combo');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreElement = document.getElementById('finalScore');
const finalLinesElement = document.getElementById('finalLines');
const timerDisplay = document.getElementById('timer-display');

// 게임 설정
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// 개선된 물리 상수
const GRAVITY = 0.5;
const JUMP_STRENGTH = -12;
const PLAYER_MOVE_SPEED = 5;
const FRICTION = 0.8;
const MAX_FALL_SPEED = 15;

const COLORS = {
    null: 'transparent',
    I: '#EBD6FB',
    L: '#EBD6FB',
    J: '#EBD6FB',
    S: '#EBD6FB',
    Z: '#EBD6FB',
    T: '#EBD6FB',
    O: '#EBD6FB',
    player: '#FFC107',
    shadow: 'rgba(255,255,255,0.05)'
};

const GRADIENTS = {
    I: ['#EBD6FB', '#687FE5'],
    L: ['#EBD6FB', '#687FE5'],
    J: ['#EBD6FB', '#687FE5'],
    S: ['#EBD6FB', '#687FE5'],
    Z: ['#EBD6FB', '#687FE5'],
    T: ['#EBD6FB', '#687FE5'],
    O: ['#EBD6FB', '#687FE5']
};

// 캔버스 크기 설정
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

// 게임 변수
let board;
let player;
let currentTetromino;
let nextTetrominos = [];
let shadowTetromino;
let score;
let level;
let lines;
let combo;
let gameOver;
let animationId;
let keys = {};
let particles = [];
let lastPlayerPos = { x: null, y: null };
let timeInSamePos = 0;
let dropCounter = 0;
let dropInterval = 300;
let lastTime = 0;

// 테트리스 블록 모양
const TETROMINOES = {
    'I': [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    'L': [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'J': [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'S': [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
    ],
    'Z': [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
    ],
    'T': [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'O': [
        [1, 1],
        [1, 1]
    ]
};

// 파티클 시스템
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.color = color;
        this.life = 1.0;
        this.decay = 0.02;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.life -= this.decay;
        this.size *= 0.98;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

function resetGame() {
    // 애니메이션 프레임 정리
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // 게임 상태 초기화
    gameOver = false;
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    
    // 플레이어 초기화
    player = {
        x: COLS / 2 - 0.5,
        y: ROWS - 2,
        vx: 0,
        vy: 0,
        width: 0.8,
        height: 0.8,
        onGround: false,
        coyoteTime: 0,
        jumpBufferTime: 0
    };
    
    // 게임 점수 및 상태 초기화
    score = 0;
    level = 1;
    lines = 0;
    combo = 0;
    
    // 테트로미노 관련 초기화
    currentTetromino = null;
    nextTetrominos = [];
    shadowTetromino = null;
    
    // 게임 루프 관련 초기화
    dropCounter = 0;
    dropInterval = 300;
    lastTime = 0;
    
    // 파티클 초기화
    particles = [];
    
    // 키 상태 초기화
    keys = {};
    
    // 타이머 관련 초기화
    lastPlayerPos = { x: null, y: null };
    timeInSamePos = 0;
    
    // UI 초기화
    updateUI();
    if (timerDisplay) {
        timerDisplay.textContent = '0.0s';
        timerDisplay.classList.remove('warning');
    }
    
    // 게임 오버 오버레이 숨기기
    if (gameOverOverlay) {
        gameOverOverlay.style.display = 'none';
    }
    
    // 화면 흔들림 효과 제거
    const container = document.querySelector('.game-container');
    if (container) {
        container.classList.remove('shake');
    }
    
    // 다음 캔버스 초기화
    nextCtxs.forEach(ctx => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    });
    
    // 새로운 테트로미노 생성
    createTetromino();
    
    // 게임 루프 시작
    gameLoop();
}

function createTetromino() {
    if (nextTetrominos.length > 0) {
        currentTetromino = nextTetrominos.shift();
    } else {
        const shapes = Object.keys(TETROMINOES);
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        currentTetromino = {
            x: Math.floor(COLS / 2) - 1,
            y: 0,
            shape: TETROMINOES[shape],
            type: shape,
            color: COLORS[shape]
        };
    }

    // 게임 오버 체크
    if (collide(currentTetromino)) {
        endGame();
        return;
    }

    // 다음 테트로미노들 생성
    while (nextTetrominos.length < 4) {
        createNextTetromino();
    }
    drawNextTetrominos();
    updateShadow();
}

function createNextTetromino() {
    const shapes = Object.keys(TETROMINOES);
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const nextTetromino = {
        x: Math.floor(COLS / 2) - 1,
        y: 0,
        shape: TETROMINOES[shape],
        type: shape,
        color: COLORS[shape]
    };
    nextTetrominos.push(nextTetromino);
}

function drawNextTetrominos() {
    nextCtxs.forEach((ctx, index) => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (nextTetrominos[index]) {
            const tetromino = nextTetrominos[index];
            const shape = tetromino.shape;
            const blockSize = 20;
            const offsetX = (ctx.canvas.width - shape[0].length * blockSize) / 2;
            const offsetY = (ctx.canvas.height - shape.length * blockSize) / 2;

            shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        drawBlock(ctx,
                            offsetX + x * blockSize,
                            offsetY + y * blockSize,
                            blockSize,
                            tetromino.color,
                            tetromino.type
                        );
                    }
                });
            });
        }
    });
}

function updateShadow() {
    if (!currentTetromino) return;
    shadowTetromino = { ...currentTetromino };
    while (!collide(shadowTetromino)) {
        shadowTetromino.y++;
    }
    shadowTetromino.y--;
}

function gameLoop(time = 0) {
    if (gameOver) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    // 레벨에 따른 낙하 속도 조정
    dropInterval = Math.max(50, 300 - (level - 1) * 35);

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        dropTetromino();
        dropCounter = 0;
    }

    updatePlayer(deltaTime);
    updateParticles();
    checkCollisions();
    draw();

    animationId = requestAnimationFrame(gameLoop);
}

function updatePlayer(deltaTime) {
    const dt = deltaTime / 1000;

    const accel = 60;
    const maxSpeed = 6;
    const airControl = 0.5;
    const decel = 40;
    const gravity = 30;
    const terminalVelocity = 15;
    const jumpVelocity = -12;

    const isMovingLeft = keys[65];
    const isMovingRight = keys[68];
    const onGround = player.onGround;

    // 좌우 입력 처리
    if (isMovingLeft) {
        player.vx -= accel * dt * (onGround ? 1 : airControl);
    } else if (isMovingRight) {
        player.vx += accel * dt * (onGround ? 1 : airControl);
    } else {
        if (player.vx > 0) {
            player.vx = Math.max(0, player.vx - decel * dt);
        } else if (player.vx < 0) {
            player.vx = Math.min(0, player.vx + decel * dt);
        }
    }

    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

    // 수평 이동 충돌 처리
    let newX = player.x + player.vx * dt;
    if (!isCollidingAt(newX, player.y, player.width, player.height)) {
        player.x = newX;
    } else {
        player.vx = 0;
    }

    // 중력 적용
    player.vy += gravity * dt;
    player.vy = Math.min(player.vy, terminalVelocity);

    let newY = player.y + player.vy * dt;

    if (!isCollidingAt(player.x, newY, player.width, player.height)) {
        player.y = newY;
        player.onGround = false;
    } else {
        if (player.vy > 0) {
            player.onGround = true;
            player.coyoteTime = 0.1;
        } else {
            player.onGround = false;
        }
        player.vy = 0;
    }

    if (player.coyoteTime > 0) {
        player.coyoteTime -= dt;
    }

    if (player.jumpBufferTime > 0) {
        player.jumpBufferTime -= dt;

        if (player.onGround || player.coyoteTime > 0) {
            player.vy = jumpVelocity;
            player.onGround = false;
            player.coyoteTime = 0;
            player.jumpBufferTime = 0;
        }
    }

    if (isCollidingAt(player.x, player.y, player.width, player.height)) {
        createParticles(
            player.x * BLOCK_SIZE + (player.width * BLOCK_SIZE) / 2,
            player.y * BLOCK_SIZE + (player.height * BLOCK_SIZE) / 2,
            COLORS.player,
            20
        );
        endGame();
    }

    // 10초 타이머 로직
    const currentPlayerGridX = Math.floor(player.x);
    const currentPlayerGridY = Math.floor(player.y);

    if (currentPlayerGridX === lastPlayerPos.x && currentPlayerGridY === lastPlayerPos.y) {
        timeInSamePos += deltaTime;
        if (timeInSamePos > 10000) {
            endGame();
        }
    } else {
        timeInSamePos = 0;
        lastPlayerPos.x = currentPlayerGridX;
        lastPlayerPos.y = currentPlayerGridY;
    }

    // 타이머 UI 업데이트
    if (timerDisplay) {
        timerDisplay.textContent = (timeInSamePos / 1000).toFixed(1) + 's';
        if (timeInSamePos > 7000) {
            timerDisplay.classList.add('warning');
        } else {
            timerDisplay.classList.remove('warning');
        }
    }
}

function isCollidingAt(x, y, width, height) {
    const left = Math.floor(x);
    const right = Math.floor(x + width - 0.001);
    const top = Math.floor(y);
    const bottom = Math.floor(y + height - 0.001);

    for (let gridY = top; gridY <= bottom; gridY++) {
        for (let gridX = left; gridX <= right; gridX++) {
            if (gridX < 0 || gridX >= COLS || gridY >= ROWS) return true;
            if (gridY >= 0 && board[gridY][gridX]) return true;
        }
    }
    return false;
}

function updateParticles() {
    particles = particles.filter(particle => {
        particle.update();
        return !particle.isDead();
    });
}

function playerJump() {
    if (player.onGround || player.coyoteTime > 0) {
        player.vy = JUMP_STRENGTH;
        player.onGround = false;
        player.coyoteTime = 0;
        player.jumpBufferTime = 0;
    } else {
        player.jumpBufferTime = 0.1;
    }
}

function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function drawBlock(context, x, y, size, color, type) {
    if (GRADIENTS[type]) {
        const gradient = context.createLinearGradient(x, y, x + size, y + size);
        gradient.addColorStop(0, GRADIENTS[type][0]);
        gradient.addColorStop(1, GRADIENTS[type][1]);
        context.fillStyle = gradient;
    } else {
        context.fillStyle = color;
    }

    context.fillRect(x, y, size, size);
    
    context.strokeStyle = 'rgba(0,0,0,0.3)';
    context.lineWidth = 1;
    context.strokeRect(x, y, size, size);
    
    context.fillStyle = 'rgba(255,255,255,0.3)';
    context.fillRect(x + 1, y + 1, size - 2, 2);
}

function draw() {
    ctx.fillStyle = '#F9F7F7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 보드 그리기
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(ctx, x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, COLORS[value], value);
            }
        });
    });

    // 그림자 블록 그리기
    if (shadowTetromino) {
        drawTetromino(shadowTetromino, 'rgba(0,0,0,0.2)');
    }

    // 현재 블록 그리기
    if (currentTetromino) {
        drawTetromino(currentTetromino, currentTetromino.color);
    }

    // 플레이어 그리기
    const px = player.x * BLOCK_SIZE;
    const py = player.y * BLOCK_SIZE;
    const pw = player.width * BLOCK_SIZE;
    const ph = player.height * BLOCK_SIZE;

    ctx.shadowColor = '#FF4136';
    ctx.shadowBlur = 15;
    
    ctx.fillStyle = '#FF4136';
    ctx.fillRect(px, py, pw, ph);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(px + pw * 0.15, py + ph * 0.15, pw * 0.7, ph * 0.7);

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // 파티클 그리기
    particles.forEach(particle => particle.draw(ctx));

    // 격자 그리기
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(canvas.width, y * BLOCK_SIZE);
        ctx.stroke();
    }
}

function drawTetromino(tetromino, color) {
    if (!tetromino) return;
    
    tetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const blockX = (tetromino.x + x) * BLOCK_SIZE;
                const blockY = (tetromino.y + y) * BLOCK_SIZE;
                
                if (color === 'rgba(0,0,0,0.2)') {
                    ctx.fillStyle = color;
                    ctx.fillRect(blockX, blockY, BLOCK_SIZE, BLOCK_SIZE);
                } else {
                    drawBlock(ctx, blockX, blockY, BLOCK_SIZE, color, tetromino.type);
                }
            }
        });
    });
}

function dropTetromino() {
    if (!currentTetromino) return;
    
    currentTetromino.y++;
    if (collide(currentTetromino)) {
        currentTetromino.y--;
        merge();
        const linesCleared = clearLines();
        if (linesCleared === 0) {
            combo = 0;
        }
        createTetromino();
    }
    updateShadow();
}

function moveTetromino(dir) {
    if (!currentTetromino) return;
    
    currentTetromino.x += dir;
    if (collide(currentTetromino)) {
        currentTetromino.x -= dir;
    } else {
        updateShadow();
    }
}

function rotateTetromino() {
    if (!currentTetromino || currentTetromino.type === 'O') return;

    const originalShape = currentTetromino.shape;
    const rotatedShape = rotate(originalShape);
    
    const kicks = getSRSKicks(currentTetromino.type, 0, 1);
    
    for (const kick of kicks) {
        const testTetromino = {
            ...currentTetromino,
            shape: rotatedShape,
            x: currentTetromino.x + kick.x,
            y: currentTetromino.y + kick.y
        };
        
        if (!collide(testTetromino)) {
            currentTetromino.shape = rotatedShape;
            currentTetromino.x = testTetromino.x;
            currentTetromino.y = testTetromino.y;
            updateShadow();
            return;
        }
    }
}

function getSRSKicks(type, from, to) {
    const kicksI = [
        { x: 0, y: 0 },
        { x: -2, y: 0 },
        { x: 1, y: 0 },
        { x: -2, y: -1 },
        { x: 1, y: 2 }
    ];
    
    const kicksOther = [
        { x: 0, y: 0 },
        { x: -1, y: 0 },
        { x: -1, y: 1 },
        { x: 0, y: -2 },
        { x: -1, y: -2 }
    ];
    
    return type === 'I' ? kicksI : kicksOther;
}

function rotate(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = matrix[r][c];
        }
    }
    
    return rotated;
}

function collide(tetromino) {
    if (!tetromino) return false;
    
    const { shape, x, y } = tetromino;
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col] && (
                x + col < 0 || 
                x + col >= COLS || 
                y + row >= ROWS || 
                (y + row >= 0 && board[y + row][x + col])
            )) {
                return true;
            }
        }
    }
    return false;
}

function merge() {
    if (!currentTetromino) return;
    
    currentTetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = currentTetromino.y + y;
                const boardX = currentTetromino.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentTetromino.type;
                }
            }
        });
    });

    checkCollisions();
}

function clearLines() {
    let linesCleared = 0;
    const clearedRows = [];

    for (let y = ROWS - 1; y >= 0; y--) {
        let filled = true;
        for (let x = 0; x < COLS; x++) {
            if (!board[y][x]) {
                filled = false;
                break;
            }
        }

        if (filled) {
            clearedRows.push(y);
            for (let x = 0; x < COLS; x++) {
                createParticles(
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    COLORS[board[y][x]],
                    3
                );
            }

            board.splice(y, 1);
            board.unshift(Array(COLS).fill(null));
            y++;
            linesCleared++;
        }
    }

    if (linesCleared > 0) {
        const container = document.querySelector('.game-container');
        if (container) {
            container.classList.add('shake');
            setTimeout(() => container.classList.remove('shake'), 300);
        }

        combo++;
        lines += linesCleared;
        level = Math.floor(lines / 10) + 1;

        const baseScore = [0, 100, 300, 500, 800];
        const comboBonus = combo > 1 ? (combo - 1) * 50 : 0;
        const levelBonus = level;
        score += (baseScore[linesCleared] || 0) * levelBonus + comboBonus;

        updateUI();
    }

    return linesCleared;
}

function checkCollisions() {
    if (!currentTetromino) return;

    const playerGrid = {
        left: Math.floor(player.x),
        right: Math.floor(player.x + player.width),
        top: Math.floor(player.y),
        bottom: Math.floor(player.y + player.height)
    };

    const { shape, x, y } = currentTetromino;
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
                const blockX = x + col;
                const blockY = y + row;

                if (blockX >= playerGrid.left && blockX < playerGrid.right &&
                    blockY >= playerGrid.top && blockY < playerGrid.bottom) {
                    
                    createParticles(
                        player.x * BLOCK_SIZE + (player.width * BLOCK_SIZE) / 2,
                        player.y * BLOCK_SIZE + (player.height * BLOCK_SIZE) / 2,
                        '#FF4136',
                        20
                    );
                    endGame();
                    return;
                }
            }
        }
    }
}

function updateUI() {
    if (scoreElement) scoreElement.textContent = score;
    if (levelElement) levelElement.textContent = level;
    if (linesElement) linesElement.textContent = lines;
    
    if (comboElement) {
        if (combo > 1) {
            comboElement.textContent = `콤보 x${combo}!`;
            comboElement.style.display = 'block';
        } else {
            comboElement.style.display = 'none';
        }
    }
}

function endGame() {
    if (gameOver) return;
    gameOver = true;
    
    if (finalScoreElement) finalScoreElement.textContent = score;
    if (finalLinesElement) finalLinesElement.textContent = lines;
    if (gameOverOverlay) gameOverOverlay.style.display = 'flex';
    
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function hardDrop() {
    if (!currentTetromino) return;
    
    while (!collide(currentTetromino)) {
        currentTetromino.y++;
        score += 2;
    }
    currentTetromino.y--;

    merge();
    
    checkCollisions();
    if (gameOver) return;

    const linesCleared = clearLines();
    if (linesCleared === 0) {
        combo = 0;
    }
    createTetromino();
    updateUI();
}

// 키보드 이벤트
document.addEventListener('keydown', (e) => {
    if (gameOver) return;
    
    keys[e.keyCode] = true;

    switch (e.keyCode) {
        case 37: // ←
            moveTetromino(-1);
            break;
        case 39: // →
            moveTetromino(1);
            break;
        case 40: // ↓
            dropTetromino();
            break;
        case 38: // ↑
            rotateTetromino();
            break;
        case 87: // W → 점프
            if (e.target === document.body) {
                e.preventDefault();
                playerJump();
            }
            break;
        case 32: // Space → 하드 드롭
            if (e.target === document.body) {
                e.preventDefault();
                hardDrop();
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.keyCode] = false;
});

// 전역 함수로 노출하여 HTML에서 호출 가능하게 함
window.resetGame = resetGame;

// 게임 시작
resetGame();