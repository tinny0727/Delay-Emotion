const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 1. 配置與常數 ---
const emotionMap = {
      "今天有點鼠...": "red","腦袋登出ing": "red","我好餓...": "red", "極度 厭世": "red", "腦袋空白": "red", "煩鼠了！": "red", "爆炸吧！": "red", "壓力好大": "red", "我好累！": "red", "想哭": "red",
   "我愛世界 世界愛我！": "yellow",  "衝鴨！": "yellow", "積極 向上": "yellow", "超有元氣": "yellow", "滿血復活～": "yellow", "有小確辛～": "yellow", "我好開勳": "yellow", "有好事 發生:D": "yellow",
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
// 在原本 let stats = ... 附近新增
let globalTotalDeleted = 0;
let scaleFactor = 1;
let gravityX = 0;
let gravityY = 0;

// 監測設備傾斜
window.addEventListener('deviceorientation', (event) => {
    // gamma 是左右傾斜 (-90 到 90)
    // beta 是前後傾斜 (-180 到 180)
    // 我們將這些數值轉換為微小的重力加速度
    gravityX = event.gamma * 0.05; 
    gravityY = event.beta * 0.05;
});

// 如果是 iOS 13+ 設備，需要請求權限
function requestGravityPermission() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    console.log("重力感應已啟用");
                }
            })
            .catch(console.error);
    }
}

