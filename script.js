const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 1. 配置與常數 ---
const emotionMap = {
    "人生好難：D": "red" , "我想碎覺": "red" , "今天 有點鼠...": "red", "腦袋登出ing": "red", "我好餓...": "red", "極度 厭世": "red", "腦袋空白": "red", "煩鼠了！": "red", "爆炸吧！": "red", "壓力好大": "red", "我好累！": "red", "想哭": "red",
    "我是 南波萬！": "yellow", "我愛世界 世界愛我！": "yellow", "衝鴨！": "yellow", "積極 向上": "yellow", "超有元氣": "yellow", "滿血 復活～": "yellow", "有小確辛～": "yellow", "我好開勳": "yellow", "有好事 發生:D": "yellow",
    "還撐得住": "green", "心悶悶": "green", "待機中...": "green",
    "卡卡不順": "green", "我是 鹹魚：D": "green", "今天不順：/": "green", "想當廢廢XD": "green"
};

const colors = {
    red: "#f43f3f",
    green: "#fff30e",
    yellow: "#00ff00",
    default: "rgba(142, 142, 142, 0.73)"
};

let balls = [];
let particles = [];
let stats = { red: 0, green: 0, yellow: 0 };
let globalTotalDeleted = 0;
let scaleFactor = 1;
let gravityX = 0;
let gravityY = 0;

// --- 2. 系統功能 ---
function handleOrientation(event) {
    gravityX = (event.gamma || 0) * 0.08;
    gravityY = (event.beta || 0) * 0.08;
}

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

function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    if (width < 600) {
        // 修正手機版大小：調降至 1.15 倍縮放[cite: 3]
        scaleFactor = (width / 375) * 1.15;
    } else {
        // 修正電腦版大小：調降分母至 850 讓球變大[cite: 3]
        scaleFactor = Math.min(width, height) / 850;
    }
    
    balls.forEach(ball => ball.recalculateSize());
}
window.addEventListener('resize', resize);

// --- 3. 類別定義 ---
class Ball {
    constructor(config) {
        this.word = config.word || "";
        this.type = emotionMap[this.word] || "default";
        // 修改：黃球與紅球一樣具備 2 點生命值[cite: 3]
        this.hp = (this.type === "red" || this.type === "yellow") ? 2 : 1;
        this.isClicked = false;
        this.sizeVar = 0.8 + Math.random() * 0.3;
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.012;

        const shapeRoll = Math.random();
        if (shapeRoll < 0.5) this.shapeType = 1; 
        else if (shapeRoll < 0.75) this.shapeType = 0; 
        else this.shapeType = 3; 

        this.radius = 10;
        this.recalculateSize();
        this.x = Math.random() * (window.innerWidth - this.radius * 2) + this.radius;
        this.y = Math.random() * (window.innerHeight - this.radius * 2) + this.radius;
        this.dx = (Math.random() - 0.5) * 1.2;
        this.dy = (Math.random() - 0.5) * 1.2;
    }

    recalculateSize() {
        // 將判斷寬度改為 768，讓平板更接近手機配置[cite: 3]
        const isMobile = window.innerWidth < 768;
        let baseRad = isMobile ? 38 : 65; 
        if (this.shapeType === 3) baseRad *= 1.1;
        this.radius = baseRad * scaleFactor * this.sizeVar;
    }

