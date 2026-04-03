const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 1. 配置與常數 ---
const emotionMap = {
    "煩鼠了！": "red", "爆炸吧！": "red", "壓力好大": "red", "我好累 ！": "red", "想哭": "red",
    "超有元氣": "yellow", "滿血復活～": "yellow", "有小確辛～": "yellow", "我好開勳": "yellow", "有好事發生:D": "yellow",
    "還撐得住": "green", "心悶悶": "green", "腦袋空白中": "green", 
    "卡卡不順": "green", "我是鹹魚：D": "green", "今天不順：/": "green", "衝鴨！": "green", "想當廢廢XD": "green"
};

const colors = { 
    red: "#f46e6e", 
    green: "#24ef2e", // 修正：原代碼 green 對應的是黃色色碼，這裡調整回來
    yellow: "#ffd700", 
    default: "rgba(255, 255, 255, 0.15)" 
};

const decorativeImagesConfig = [
    "image/cat.png", 
    "image/dog.png", 
    "image/ret.png"
];

let balls = [];
let particles = [];
let decoSprites = [];
let loadedDecoImages = [];
let stats = { red: 0, green: 0, yellow: 0 };
let scaleFactor = 1; // 響應式縮放係數

// --- 2. 系統功能 ---
function playPopSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playBackgroundPiano() {
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
    setInterval(() => {
        if (audioCtx.state === 'suspended') return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const frequency = notes[Math.floor(Math.random() * notes.length)];
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 1.5); 
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 6);
    }, 4500);
}

function resize() {
    const scale = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 更新 Canvas 高度寬度
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // 計算縮放基準：以寬度 1000px 為基準 1
    scaleFactor = Math.min(width, height) / 1000;
    if (scaleFactor < 0.5) scaleFactor = 0.5; // 設定最小縮放限度，避免太小

    // 通知所有球體更新大小與位置
    balls.forEach(ball => {
        ball.recalculateSize();
        // 防止縮放時球體被卡在邊界外
        if (ball.x + ball.radius > width) ball.x = width - ball.radius;
        if (ball.y + ball.radius > height) ball.y = height - ball.radius;
        if (ball.x - ball.radius < 0) ball.x = ball.radius;
        if (ball.y - ball.radius < 0) ball.y = ball.radius;
    });
}
window.addEventListener('resize', resize);

