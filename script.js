const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 1. 配置與常數 ---
const emotionMap = {
   "極度厭世": "red", "腦袋空白": "red", "煩鼠了！": "red", "爆炸吧！": "red", "壓力好大": "red", "我好累 ！": "red", "想哭": "red",
    "積極向上": "yellow", "超有元氣": "yellow", "滿血復活～": "yellow", "有小確辛～": "yellow", "我好開勳": "yellow", "有好事發生:D": "yellow",
    "還撐得住": "green", "心悶悶": "green", "待機中。。。": "green",
    "卡卡不順": "green", "我是鹹魚：D": "green", "今天不順：/": "green", "想當廢廢XD": "green"
};

const colors = {
    red: "#fa7e7e",
    green: "#fff30e",
    yellow: "#00ff00",
    default: "rgba(253, 164, 10, 0.73)"
};

const decorativeImagesConfig = [
    "image/cat.png",
    "image/dog.png",
    "image/ret.png"
];

let balls = []; // 現在所有的東西（文字球、圖片球）都在這裡
let particles = [];
let loadedDecoImages = [];
let stats = { red: 0, green: 0, yellow: 0 };
let scaleFactor = 1;

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

    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    scaleFactor = Math.min(width, height) / 1000;
    if (scaleFactor < 0.5) scaleFactor = 0.5;

    balls.forEach(ball => {
        ball.recalculateSize();
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

class Ball {
    constructor(config) {
        this.isImage = !!config.img;
        this.word = config.word || "";
        this.img = config.img || null;
        this.type = emotionMap[this.word] || "default";
        
        this.isClicked = false;
        this.timer = null;
        this.sizeVar = 0.9 + Math.random() * 0.4;
        
        // 初始旋轉角度
        this.angle = Math.random() * Math.PI * 2;
        
        if (this.isImage) {
            this.aspectRatio = this.img.width / this.img.height;
        }

        this.radius = 10;
        this.recalculateSize();
        
        this.x = Math.random() * (window.innerWidth - this.radius * 2) + this.radius;
        this.y = Math.random() * (window.innerHeight - this.radius * 2) + this.radius;
        
        const speedBase = 1.1; 
        this.dx = (Math.random() - 0.5) * speedBase;
        this.dy = (Math.random() - 0.5) * speedBase;
    }
    recalculateSize() {
        if (this.isImage) {
            this.radius = 75 * scaleFactor * this.sizeVar;
            // 關鍵：根據 Aspect Ratio 計算繪製寬高，確保不變形
            // 我們將 radius 當作圖片「長邊」的一半
            if (this.aspectRatio > 1) { 
                // 橫向圖片 (寬 > 高)
                this.drawWidth = this.radius * 2;
                this.drawHeight = this.drawWidth / this.aspectRatio;
            } else { 
                // 直向圖片 (高 >= 寬)
                this.drawHeight = this.radius * 2;
                this.drawWidth = this.drawHeight * this.aspectRatio;
            }
        } else {
            // 文字球尺寸
            this.radius = 100 * scaleFactor * this.sizeVar;
            if (this.radius < 45) this.radius = 45;
        }
    }

    reset() {
        if (this.isClicked) {
            this.isClicked = false;
            if (stats[this.type] > 0) stats[this.type]--;
            updateDashboard();
        }
    }

    draw() {
        ctx.save();
        if (this.isImage) {
            // --- 繪製圖片球 ---
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.globalAlpha = 0.4; // 圖片半透明，不干擾文字
            const drawSize = this.radius * 2;
            ctx.drawImage(this.img, -this.drawWidth / 2, -this.drawHeight / 2, this.drawWidth, this.drawHeight);
        } else {
            // --- 繪製文字球 ---
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            
            if (this.isClicked) {
                ctx.shadowBlur = 20 * scaleFactor;
                ctx.shadowColor = colors[this.type];
            }
            ctx.fillStyle = this.isClicked ? colors[this.type] : colors.default;
            ctx.strokeStyle = "rgba(255,255,255,0.3)";
            ctx.lineWidth = 2;
            ctx.fill(); 
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            const fontSize = Math.floor(this.radius * 0.32);
            ctx.fillStyle = this.isClicked ? "#1a1a2e" : "white";
            ctx.font = `bold ${fontSize}px "Microsoft JhengHei", Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.word, this.x, this.y);
        }
        ctx.restore();
    }

    update() {
        if (this.x + this.radius > window.innerWidth) { this.x = window.innerWidth - this.radius; this.dx *= -1; }
        else if (this.x - this.radius < 0) { this.x = this.radius; this.dx *= -1; }
        if (this.y + this.radius > window.innerHeight) { this.y = window.innerHeight - this.radius; this.dy *= -1; }
        else if (this.y - this.radius < 0) { this.y = this.radius; this.dy *= -1; }
        
        this.x += this.dx; 
        this.y += this.dy;
        
        if (this.isImage) this.angle += this.rotationSpeed;
        
        this.draw();
    }
}

// --- 4. 物理處理 ---
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
    resolveCollisions();
    balls.forEach(ball => ball.update());
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw();
        if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
    requestAnimationFrame(animate);
}

const handleAction = (clientX, clientY) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    balls.forEach(ball => {
        // 只有「文字球」可以被點擊互動
        if (!ball.isImage && !ball.isClicked) {
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
            if (!ball.isImage && ball.isClicked) {
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
    resize();
    
    // 1. 載入圖片
    const loadDeco = decorativeImagesConfig.map(src => new Promise(resolve => {
        const img = new Image(); img.src = src;
        img.onload = () => { loadedDecoImages.push(img); resolve(); };
        img.onerror = () => resolve();
    }));
    await Promise.all(loadDeco);
    
    // 2. 加入圖片球 (現在會參與碰撞)
    for (let i = 0; i < 8; i++) {
        if (loadedDecoImages.length > 0) {
            balls.push(new Ball({
                img: loadedDecoImages[Math.floor(Math.random() * loadedDecoImages.length)]
            }));
        }
    }

    // 3. 加入文字球
    Object.keys(emotionMap).forEach(word => {
        balls.push(new Ball({ word: word }));
    });
    
    playBackgroundPiano(); 
    updateDashboard(); 
    animate();
}

init();