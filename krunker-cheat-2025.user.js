// ==UserScript==
// @name         KRUNKER - Elite Mod (v0.7.0 - Full Edition)
// @namespace    http://tampermonkey.net/
// @version      0.7.0
// @description  Complete Krunker.io enhancement with advanced features
// @author       WeRhAt69
// @match        *://krunker.io/*
// @match        *://browserfps.com/*
// @exclude      *://krunker.io/social*
// @exclude      *://krunker.io/editor*
// @icon         https://www.google.com/s2/favicons?domain=krunker.io
// @grant        none
// @run-at       document-start
// @require      https://unpkg.com/three@0.150.0/build/three.min.js
// ==/UserScript==

'use strict';

const THREE = window.THREE;
delete window.THREE;

// ============= SETTINGS =============
const settings = {
    // Aimbot
    aimbotEnabled: true,
    aimbotTarget: 'body',
    aimbotSmoothness: 0.5,
    aimFov: 90,
    aimbotOnRightMouse: false,
    aimbotPredictor: true,
    aimbotHumanize: 0.3,
    
    // ESP
    espEnabled: false,
    espBoxes: false,
    espLines: false,
    espHealth: false,
    espDistance: false,
    espNames: false,
    espSkeletons: false,
    
    // Visuals
    wireframe: false,
    chams: false,
    chamsEnemy: 0xff00cc,
    chamsAlly: 0x00ff88,
    chamsFilled: true,
    
    // Assistance
    triggerBot: false,
    triggerThreshold: 8,
    triggerDelay: 10,
    recoilComp: false,
    recoilCompFactor: 0.7,
    noSpread: false,
    fasterReload: false,
    reloadSpeed: 0.8,
    autoBhop: false,
    bhopSpeed: 150,
    
    // Anti-Detection
    humanizeAim: true,
    randomDelay: 0.2,
    slowDownOnDetection: false,
    
    // UI
    showWatermark: true,
    darkMode: true,
    menuOpacity: 0.95
};

const SETTINGS_KEY = 'krunker_elite_v7';

// ============= UTILITIES =============
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function fromCamel(s) { return s.replace(/([A-Z])/g, ' $1').charAt(0).toUpperCase() + s.slice(1); }
function rand(min, max) { return Math.random() * (max - min) + min; }

function getGameCanvas() {
    const cands = document.getElementsByTagName('canvas');
    for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        if (c.width > 50 && c.height > 50 && c.style.display !== 'none') return c;
    }
    return document.querySelector('canvas');
}

function loadSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) Object.assign(settings, JSON.parse(saved));
    } catch (e) {}
}

function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}

// ============= STATE =============
let scene = null, myPlayer = null, watermarkEl = null, menuContainer = null;
let injectTimer = null, rightMouseDown = false, spaceHeld = false, bhopTimer = null;
let fps = 0, frameCount = 0, lastFpsTime = performance.now();
const tempObject = new THREE.Object3D();
tempObject.rotation.order = 'YXZ';

loadSettings();

// ============= SCENE DETECTION =============
const proxied = function (object) {
    try {
        if (object && object.parent && object.parent.type === 'Scene' && object.parent.name === 'Main') {
            scene = object.parent;
        }
    } catch (e) {}
    return Array.prototype.push.apply(this, arguments);
};

// ============= UI STYLES =============
const menuStyles = `
    .elite-menu-container {
        position: fixed; right: 15px; top: 15px; z-index: 999999;
        width: 450px; max-height: 600px; font-family: 'Segoe UI', Arial, sans-serif;
        background: rgba(15, 15, 20, 0.98); border: 2px solid #00ff88;
        border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(12px);
    }
    .elite-menu-header {
        background: linear-gradient(135deg, #00ff88 0%, #00b8ff 100%);
        color: #000; padding: 15px 20px; font-weight: 700; font-size: 16px;
        display: flex; justify-content: space-between; align-items: center;
        text-transform: uppercase; letter-spacing: 1px;
    }
    .elite-menu-tabs {
        display: flex; background: rgba(0,0,0,0.3); border-bottom: 2px solid #00ff88;
        overflow-x: auto;
    }
    .elite-tab {
        flex: 1; padding: 12px; text-align: center; cursor: pointer;
        color: #888; border-right: 1px solid rgba(255,255,255,0.1);
        transition: all 0.3s; font-weight: 600; font-size: 12px;
        text-transform: uppercase;
    }
    .elite-tab:hover { background: rgba(0,255,136,0.1); color: #00ff88; }
    .elite-tab.active { background: rgba(0,255,136,0.2); color: #00ff88; border-bottom: 3px solid #00ff88; }
    .elite-content {
        padding: 15px; max-height: 480px; overflow-y: auto; color: #ddd;
    }
    .elite-content::-webkit-scrollbar { width: 6px; }
    .elite-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    .elite-content::-webkit-scrollbar-thumb { background: #00ff88; border-radius: 3px; }
    .elite-setting {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px; margin: 5px 0; background: rgba(0,255,136,0.05);
        border-radius: 6px; border-left: 3px solid #00ff88;
        transition: all 0.2s;
    }
    .elite-setting:hover { background: rgba(0,255,136,0.12); transform: translateX(5px); }
    .elite-label { font-size: 13px; font-weight: 600; color: #fff; }
    .elite-value {
        background: rgba(0,255,136,0.2); color: #00ff88; padding: 5px 10px;
        border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer;
        border: 1px solid rgba(0,255,136,0.5);
    }
    .elite-slider {
        width: 100px; height: 5px; background: rgba(0,255,136,0.2); border-radius: 3px;
        cursor: pointer; border: 1px solid #00ff88;
    }
    .elite-close {
        background: none; border: none; color: #fff; font-size: 20px;
        cursor: pointer; transition: transform 0.2s;
    }
    .elite-close:hover { transform: rotate(90deg); }
    .elite-category-title {
        font-size: 12px; font-weight: 700; color: #00ff88; margin-top: 10px;
        margin-bottom: 8px; text-transform: uppercase; padding-bottom: 5px;
        border-bottom: 1px solid rgba(0,255,136,0.3);
    }
`;

