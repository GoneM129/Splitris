const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const comboElement = document.getElementById('combo');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreElement = document.getElementById('finalScore');
const finalLinesElement = document.getElementById('finalLines');

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
    player: '#FFC107', // 아기자기한 핑크빛
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
let nextTetromino;
let shadowTetromino;
let score;
let level;
let lines;
let combo;
let gameOver;
let animationId;
let keys = {};
let particles = [];

// 테트리스 블록 모양 (개선된 중심점 기반)
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
        this.vy += 0.2; // 중력
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
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    
    // 개선된 플레이어 물리
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
    
    score = 0;
    level = 1;
    lines = 0;
    combo = 0;
    particles = [];
    
    updateUI();
    gameOver = false;
    gameOverOverlay.style.display = 'none';
    
    createTetromino();
    createNextTetromino();
    
    if (animationId) cancelAnimationFrame(animationId);
    gameLoop();
}

function createTetromino() {
    if (nextTetromino) {
        currentTetromino = nextTetromino;
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
    
    createNextTetromino();
    updateShadow();
}

function createNextTetromino() {
    const shapes = Object.keys(TETROMINOES);
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    nextTetromino = {
        x: Math.floor(COLS / 2) - 1,
        y: 0,
        shape: TETROMINOES[shape],
        type: shape,
        color: COLORS[shape]
    };
    drawNextTetromino();
}

function drawNextTetromino() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    const shape = nextTetromino.shape;
    const blockSize = 20;
    const offsetX = (nextCanvas.width - shape[0].length * blockSize) / 2;
    const offsetY = (nextCanvas.height - shape.length * blockSize) / 2;
    
    shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(nextCtx, 
                    offsetX + x * blockSize, 
                    offsetY + y * blockSize, 
                    blockSize, 
                    nextTetromino.color, 
                    nextTetromino.type
                );
            }
        });
    });
}

function updateShadow() {
    shadowTetromino = { ...currentTetromino };
    while (!collide(shadowTetromino)) {
        shadowTetromino.y++;
    }
    shadowTetromino.y--;
}

let dropCounter = 0;
let dropInterval = 300;
let lastTime = 0;

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
    const dt = deltaTime / 1000; // 초 단위로 정규화

    const accel = 60;          // 좌우 가속도
    const maxSpeed = 6;        // 최대 속도
    const airControl = 0.5;    // 공중 이동 감쇠
    const decel = 40;          // 감속 속도

    const gravity = 30;        // 중력 가속도
    const terminalVelocity = 15;
    const jumpVelocity = -12;

    const isMovingLeft = keys[65];  // A
    const isMovingRight = keys[68]; // D

    const onGround = player.onGround;

    // 좌우 입력 처리
    if (isMovingLeft) {
        player.vx -= accel * dt * (onGround ? 1 : airControl);
    } else if (isMovingRight) {
        player.vx += accel * dt * (onGround ? 1 : airControl);
    } else {
        // 감속
        if (player.vx > 0) {
            player.vx = Math.max(0, player.vx - decel * dt);
        } else if (player.vx < 0) {
            player.vx = Math.min(0, player.vx + decel * dt);
        }
    }

    // 속도 제한
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
        // 바닥 충돌
        if (player.vy > 0) {
            player.onGround = true;
            player.coyoteTime = 0.1;
        } else {
            player.onGround = false;
        }
        player.vy = 0;
    }

    // 코요테 타임 감소
    if (player.coyoteTime > 0) {
        player.coyoteTime -= dt;
    }

    // 점프 버퍼 처리
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
        player.jumpBufferTime = 0.1; // 100ms 점프 버퍼
    }
}