    drawCloud(ctx, r) {
        ctx.beginPath();
        ctx.translate(0, r * 0.1);
        ctx.moveTo(-r * 0.8, r * 0.2);
        ctx.bezierCurveTo(-r * 1.1, r * 0.8, r * 1.1, r * 0.8, r * 0.8, r * 0.2);
        ctx.bezierCurveTo(r * 1.3, r * 0.1, r * 1.1, -r * 0.6, r * 0.6, -r * 0.5);
        ctx.bezierCurveTo(r * 0.5, -r * 0.9, -r * 0.5, -r * 0.9, -r * 0.6, -r * 0.5);
        ctx.bezierCurveTo(-r * 1.1, -r * 0.6, -r * 1.3, r * 0.1, -r * 0.8, r * 0.2);
        ctx.closePath();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 修改：黃球受傷時也會發光[cite: 3]
        const isGlowing = this.isClicked || (this.hp === 1 && (this.type === "red" || this.type === "yellow"));
        
        if (isGlowing) {
            ctx.shadowBlur = 20 * scaleFactor;
            ctx.shadowColor = colors[this.type];
            ctx.fillStyle = colors[this.type];
        } else {
            ctx.fillStyle = colors.default;
        }

        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2.5;

        if (this.shapeType === 0) {
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (this.shapeType === 1) {
            const s = this.radius * 1.7;
            ctx.beginPath();
            ctx.roundRect(-s/2, -s/2, s, s, s * 0.2);
            ctx.fill(); ctx.stroke();
        } else {
            this.drawCloud(ctx, this.radius); ctx.fill(); ctx.stroke();
        }

        ctx.shadowBlur = 0;
        const fontSize = Math.floor(this.radius * 0.32);
        ctx.fillStyle = isGlowing ? "#1a1a2e" : "white";
        ctx.font = `bold ${fontSize}px "Microsoft JhengHei", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        const lines = this.word.split(" "); 
        const lineHeight = fontSize * 1.2;
        const startY = -((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, index) => {
            ctx.fillText(line, 0, startY + (index * lineHeight));
        });
        ctx.restore();
    }

   update() {
        if (this.type === "red" && this.hp === 2) {
            this.radius += 0.015 * scaleFactor; 
            const maxRad = (window.innerWidth < 600 ? 65 : 120) * scaleFactor;
            if (this.radius > maxRad) this.radius = maxRad;
        }

        this.dx += gravityX * 0.15;
        this.dy += gravityY * 0.15;
        this.dx *= 0.98;
        this.dy *= 0.98;
        this.x += this.dx;
        this.y += this.dy;

        if (this.x - this.radius < 0) { this.x = this.radius; this.dx = Math.abs(this.dx) * 0.7; }
        else if (this.x + this.radius > window.innerWidth) { this.x = window.innerWidth - this.radius; this.dx = -Math.abs(this.dx) * 0.7; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.dy = Math.abs(this.dy) * 0.7; }
        else if (this.y + this.radius > window.innerHeight) { this.y = window.innerHeight - this.radius; this.dy = -Math.abs(this.dy) * 0.7; }

        this.angle += this.rotationSpeed;
        this.draw();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = (Math.random() * 6 + 2) * scaleFactor;
        this.speedX = (Math.random() - 0.5) * 8 * scaleFactor;
        this.speedY = (Math.random() - 0.5) * 8 * scaleFactor;
        this.alpha = 1;
        this.decay = Math.random() * 0.01 + 0.01; // 讓粒子顏色慢一點消失[cite: 3]
    }
    update() {
        this.x += this.speedX; this.y += this.speedY;
        this.alpha -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

function resolveCollisions() {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const b1 = balls[i]; const b2 = balls[j];
            const dist = Math.hypot(b1.x - b2.x, b1.y - b2.y);
            const minDist = b1.radius + b2.radius;
            if (dist < minDist && dist > 0) {
                const overlap = minDist - dist;
                const nx = (b1.x - b2.x) / dist;
                const ny = (b1.y - b2.y) / dist;
                b1.x += nx * overlap / 2; b1.y += ny * overlap / 2;
                b2.x -= nx * overlap / 2; b2.y -= ny * overlap / 2;
                const dot = (b1.dx - b2.dx) * nx + (b1.dy - b2.dy) * ny;
                if (dot < 0) {
                    b1.dx -= dot * nx; b1.dy -= dot * ny;
                    b2.dx += dot * nx; b2.dy += dot * ny;
                }
            }
        }
    }
}

function updateDashboard() {
    ['red', 'green', 'yellow'].forEach(c => {
        const el = document.getElementById(`count-${c}`);
        if (el) el.innerText = stats[c];
    });
    const totalEl = document.getElementById('global-count');
    if (totalEl) totalEl.innerText = globalTotalDeleted;
}

const handleAction = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        if (Math.hypot(ball.x - mouseX, ball.y - mouseY) < ball.radius + 5) {
            playPopSound();
            // 修改：黃球與紅球現在都走「點兩下消失」邏輯[cite: 3]
            if (ball.type === "red" || ball.type === "green") {
                ball.hp -= 1;
                for(let j=0; j<15; j++) particles.push(new Particle(ball.x, ball.y, colors[ball.type]));
                if (ball.hp <= 0) {
                    stats[ball.type]++; globalTotalDeleted++;
                    balls.splice(i, 1);
                    updateDashboard();
                }
            } else if (!ball.isClicked) {
                // 綠球維持原本點亮 5 分鐘逻辑[cite: 3]
                ball.isClicked = true;
                stats[ball.type]++;
                updateDashboard();
                for(let j=0; j<10; j++) particles.push(new Particle(ball.x, ball.y, colors[ball.type]));
                setTimeout(() => {
                    ball.isClicked = false;
                    if (stats[ball.type] > 0) stats[ball.type]--;
                    updateDashboard();
                }, 300000);
            }
            return;
        }
    }
};

canvas.addEventListener('mousedown', (e) => handleAction(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); handleAction(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    resolveCollisions();
    balls.forEach(ball => ball.update());
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw();
        if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
    requestAnimationFrame(animate);
}

function init() {
    resize();
    balls = [];
    const keys = Object.keys(emotionMap);
    const isMobile = window.innerWidth < 600;
    const initialCount = isMobile ? 12 : keys.length;
    const shuffled = keys.sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < initialCount; i++) {
        balls.push(new Ball({ word: shuffled[i] }));
    }
    
    updateDashboard();
    animate();

    // 增生系統：確保球球會不斷長出來[cite: 3]
    setInterval(() => {
        const isMobile = window.innerWidth < 600;
        const maxBalls = isMobile ? 22 : 45; 
        if (balls.length < maxBalls) {
            const allWords = Object.keys(emotionMap);
            const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
            balls.push(new Ball({ word: randomWord }));
        }
    }, 3500); 
}

window.onload = () => {
    const startBtn = document.getElementById('start-btn');
    const startScreen = document.getElementById('start-screen');

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            if (typeof DeviceOrientationEvent !== 'undefined' && 
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const state = await DeviceOrientationEvent.requestPermission();
                    if (state === 'granted') window.addEventListener('deviceorientation', handleOrientation);
                } catch (e) { console.error(e); }
            } else {
                window.addEventListener('deviceorientation', handleOrientation);
            }
            init();
            if (startScreen) {
                startScreen.style.opacity = '0';
                setTimeout(() => { startScreen.style.display = 'none'; }, 500);
            }
        });
    }
};