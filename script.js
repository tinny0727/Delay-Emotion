// 1. 初始化資源與背景
const trashAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'); 

const oldContainer = document.getElementById('bg-glitter-container');
if (oldContainer) oldContainer.remove();

const bgContainer = document.createElement('div');
bgContainer.id = 'bg-glitter-container';
document.body.prepend(bgContainer);

// 產生閃爍背景
for (let i = 0; i < 50; i++) {
    const box = document.createElement('div');
    box.classList.add('glitter-box');
    const isWhite = Math.random() > 0.7;
    box.style.setProperty('--bg-color', isWhite ? 'rgb(250, 250, 250)' : 'rgba(59, 189, 45, 0.78)'); 
    const size = Math.random() * 15 + 5;
    Object.assign(box.style, {
        width: `${size}px`, height: `${size}px`,
        left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
        animation: `blink ${(Math.random() * 3 + 2).toFixed(2)}s infinite ease-in-out ${(Math.random() * -5).toFixed(2)}s`
    });
    bgContainer.appendChild(box);
}

// 2. 拖拽全域變數
let activeElement = null;
let offset = { x: 0, y: 0 };

// 3. 貼紙生成函式[cite: 4]
function createSticker(type) {
    const canvas = document.getElementById('sticker-canvas');
    const icons = { high: '分心.png', anxi: '焦慮.png', lopie: '內耗.png', avoid: '逃避.png', perfy: 'IP(1).png' };
    const content = icons[type] || type;

    const sticker = document.createElement('div');
    sticker.className = 'active-sticker';
    
    if (content.endsWith('.png') || content.endsWith('.jpg')) {
        const img = document.createElement('img');
        img.src = content;
        img.style.width = '55px'; 
        img.style.pointerEvents = 'none'; // 防止圖片阻擋拖拽點擊
        sticker.appendChild(img);
    } else {
        sticker.innerText = content;
        sticker.style.fontSize = '35px';
    }

    sticker.style.left = '100px';
    sticker.style.top = '100px';
    addDragListeners(sticker); // 讓貼紙可以被點擊拖動[cite: 4]
    canvas.appendChild(sticker);
}

function createTaskSticker() {
    const text = prompt("請輸入任務內容：");
    if (!text || text.trim() === "") return;

    const colorMap = { 'R': '#ff6b6b', 'B': '#4dabf7', 'Y': '#ffd43b', 'P': '#be4bdb', 'G': '#8ce99a' };
    let colorHint = "請選擇標籤顏色：\nR.紅色 B.藍色 Y.金色 P.紫色 G.嫩綠\n(直接輸入字母，留空則隨機)";
    const choice = (prompt(colorHint) || "").toUpperCase();
    const finalColor = colorMap[choice] || colorMap[Object.keys(colorMap)[Math.floor(Math.random() * 5)]];

    createTaskByType(text, finalColor);
}

function createTaskByType(typeText, color) {
    const canvas = document.getElementById('sticker-canvas');
    const sticker = document.createElement('div');
    sticker.className = 'active-sticker task-card';
    sticker.innerHTML = `<div class="sticker-text" contenteditable="true">${typeText}</div>`;
    sticker.style.borderLeft = `6px solid ${color}`;
    sticker.style.left = '50px';
    sticker.style.top = '50px';

    canvas.appendChild(sticker);
    addDragListeners(sticker);

    const textElement = sticker.querySelector('.sticker-text');
    textElement.addEventListener('mousedown', (e) => e.stopPropagation());
    textElement.addEventListener('touchstart', (e) => e.stopPropagation());
}

// 4. 核心拖拽與回收邏輯[cite: 4]
function addDragListeners(el) {
    el.addEventListener('mousedown', startDragging);
    el.addEventListener('touchstart', startDragging, { passive: false });
}

function startDragging(e) {
    if (e.target.contentEditable === "true") return;
    activeElement = e.currentTarget; 
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    const rect = activeElement.getBoundingClientRect();
    offset.x = clientX - rect.left;
    offset.y = clientY - rect.top;
    activeElement.style.zIndex = 1000;

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);
}

function drag(e) {
    if (!activeElement) return;
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    const canvasRect = document.getElementById('sticker-canvas').getBoundingClientRect();
    
    activeElement.style.left = (clientX - canvasRect.left - offset.x) + 'px';
    activeElement.style.top = (clientY - canvasRect.top - offset.y) + 'px';

    // 垃圾桶視覺反饋[cite: 4]
    const trashCan = document.getElementById('trash-can');
    const trashRect = trashCan.getBoundingClientRect();
    if (clientX > trashRect.left && clientX < trashRect.right && clientY > trashRect.top && clientY < trashRect.bottom) {
        trashCan.classList.add('hover');
    } else {
        trashCan.classList.remove('hover');
    }
}

function stopDragging(e) {
    if (!activeElement) return;
    const clientX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;

    activeElement.style.pointerEvents = 'none'; 
    const dropTarget = document.elementFromPoint(clientX, clientY);
    activeElement.style.pointerEvents = 'auto'; 

    const trashCan = dropTarget ? dropTarget.closest('#trash-can') : null;

    if (trashCan) {
        trashAudio.currentTime = 0;
        trashAudio.play().catch(() => {});
        activeElement.style.transition = 'all 0.2s ease';
        activeElement.style.transform = 'scale(0) rotate(20deg)';
        const target = activeElement;
        setTimeout(() => target.remove(), 200);
        trashCan.classList.remove('hover');
    } else {
        activeElement.style.zIndex = 100;
    }

    activeElement = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', stopDragging);
    document.removeEventListener('touchend', stopDragging);
}