// 在 handleAction 裡加入請求權限（點擊螢幕時觸發，因為 iOS 要求必須由用戶觸發）
// 找到你原本的 handleAction 函式，在開頭加入：
// requestGravityPermission();

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
        this.type = emotionMap[this.word] || "default";
        
        // 核心邏輯：紅球點兩次，其餘一次[cite: 2]
        this.hp = this.type === "red" ? 2 : 1; 
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
        const isMobile = window.innerWidth < 600;
        let baseRad = isMobile ? 55 : 100;
        if(this.shapeType === 3) baseRad *= 1.1;
        this.radius = baseRad * scaleFactor * this.sizeVar;
    }

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

        // 判斷變色：如果是黃綠球點擊中，或是紅球被打了一下[cite: 2]
        const isGlowing = this.isClicked || (this.type === "red" && this.hp === 1);

        if (isGlowing) {
            ctx.shadowBlur = 15 * scaleFactor;
            ctx.shadowColor = (this.type === "red") ? colors.red : colors[this.type];
            ctx.fillStyle = (this.type === "red") ? colors.red : colors[this.type];
        } else {
            ctx.fillStyle = colors.default;
        }

        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2.5;

        switch (this.shapeType) {
            case 0: ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
            case 1: 
                const side = this.radius * 1.7;
                this.drawRoundedRect(ctx, -side/2, -side/2, side, side, side * 0.25);
                ctx.fill(); ctx.stroke(); break;
            case 3: ctx.save(); this.drawCloud(ctx, this.radius); ctx.fill(); ctx.stroke(); ctx.restore(); break;
        }
        
        ctx.shadowBlur = 0;
        const fontSize = Math.floor(this.radius * (this.shapeType === 3 ? 0.28 : 0.3));
        ctx.fillStyle = isGlowing ? "#1a1a2e" : "white";
        ctx.font = `bold ${fontSize}px "Microsoft JhengHei", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const lines = this.word.split(' ');
        const lineHeight = fontSize * 1.25;
        const startY = -((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => {
            ctx.fillText(line, 0, startY + i * lineHeight - (this.shapeType === 3 ? this.radius * 0.05 : 0));
        });
        ctx.restore();
    }

    update() {
    // 1. 將環境重力加入速度 (緩慢增加，模擬重力感應)
    this.dx += gravityX * 0.2; 
    this.dy += gravityY * 0.2;

    // 2. 加入一點阻力 (Friction)，防止球越滾越快失控
    this.dx *= 0.98;
    this.dy *= 0.98;

    // 更新位置
    this.x += this.dx;
    this.y += this.dy;

    // --- 強力邊界偵測 (保持你之前的代碼) ---
    if (this.x - this.radius < 0) {
        this.x = this.radius;
        this.dx = Math.abs(this.dx) * 0.7; // 撞牆後損耗一點動能
    } else if (this.x + this.radius > window.innerWidth) {
        this.x = window.innerWidth - this.radius;
        this.dx = -Math.abs(this.dx) * 0.7;
    }

    if (this.y - this.radius < 0) {
        this.y = this.radius;
        this.dy = Math.abs(this.dy) * 0.7;
    } else if (this.y + this.radius > window.innerHeight) {
        this.y = window.innerHeight - this.radius;
        this.dy = -Math.abs(this.dy) * 0.7;
    }

    this.angle += this.rotationSpeed;
    this.draw();


    }
}

// --- 4. 粒子系統 ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = (Math.random() * 6 + 2) * scaleFactor;
        this.speedX = (Math.random() - 0.5) * 8 * scaleFactor;
        this.speedY = (Math.random() - 0.5) * 8 * scaleFactor;
        this.gravity = 0.06;
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.015;
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

// --- 5. 互動處理 ---
function updateDashboard() {
    ['red', 'green', 'yellow'].forEach(c => {
        const el = document.getElementById(`count-${c}`);
        if (el) el.innerText = stats[c];
    });
    
    // 新增：更新累積總數顯示
    const totalEl = document.getElementById('global-count');
    if (totalEl) totalEl.innerText = globalTotalDeleted;
}
const handleAction = (clientX, clientY) => {
    requestGravityPermission();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        if (Math.hypot(ball.x - mouseX, ball.y - mouseY) < ball.radius) {
            
            playPopSound();

            if (ball.type === "red") {
                // 紅球：扣 HP[cite: 2]
                ball.hp -= 1;
                const pColor = ball.hp === 1 ? colors.red : colors.red;
                for(let j=0; j<20; j++) particles.push(new Particle(ball.x, ball.y, pColor));

                if (ball.hp <= 0) {
                    stats.red++; 
                    globalTotalDeleted++;
                    updateDashboard();
                    balls.splice(i, 1); // 只有紅球 hp 歸零會消失
                }
            } else {
                // 黃綠球：點擊變色發光，不扣 HP，不消失[cite: 2]
                if (!ball.isClicked) {
                    ball.isClicked = true;
                    stats[ball.type]++;
                    updateDashboard();
                    for(let j=0; j<15; j++) particles.push(new Particle(ball.x, ball.y, colors[ball.type]));

                    // 5秒後變回灰色，可重複點擊
                    setTimeout(() => {
                        ball.isClicked = false;
                        if (stats[ball.type] > 0) stats[ball.type]--;
                        updateDashboard();
                    }, 10000);
                }
            }
            return; 
        }
    }
};

canvas.addEventListener('mousedown', (e) => handleAction(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); handleAction(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

// --- 6. 啟動 ---
function resolveCollisions() {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const b1 = balls[i];
            const b2 = balls[j];
            const dist = Math.hypot(b1.x - b2.x, b1.y - b2.y);
            const minDist = b1.radius + b2.radius;

            if (dist < minDist) {
                // 1. 防止重疊：將兩球推開，避免卡在一起
                const overlap = minDist - dist;
                const nx = (b1.x - b2.x) / dist; // 法向量 X
                const ny = (b1.y - b2.y) / dist; // 法向量 Y
                
                b1.x += nx * overlap / 2;
                b1.y += ny * overlap / 2;
                b2.x -= nx * overlap / 2;
                b2.y -= ny * overlap / 2;

                // 2. 彈開速度：簡單的動量交換
                const dotProduct = (b1.dx - b2.dx) * nx + (b1.dy - b2.dy) * ny;
                if (dotProduct < 0) { // 只有當球互相靠近時才反彈
                    b1.dx -= dotProduct * nx;
                    b1.dy -= dotProduct * ny;
                    b2.dx += dotProduct * nx;
                    b2.dy += dotProduct * ny;
                }
            }
        }
    }
}
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    
    // 新增這一行！讓球球互相排斥
    resolveCollisions(); 

    balls.forEach(ball => ball.update());
    balls.forEach(ball => ball.update());
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw();
        if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
    requestAnimationFrame(animate);
}

function init() {
    resize();
  
        Object.keys(emotionMap).forEach(word => {
            balls.push(new Ball({ word: word }));
        });
    }
    updateDashboard(); 
    animate();


init();

// 每 3 秒自動生成一個隨機壓力球
setInterval(() => {
    if (balls.length < 45) {
        const stressWords = ["壓力好大", "爆炸吧！", "煩鼠了！", "極度 厭世"];
        balls.push(new Ball({ word: stressWords[Math.floor(Math.random() * stressWords.length)] }));
    }
}, 3000);