function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function drawBlock(context, x, y, size, color, type) {
    // 그라데이션 효과
    if (GRADIENTS[type]) {
        const gradient = context.createLinearGradient(x, y, x + size, y + size);
        gradient.addColorStop(0, GRADIENTS[type][0]);
        gradient.addColorStop(1, GRADIENTS[type][1]);
        context.fillStyle = gradient;
    } else {
        context.fillStyle = color;
    }

    context.fillRect(x, y, size, size);
    
    // 테두리 효과
    context.strokeStyle = 'rgba(0,0,0,0.3)';
    context.lineWidth = 1;
    context.strokeRect(x, y, size, size);
    
    // 하이라이트 효과
    context.fillStyle = 'rgba(255,255,255,0.3)';
    context.fillRect(x + 1, y + 1, size - 2, 2);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function draw() {
    // 어두운 단색 배경
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
    drawTetromino(currentTetromino, currentTetromino.color);

    // 플레이어
    const px = player.x * BLOCK_SIZE;
    const py = player.y * BLOCK_SIZE;
    const pw = player.width * BLOCK_SIZE;
    const ph = player.height * BLOCK_SIZE;

    const playerGradient = ctx.createRadialGradient(
        px + pw / 2, py + ph / 2, 2,
        px + pw / 2, py + ph / 2, Math.max(pw, ph)
    );
    playerGradient.addColorStop(0, '#FFC107');
    playerGradient.addColorStop(1, '#FF6F3C');

    ctx.fillStyle = playerGradient;
    drawRoundedRect(ctx, px, py, pw, ph, 6);
    ctx.fill();

    ctx.strokeStyle = '#FFC107';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 파티클 그리기
    particles.forEach(particle => particle.draw(ctx));

    // 격자 그리기 (선택사항)
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
    tetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const blockX = (tetromino.x + x) * BLOCK_SIZE;
                const blockY = (tetromino.y + y) * BLOCK_SIZE;
                
                if (color === 'rgba(0,0,0,0.2)') {
                    // 그림자
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
    currentTetromino.x += dir;
    if (collide(currentTetromino)) {
        currentTetromino.x -= dir;
    } else {
        updateShadow();
    }
}

function rotateTetromino() {
    if (currentTetromino.type === 'O') return;

    const originalShape = currentTetromino.shape;
    const rotatedShape = rotate(originalShape);
    
    // SRS (Super Rotation System) 구현
    const kicks = getSRSKicks(currentTetromino.type, 0, 1); // 0에서 1로 회전
    
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

    // 🔥 merge 이후 충돌 체크
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
        // 화면 흔들림 효과 추가
        const container = document.querySelector('.game-container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 300);

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
    // 플레이어와 떨어지는 블록 충돌 체크
    const playerGrid = {
        left: Math.floor(player.x),
        right: Math.floor(player.x + player.width),
        top: Math.floor(player.y),
        bottom: Math.floor(player.y + player.height)
    };
    
    // 현재 테트리미노와 충돌 체크
    currentTetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const blockX = currentTetromino.x + x;
                const blockY = currentTetromino.y + y;
                
                if (blockX >= playerGrid.left && blockX <= playerGrid.right &&
                    blockY >= playerGrid.top && blockY <= playerGrid.bottom) {
                    // 충돌 시 파티클 생성 및 게임 오버
                    createParticles(
                        player.x * BLOCK_SIZE + (player.width * BLOCK_SIZE) / 2,
                        player.y * BLOCK_SIZE + (player.height * BLOCK_SIZE) / 2,
                        COLORS.player,
                        20
                    );
                    endGame();
                }
            }
        });
    });
}

function updateUI() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
    
    if (combo > 1) {
        comboElement.textContent = `콤보 x${combo}!`;
        comboElement.style.display = 'block';
    } else {
        comboElement.style.display = 'none';
    }
}

function endGame() {
    gameOver = true;
    finalScoreElement.textContent = score;
    finalLinesElement.textContent = lines;
    gameOverOverlay.style.display = 'flex';
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
}

function hardDrop() {
    while (!collide(currentTetromino)) {
        currentTetromino.y++;
        score += 2; // 하드 드롭 보너스
    }
    currentTetromino.y--;

    merge();
    
    // 🔥 플레이어와 충돌 확인
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


// 게임 시작
resetGame();