// --- 3. 類別定義 ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = (Math.random() * 4 + 2) * scaleFactor;
        this.speedX = (Math.random() - 0.5) * 6 * scaleFactor;
        this.speedY = (Math.random() - 0.5) * 6 * scaleFactor;
        this.gravity = 0.05;
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.015; 
    }
    update() {
        this.speedY += this.gravity;
        this.x += this.speedX; this.y += this.speedY;
        this.alpha -= this.decay;
        if (this.size > 0.1) this.size -= 0.1; 
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class FloatingDeco {
    constructor(img) {
        this.img = img;
        this.sizeMultiplier = 100 + Math.random() * 100;
        this.recalculateSize();
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;
        this.dx = (Math.random() - 0.5) * 0.3;
        this.dy = (Math.random() - 0.5) * 0.3;
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.01;
    }
    recalculateSize() {
        const ratio = this.img.width / this.img.height;
        const currentBaseSize = this.sizeMultiplier * scaleFactor;
        if (ratio > 1) {
            this.width = currentBaseSize;
            this.height = currentBaseSize / ratio;
        } else {
            this.width = currentBaseSize * ratio;
            this.height = currentBaseSize;
        }
    }
    update() {
        if (this.x < 0 || this.x > window.innerWidth) this.dx *= -1;
        if (this.y < 0 || this.y > window.innerHeight) this.dy *= -1;
        this.x += this.dx;
        this.y += this.dy;
        this.angle += this.rotationSpeed;
        this.draw();
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = 0.2; 
        ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
}

class Ball {
    constructor(word) {
        this.word = word;
        this.type = emotionMap[word];
        this.isClicked = false;
        this.timer = null;
        this.sizeVar = 0.8 + Math.random() * 0.6; // 每顆球獨特的尺寸係數
        
        // 初始位置
        this.radius = 10; // 暫定，resize 會重新算
        this.recalculateSize();
        this.x = Math.random() * (window.innerWidth - this.radius * 2) + this.radius;
        this.y = Math.random() * (window.innerHeight - this.radius * 2) + this.radius;
        
        // 速度也隨縮放係數調整
        const speedBase = 1.5; 
        this.dx = (Math.random() - 0.5) * speedBase;
        this.dy = (Math.random() - 0.5) * speedBase;
    }
    recalculateSize() {
        // 基本半徑在桌面端約 70~120，手機端會自動等比縮小
        this.radius = 100 * scaleFactor * this.sizeVar;
        // 確保手機上字體不會小到看不見
        if (this.radius < 40) this.radius = 40;
    }
    reset() {
        if (this.isClicked) {
            this.isClicked = false;
            if (stats[this.type] > 0) stats[this.type]--;
            updateDashboard();
        }
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // 視覺發光效果
        if (this.isClicked) {
            ctx.shadowBlur = 20 * scaleFactor;
            ctx.shadowColor = colors[this.type];
        }

        ctx.fillStyle = this.isClicked ? colors[this.type] : colors.default;
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.fill(); 
        ctx.stroke();
        
        ctx.shadowBlur = 0; // 重置發光

        const fontSize = Math.floor(this.radius * 0.32);
        ctx.fillStyle = this.isClicked ? "#1a1a2e" : "white";
        ctx.font = `bold ${fontSize}px "Microsoft JhengHei", Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.word, this.x, this.y);
    }
    update() {
        if (this.x + this.radius > window.innerWidth) { this.x = window.innerWidth - this.radius; this.dx *= -1; }
        else if (this.x - this.radius < 0) { this.x = this.radius; this.dx *= -1; }
        if (this.y + this.radius > window.innerHeight) { this.y = window.innerHeight - this.radius; this.dy *= -1; }
        else if (this.y - this.radius < 0) { this.y = this.radius; this.dy *= -1; }
        this.x += this.dx; this.y += this.dy;
        this.draw();
    }
}

// --- 4. 物理與邏輯處理 ---
function resolveCollisions() {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const b1 = balls[i], b2 = balls[j];
            const dx = b2.x - b1.x, dy = b2.y - b1.y;
            const distance = Math.hypot(dx, dy);
            const minDistance = b1.radius + b2.radius;
            if (distance < minDistance) {
                const overlap = (minDistance - distance) + 0.1;
                const nx = dx / distance, ny = dy / distance;
                b1.x -= nx * overlap / 2; b1.y -= ny * overlap / 2;
                b2.x += nx * overlap / 2; b2.y += ny * overlap / 2;
                const vRelX = b1.dx - b2.dx, vRelY = b1.dy - b2.dy;
                const vAlongNormal = vRelX * nx + vRelY * ny;
                if (vAlongNormal > 0) {
                    b1.dx -= vAlongNormal * nx; b1.dy -= vAlongNormal * ny;
                    b2.dx += vAlongNormal * nx; b2.dy += vAlongNormal * ny;
                }
            }
        }
    }
}

function updateDashboard() {
    if (document.getElementById('count-red')) document.getElementById('count-red').innerText = stats.red;
    if (document.getElementById('count-green')) document.getElementById('count-green').innerText = stats.green;
    if (document.getElementById('count-yellow')) document.getElementById('count-yellow').innerText = stats.yellow;
}

// --- 5. 主迴圈與啟動 ---
function animate() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); 
    decoSprites.forEach(deco => deco.update());
    resolveCollisions();
    balls.forEach(ball => ball.update());
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw();
        if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
    requestAnimationFrame(animate);
}

// 支援點擊與觸控
const handleAction = (clientX, clientY) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    balls.forEach(ball => {
        if (!ball.isClicked) {
            if (Math.hypot(ball.x - mouseX, ball.y - mouseY) < ball.radius) {
                ball.isClicked = true;
                stats[ball.type]++; 
                updateDashboard(); 
                playPopSound();
                for(let i=0; i<15; i++) particles.push(new Particle(ball.x, ball.y, colors[ball.type]));
                if (ball.timer) clearTimeout(ball.timer);
                ball.timer = setTimeout(() => ball.reset(), 10000);
            }
        }
    });
};

canvas.addEventListener('mousedown', (e) => handleAction(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleAction(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        balls.forEach(ball => {
            if (ball.isClicked) {
                for(let i=0; i<8; i++) particles.push(new Particle(ball.x, ball.y, colors[ball.type]));
                if (ball.timer) clearTimeout(ball.timer);
                ball.isClicked = false;
            }
        });
        stats = { red: 0, green: 0, yellow: 0 };
        updateDashboard();
    });
}

async function init() {
    // 1. 初始化 Resize
    resize();
    
    // 2. 載入圖片
    const loadDeco = decorativeImagesConfig.map(src => new Promise(resolve => {
        const img = new Image(); img.src = src;
        img.onload = () => { loadedDecoImages.push(img); resolve(); };
        img.onerror = () => resolve();
    }));
    await Promise.all(loadDeco);
    
    // 3. 生成裝飾與球體
    for (let i = 0; i < 6; i++) {
        if (loadedDecoImages.length > 0) {
            decoSprites.push(new FloatingDeco(loadedDecoImages[Math.floor(Math.random() * loadedDecoImages.length)]));
        }
    }
    Object.keys(emotionMap).forEach(word => balls.push(new Ball(word)));
    
    // 4. 開始運行
    playBackgroundPiano(); 
    updateDashboard(); 
    animate();
}

init();