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
let nextTetrominos = [];
let tetrominoBag = [];
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
    // 애니메이션 프레임 정리
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // 게임 상태 초기화
    gameOver = false;
    
    // 타이머 관련 변수 완전 초기화
    dropCounter = 0;
    lastTime = performance.now();
    timeInSamePos = 0;
    lastPlayerPos = { x: null, y: null };
    
    // 게임 데이터 초기화
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    currentTetromino = null;
    shadowTetromino = null;
    
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
    
    // 점수 및 레벨 초기화
    score = 0;
    level = 1;
    lines = 0;
    combo = 0;
    
    // 기타 게임 요소 초기화
    particles = [];
    nextTetrominos = [];
    tetrominoBag = [];
    
    // UI 초기화
    if (timerDisplay) {
        timerDisplay.textContent = '0.0s';
        timerDisplay.classList.remove('warning');
    }
    if (gameOverOverlay) {
        gameOverOverlay.style.display = 'none';
    }
    
    // 키 상태 초기화
    keys = {};
    
    // UI 업데이트
    updateUI();
    
    // 새로운 테트로미노 생성
    createTetromino();
    
    // 게임 루프 시작 (마지막 시간 초기화와 함께)
    requestAnimationFrame(gameLoop);
}

function fillTetrominoBag() {
    // tetrominoBag을 7개의 테트로미노 조각 이름으로 채우고 섞습니다.
    const shapes = Object.keys(TETROMINOES);
    // Fisher-Yates (aka Knuth) Shuffle
    for (let i = shapes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
    }
    tetrominoBag = shapes;
}

function createTetromino() {
    // 다음 조각 큐가 충분히 채워져 있는지 확인합니다.
    while (nextTetrominos.length < 5) { // 현재 조각 + 4개 미리보기
        if (tetrominoBag.length === 0) {
            fillTetrominoBag(); // 가방이 비었으면 다시 채웁니다.
        }
        const shapeType = tetrominoBag.pop(); // 가방에서 조각 유형을 가져옵니다.
        const nextTetromino = {
            x: Math.floor(COLS / 2) - 1,
            y: 0,
            shape: TETROMINOES[shapeType],
            type: shapeType,
            color: COLORS[shapeType]
        };
        nextTetrominos.push(nextTetromino);
    }

    currentTetromino = nextTetrominos.shift(); // 큐에서 다음 조각을 가져와 현재 조각으로 설정합니다.

    // 게임 오버 체크
    if (collide(currentTetromino)) {
        endGame();
        return;
    }

    drawNextTetrominos();
    updateShadow();
}

// createNextTetromino 함수는 이제 createTetromino 로직에 통합되었으므로
// 이 함수는 더 이상 필요하지 않습니다.
function createNextTetromino() {
    // 비워 둡니다.
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

    // 10초 타이머 로직
    const currentPlayerGridX = Math.floor(player.x);
    const currentPlayerGridY = Math.floor(player.y);

    if (currentPlayerGridX === lastPlayerPos.x && currentPlayerGridY === lastPlayerPos.y) {
        timeInSamePos += deltaTime;
        if (timeInSamePos > 10000) { // 10초
            endGame();
        }
    } else {
        timeInSamePos = 0;
        lastPlayerPos.x = currentPlayerGridX;
        lastPlayerPos.y = currentPlayerGridY;
    }

    // 타이머 UI 업데이트
    timerDisplay.textContent = (timeInSamePos / 1000).toFixed(1) + 's';
    if (timeInSamePos > 7000) {
        timerDisplay.classList.add('warning');
    } else {
        timerDisplay.classList.remove('warning');
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

    // 눈에 띄는 새로운 디자인: 밝은 네온 효과
    const centerX = px + pw / 2;
    const centerY = py + ph / 2;

    // 외부 글로우
    ctx.shadowColor = '#FF4136'; // 붉은색 네온
    ctx.shadowBlur = 15;
    
    // 내부 색상
    ctx.fillStyle = '#FF4136'; // 붉은색 네온
    ctx.fillRect(px, py, pw, ph);

    // 내부 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(px + pw * 0.15, py + ph * 0.15, pw * 0.7, ph * 0.7);

    // 그림자 리셋
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

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
    if (!currentTetromino) return; // 현재 블록이 없으면 검사 중단

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
                        '#FF4136', // 플레이어 색상과 맞춤
                        20
                    );
                    endGame();
                    return; // 충돌 발견 시 즉시 함수 종료
                }
            }
        }
    }
}

function updateUI() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
    
    if (combo > 1) {
        comboElement.textContent = `COMBO x${combo}!`;
        comboElement.style.display = 'block';
    } else {
        comboElement.style.display = 'none';
    }
}

function endGame() {
    if (gameOver) return;
    gameOver = true;
    
    // UI 업데이트
    if (finalScoreElement) finalScoreElement.textContent = score;
    if (finalLinesElement) finalLinesElement.textContent = lines;
    if (gameOverOverlay) gameOverOverlay.style.display = 'flex';
    
    // 애니메이션 정리
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;  // animationId 명시적으로 null로 설정
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