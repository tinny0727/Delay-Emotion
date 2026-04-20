const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 1. 配置與常數 ---
const emotionMap = {
   "我好餓...": "red", "極度 厭世": "red", "腦袋空白": "red", "煩鼠了！": "red", "爆炸吧！": "red", "壓力好大": "red", "我好累！": "red", "想哭": "red",
   "衝鴨！": "yellow", "積極 向上": "yellow", "超有元氣": "yellow", "滿血復活～": "yellow", "有小確辛～": "yellow", "我好開勳": "yellow", "有好事 發生:D": "yellow",
    "還撐得住": "green", "心悶悶": "green", "待機中...": "green",
    "卡卡不順": "green", "我是 鹹魚：D": "green", "今天不順：/": "green", "想當廢廢XD": "green"
};

const colors = {
    red: "#f43f3f",
    green: "#fff30e",
    yellow: "#00ff00",
    default: "rgba(253, 164, 10, 0.73)" // 橘黃半透明
};

// 裝飾圖片路徑 (選配，如果要貓咪狗狗圖片會轉動請填寫路徑)
const decorativeImagesConfig = [];

let balls = []; 
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
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    scaleFactor = Math.min(width, height) / 1000;
    if (width < 600) scaleFactor *= 1.2; 
    
    balls.forEach(ball => ball.recalculateSize());
}
window.addEventListener('resize', resize);

// --- 3. 類別定義 ---
class Ball {
    constructor(config) {
        this.isImage = !!config.img;
        this.word = config.word || "";
        this.img = config.img || null;
        this.type = emotionMap[this.word] || "default";
        this.isClicked = false;
        this.timer = null;
        this.sizeVar = 0.8 + Math.random() * 0.3;
        
        // 自轉屬性
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.012; 
        
        // --- 形狀機率設定 ---
        const shapeRoll = Math.random();
        if (shapeRoll < 0.5) {
            this.shapeType = 1; // 圓角矩形 (50%)
        } else if (shapeRoll < 0.75) {
            this.shapeType = 0; // 圓形 (25%)
        } else {
            this.shapeType = 3; // 圓潤雲朵 (25%)
        }

        if (this.isImage) this.aspectRatio = this.img.width / this.img.height;

        this.radius = 10;
        this.recalculateSize();
        
        // 全螢幕分佈
        this.x = Math.random() * (window.innerWidth - this.radius * 2) + this.radius;
        this.y = Math.random() * (window.innerHeight - this.radius * 2) + this.radius;
        
        this.dx = (Math.random() - 0.5) * 1.0;
        this.dy = (Math.random() - 0.5) * 1.0;
    }

    recalculateSize() {
        const isMobile = window.innerWidth < 600;
        if (this.isImage) {
            this.radius = (isMobile ? 45 : 80) * scaleFactor * this.sizeVar;
            if (this.aspectRatio > 1) { 
                this.drawWidth = this.radius * 2;
                this.drawHeight = this.drawWidth / this.aspectRatio;
            } else { 
                this.drawHeight = this.radius * 2;
                this.drawWidth = this.drawHeight * this.aspectRatio;
            }
        } else {
            // 文字球基礎尺寸
            let baseRad = isMobile ? 55 : 100;
            if(this.shapeType === 3) baseRad *= 1.1; // 雲朵稍微放大，內部空間才夠
            
            this.radius = baseRad * scaleFactor * this.sizeVar;
            const minLimit = isMobile ? 32 : 45;
            if (this.radius < minLimit) this.radius = minLimit;
        }
    }

    // --- 形狀繪製輔助函式 (邊緣修飾核心) ---
    