// ============= WATERMARK =============
function createWatermark() {
    const wm = document.createElement('div');
    wm.style.cssText = `
        position: fixed; left: 10px; top: 10px; z-index: 999998;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(6px);
        padding: 12px 16px; border-radius: 8px; border: 2px solid #00ff88;
        font-family: 'Courier New', monospace; color: #00ff88; font-size: 12px; line-height: 1.6;
        font-weight: 700; text-shadow: 0 0 10px rgba(0,255,136,0.5);
    `;
    wm.innerHTML = `
        <div>⚡ KRUNKER ELITE v0.7.0</div>
        <div>FPS: <span id="wm-fps">0</span></div>
        <div>Players: <span id="wm-players">0</span></div>
        <div>Status: <span id="wm-status" style="color: #00ff88;">ACTIVE</span></div>
    `;
    return wm;
}

function updateWatermark(playerCount) {
    if (!watermarkEl) return;
    try {
        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastFpsTime = now;
        }
        const fpsEl = document.getElementById('wm-fps');
        const playersEl = document.getElementById('wm-players');
        if (fpsEl) fpsEl.textContent = fps;
        if (playersEl) playersEl.textContent = playerCount;
    } catch (e) {}
}

// ============= MENU SYSTEM =============
function createMenu() {
    const style = document.createElement('style');
    style.textContent = menuStyles;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.className = 'elite-menu-container';

    const categories = [
        {
            name: 'AIMBOT',
            icon: '🎯',
            items: ['aimbotEnabled', 'aimbotTarget', 'aimbotSmoothness', 'aimFov', 'aimbotOnRightMouse', 'aimbotPredictor', 'aimbotHumanize']
        },
        {
            name: 'ESP',
            icon: '👁️',
            items: ['espEnabled', 'espBoxes', 'espLines', 'espHealth', 'espDistance', 'espNames', 'espSkeletons']
        },
        {
            name: 'VISUALS',
            icon: '🎨',
            items: ['wireframe', 'chams', 'chamsFilled']
        },
        {
            name: 'ASSIST',
            icon: '⚙️',
            items: ['triggerBot', 'triggerThreshold', 'recoilComp', 'noSpread', 'fasterReload', 'autoBhop']
        },
        {
            name: 'SAFETY',
            icon: '🛡️',
            items: ['humanizeAim', 'randomDelay', 'slowDownOnDetection']
        },
        {
            name: 'CONFIG',
            icon: '⚡',
            items: ['showWatermark', 'darkMode', 'menuOpacity']
        }
    ];

    let html = `
        <div class="elite-menu-header">
            <span>🔥 ELITE MOD v0.7.0</span>
            <button class="elite-close" onclick="this.closest('.elite-menu-container').style.display='none';">×</button>
        </div>
        <div class="elite-menu-tabs">
    `;

    categories.forEach((cat, idx) => {
        html += `<div class="elite-tab ${idx === 0 ? 'active' : ''}" onclick="switchTab(${idx})">${cat.icon} ${cat.name}</div>`;
    });

    html += `</div><div class="elite-content" id="elite-content">`;

    categories.forEach((cat, idx) => {
        html += `<div id="tab-${idx}" style="display: ${idx === 0 ? 'block' : 'none'};`;
        cat.items.forEach(item => {
            const val = settings[item];
            const type = typeof val;
            html += `
                <div class="elite-setting">
                    <span class="elite-label">${fromCamel(item)}</span>
                    <span class="elite-value" onclick="toggleSetting('${item}')">${type === 'boolean' ? (val ? '✓ ON' : '✗ OFF') : val}</span>
                </div>
            `;
        });
        html += `</div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    return container;
}

window.switchTab = function(idx) {
    document.querySelectorAll('.elite-tab').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
    });
    document.querySelectorAll('.elite-content > div').forEach((el, i) => {
        el.style.display = i === idx ? 'block' : 'none';
    });
};

window.toggleSetting = function(key) {
    const val = settings[key];
    if (typeof val === 'boolean') settings[key] = !val;
    else if (typeof val === 'number') settings[key] += 0.1;
    
    saveSettings();
    const el = event.target;
    const type = typeof settings[key];
    el.textContent = type === 'boolean' ? (settings[key] ? '✓ ON' : '✗ OFF') : settings[key].toFixed(2);
};

// ============= INPUT HANDLING =============
window.addEventListener('DOMContentLoaded', () => {
    menuContainer = createMenu();
    document.body.appendChild(menuContainer);
    watermarkEl = createWatermark();
    document.body.appendChild(watermarkEl);
});

window.addEventListener('keydown', (e) => {
    // Right Shift öffnet/schließt das Menü
    if (e.shiftKey && e.location === 2) { // location 2 = Right Shift
        e.preventDefault();
        if (menuContainer) {
            menuContainer.style.display = menuContainer.style.display === 'none' ? 'block' : 'none';
        }
    }
    if (e.code === 'Space') spaceHeld = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceHeld = false;
});

window.addEventListener('pointerdown', (e) => { if (e.button === 2) rightMouseDown = true; });
window.addEventListener('pointerup', (e) => { if (e.button === 2) rightMouseDown = false; });

// ============= AIMBOT & GAME LOGIC =============
function triggerShot() {
    const cvs = getGameCanvas();
    if (!cvs) return;
    try {
        setTimeout(() => {
            const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
            const events = [
                new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, buttons: 1 }),
                new PointerEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy })
            ];
            cvs.dispatchEvent(events[0]);
            setTimeout(() => cvs.dispatchEvent(events[1]), settings.triggerDelay);
        }, rand(0, settings.randomDelay * 1000));
    } catch (e) {}
}

function animate() {
    requestAnimationFrame(animate);

    if (!scene) {
        const el = document.querySelector('#loadingBg');
        if (el && el.style.display === 'none' && !injectTimer) {
            injectTimer = setTimeout(() => { Array.prototype.push = proxied; }, 2000);
        }
        return;
    }

    const players = [];
    myPlayer = null;

    for (let child of scene.children) {
        if (child.type === 'Object3D' && child.children?.[0]?.children?.[0]?.type === 'PerspectiveCamera') {
            myPlayer = child;
        } else if (child.type === 'Object3D') {
            players.push(child);
        }
    }

    if (!myPlayer) return;
    updateWatermark(players.length);

    if (!settings.aimbotEnabled || (settings.aimbotOnRightMouse && !rightMouseDown)) return;

    let target = null, minDist = Infinity;
    const camera = myPlayer.children[0].children[0];

    for (let player of players) {
        try {
            const pos = player.position.clone().project(camera);
            const sx = (pos.x + 1) / 2 * window.innerWidth;
            const sy = (1 - pos.y) / 2 * window.innerHeight;
            const dist = Math.hypot(sx - window.innerWidth / 2, sy - window.innerHeight / 2);

            if (dist < settings.aimFov && dist < minDist) {
                target = player;
                minDist = dist;
            }
        } catch (e) {}
    }

    if (!target) return;

    const targetPos = new THREE.Vector3();
    targetPos.setFromMatrixPosition(target.matrixWorld);
    if (settings.aimbotTarget === 'head' && target.children?.[0]?.children?.[0]) {
        target.children[0].children[0].localToWorld(targetPos);
    }

    if (settings.aimbotPredictor && target.velocity) {
        targetPos.add(target.velocity.multiplyScalar(1.2));
    }

    tempObject.position.copy(myPlayer.position);
    tempObject.lookAt(targetPos);

    const humanize = settings.humanizeAim ? rand(-settings.aimbotHumanize, settings.aimbotHumanize) : 0;
    const smooth = easeOutCubic(settings.aimbotSmoothness + humanize);

    myPlayer.children[0].rotation.x = lerp(myPlayer.children[0].rotation.x, -tempObject.rotation.x, smooth);
    myPlayer.rotation.y += (tempObject.rotation.y + Math.PI - myPlayer.rotation.y) * smooth;

    if (settings.triggerBot && minDist < settings.triggerThreshold) {
        triggerShot();
    }
}

animate();