    // 1. 圓角矩形 (圓角正方) - 修飾為較大的圓角 radius
    drawRoundedRect(ctx, x, y, width, height, radius) {
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

    // 2. 圓潤雲朵 (Bezier Curve 修飾版本，邊緣乾淨不尖銳)
    drawCloud(ctx, r) {
        ctx.beginPath();
        // 將原點移動到雲朵中央偏下
        ctx.translate(0, r * 0.1); 
        
        // 使用三次貝茲曲線繪製六個圓弧，構成乾淨的雲朵
        ctx.moveTo(-r * 0.8, r * 0.2); 
        
        // 底部
        ctx.bezierCurveTo(-r * 1.1, r * 0.8, r * 1.1, r * 0.8, r * 0.8, r * 0.2);
        // 右側圓弧
        ctx.bezierCurveTo(r * 1.3, r * 0.1, r * 1.1, -r * 0.6, r * 0.6, -r * 0.5);
        // 頂部圓弧
        ctx.bezierCurveTo(r * 0.5, -r * 0.9, -r * 0.5, -r * 0.9, -r * 0.6, -r * 0.5);
        // 左側圓弧
        ctx.bezierCurveTo(-r * 1.1, -r * 0.6, -r * 1.3, r * 0.1, -r * 0.8, r * 0.2);

        ctx.closePath();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y); // 移動座標原點到球心
        
        if (this.isImage) {
            ctx.rotate(this.angle); // 圖片自轉
            ctx.globalAlpha = 0.8;
            ctx.drawImage(this.img, -this.drawWidth / 2, -this.drawHeight / 2, this.drawWidth, this.drawHeight);
        } else {
            // 形狀背景自轉
            ctx.rotate(this.angle); 

            if (this.isClicked) {
                ctx.shadowBlur = 15 * scaleFactor;
                ctx.shadowColor = colors[this.type];
            }
            ctx.fillStyle = this.isClicked ? colors[this.type] : colors.default;
            ctx.strokeStyle = "rgba(255,255,255,0.4)"; // 乾淨的白色邊框
            ctx.lineWidth = 2.5; // 稍微加粗邊框，更有質感

            // --- 繪製形狀 ---
            switch (this.shapeType) {
                case 0: // 圓形
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();
                    break;
                case 1: // 圓角正方 (使用 radius 的 1.6 倍作為正方形寬高)
                    const side = this.radius * 1.7;
                    // 使用半徑的 25% 作為圓角半徑，看起來更圓潤
                    this.drawRoundedRect(ctx, -side/2, -side/2, side, side, side * 0.25);
                    ctx.fill(); ctx.stroke();
                    break;
                case 3: // 圓潤雲朵 (內部有 save/restore 處理 translate)
                    ctx.save();
                    this.drawCloud(ctx, this.radius);
                    ctx.fill(); ctx.stroke();
                    ctx.restore();
                    break;
            }
            
            // --- 繪製文字 (文字保持水平，不跟著形狀轉，易讀性高) ---
            ctx.shadowBlur = 0;
            // 雲朵文字區塊需要稍微縮小字體
            let fontMult = 0.3;
            if(this.shapeType === 3) fontMult = 0.28;
            
            const fontSize = Math.floor(this.radius * fontMult);
            ctx.fillStyle = this.isClicked ? "#1a1a2e" : "white";
            ctx.font = `bold ${fontSize}px "Microsoft JhengHei", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // 文字分行處理 (利用空格)
            const lines = this.word.split(' ');
            const lineHeight = fontSize * 1.25;
            const startY = -((lines.length - 1) * lineHeight) / 2;
            lines.forEach((line, i) => {
                // 如果是雲朵，文字整體上移一點點
                let textY = startY + i * lineHeight;
                if(this.shapeType === 3) textY -= this.radius * 0.05;
                ctx.fillText(line, 0, textY);
            });
        }
        ctx.restore();
    }

    update() {
        if (this.x + this.radius > window.innerWidth) { this.x = window.innerWidth - this.radius; this.dx *= -1; }
        else if (this.x - this.radius < 0) { this.x = this.radius; this.dx *= -1; }
        if (this.y + this.radius > window.innerHeight) { this.y = window.innerHeight - this.radius; this.dy *= -1; }
        else if (this.y - this.radius < 0) { this.y = this.radius; this.dy *= -1; }
        
        this.x += this.dx; this.y += this.dy;
        this.angle += this.rotationSpeed; // 角度隨時間增加
        this.draw();
    }
}

// --- 4. 粒子與物理 (保持不變) ---
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

function resolveCollisions() {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const b1 = balls[i], b2 = balls[j];
            const dx = b2.x - b1.x, dy = b2.y - b1.y;
            const distance = Math.hypot(dx, dy);
            // 碰撞半徑稍微放大一點，減少複雜形狀重疊的感覺
            const minDistance = (b1.radius + b2.radius) * 1.02;
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

// --- 5. 主迴圈與啟動 ---
function updateDashboard() {
    if (document.getElementById('count-red')) document.getElementById('count-red').innerText = stats.red;
    if (document.getElementById('count-green')) document.getElementById('count-green').innerText = stats.green;
    if (document.getElementById('count-yellow')) document.getElementById('count-yellow').innerText = stats.yellow;
}

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
    
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        if (!ball.isImage && !ball.isClicked) {
            // 點擊檢測 (使用半徑，稍微縮小檢測區域以貼合雲朵和正方形)
            if (Math.hypot(ball.x - mouseX, ball.y - mouseY) < ball.radius * 0.95) {
                ball.isClicked = true;
                stats[ball.type]++; updateDashboard(); playPopSound();
                for(let j=0; j<15; j++) particles.push(new Particle(ball.x, ball.y, colors[ball.type]));
                setTimeout(() => {
                    ball.isClicked = false;
                    if (stats[ball.type] > 0) stats[ball.type]--;
                    updateDashboard();
                }, 10000);
                return; // 點擊一個就停止，防止穿透
            }
        }
    }
};

canvas.addEventListener('mousedown', (e) => handleAction(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); handleAction(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

async function init() {
    resize();
    const loadDeco = decorativeImagesConfig.map(src => new Promise(resolve => {
        const img = new Image(); img.src = src;
        img.onload = () => { loadedDecoImages.push(img); resolve(); };
        img.onerror = () => resolve();
    }));
    await Promise.all(loadDeco);
    
    // 加入圖片球保持 (保持 0 個，除非 decorativeImagesConfig 有東西)
    for (let i = 0; i < 8; i++) {
        if (loadedDecoImages.length > 0) {
            balls.push(new Ball({ img: loadedDecoImages[Math.floor(Math.random() * loadedDecoImages.length)] }));
        }
    }

    Object.keys(emotionMap).forEach(word => {
        balls.push(new Ball({ word: word }));
    });
    
    playBackgroundPiano(); updateDashboard(); animate();
}

init();