// ==UserScript==
// @name         KRUNKER - Elite Mod
// @namespace    http://tampermonkey.net/
// @version      0.5.0
// @description  ESP + Aimbot + Chams + TriggerBot + NoRecoil + BunnyHop + HUD
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

const THREE = window.THREE;
delete window.THREE;

const settings = {
    aimbotEnabled: true,
    aimbotTarget: 'body',
    aimbotSmoothness: 0.5,
    aimFov: 45,
    aimbotOnRightMouse: false,
    espEnabled: false,
    wireframe: false,
    chams: false,
    chamsEnemy: 0xff00cc,
    chamsAlly: 0x00ff88,
    triggerBot: false,
    triggerThreshold: 6,
    recoilComp: false,
    recoilCompFactor: 0.7,
    autoBhop: false,
    showWatermark: true,
    panicMode: false
};

const SETTINGS_KEY = 'krunker_elite_settings';

function loadSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(key => {
                if (settings.hasOwnProperty(key) && typeof settings[key] === typeof parsed[key]) {
                    settings[key] = parsed[key];
                }
            });
        }
    } catch (e) {}
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
}

const aimbotTargets = ['body', 'nut', 'head'];

const keyToSetting = {
    KeyB: 'aimbotEnabled',
    KeyL: 'aimbotOnRightMouse',
    KeyM: 'espEnabled',
    KeyK: 'wireframe',
    KeyC: 'chams',
    KeyP: 'recoilComp',
    KeyJ: 'autoBhop',
    KeyV: 'triggerBot',
    KeyI: 'showWatermark'
};

let gui = createGUI();
let scene;

const x = {
    window: window,
    document: document,
    querySelector: document.querySelector,
    requestAnimationFrame: window.requestAnimationFrame,
    clearInterval: window.clearInterval,
    setTimeout: window.setTimeout
};

loadSettings();

const proxied = function (object) {
    try {
        if (typeof object === 'object' &&
            typeof object.parent === 'object' &&
            object.parent.type === 'Scene' &&
            object.parent.name === 'Main') {
            scene = object.parent;
        }
    } catch (error) {}
    return Array.prototype.push.apply(this, arguments);
}

const tempVector = new THREE.Vector3();
const tempObject = new THREE.Object3D();
tempObject.rotation.order = 'YXZ';

const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 15, 5).translate(0, 7.5, 0));

let injectTimer = null;
let rightMouseDown = false;
let watermarkEl = null;
let fps = 0;
let frameCount = 0;
let lastFpsTime = performance.now();

function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function getGameCanvas() {
    const cands = document.getElementsByTagName('canvas');
    for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        if (c.width > 50 && c.height > 50 && c.style.display !== 'none') return c;
    }
    return document.querySelector('canvas');
}

function triggerShot() {
    const cvs = getGameCanvas();
    const cx = Math.floor(window.innerWidth / 2);
    const cy = Math.floor(window.innerHeight / 2);
    if (cvs) {
        try {
            const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, buttons: 1, clientX: cx, clientY: cy });
            const up = new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, buttons: 0, clientX: cx, clientY: cy });
            cvs.dispatchEvent(down);
            setTimeout(() => cvs.dispatchEvent(up), 10);
        } catch (e) {}
    }
}

function createWatermark() {
    const wm = document.createElement('div');
    wm.className = 'watermark';
    wm.style.cssText = 'position: fixed; left: 10px; top: 10px; z-index: 999998; background: rgba(0,0,0,0.75); padding: 10px 14px; border-radius: 6px; font-family: monospace; color: #fff; font-size: 12px;';
    wm.innerHTML = `
        <div style="display: flex; align-items: center; margin: 2px 0;"><span style="color: #888; margin-right: 8px; min-width: 60px;">FPS:</span><span style="color: #00FFAA; font-weight: bold;" id="wm-fps">0</span></div>
        <div style="display: flex; align-items: center; margin: 2px 0;"><span style="color: #888; margin-right: 8px; min-width: 60px;">Players:</span><span style="color: #00FFAA; font-weight: bold;" id="wm-players">0</span></div>
        <div style="display: flex; align-items: center; margin: 2px 0;"><span style="color: #888; margin-right: 8px; min-width: 60px;">Status:</span><span style="color: #7CFFB2; font-weight: bold;" id="wm-status">ACTIVE</span></div>
    `;
    return wm;
}

function updateWatermark(playerCount) {
    if (!watermarkEl) return;
    try {
        frameCount++;
        const currentTime = performance.now();
        if (currentTime - lastFpsTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastFpsTime = currentTime;
        }
        const fpsEl = document.getElementById('wm-fps');
        const playersEl = document.getElementById('wm-players');
        if (fpsEl) fpsEl.textContent = fps || 0;
        if (playersEl) playersEl.textContent = playerCount || 0;
        watermarkEl.style.display = settings.showWatermark ? 'block' : 'none';
    } catch (e) {}
}

window.addEventListener('DOMContentLoaded', function () {
    gui.style.display = 'none';
    document.body.appendChild(gui);
    createGuiContent();
    watermarkEl = createWatermark();
    document.body.appendChild(watermarkEl);
});

window.addEventListener('pointerdown', function (e) { if (e.button === 2) rightMouseDown = true; });
window.addEventListener('pointerup', function (e) { if (e.button === 2) rightMouseDown = false; });

window.addEventListener('keyup', function (event) {
    if (document.activeElement && document.activeElement.value !== undefined) return;
    if (keyToSetting[event.code]) {
        toggleSetting(keyToSetting[event.code]);
        return;
    }
    if (event.code === 'KeyO') {
        toggleElementVisibility(gui);
    }
});

function toggleElementVisibility(el) {
    const isHidden = el.style.display === 'none' || getComputedStyle(el).display === 'none';
    if (isHidden) {
        if (el.classList.contains('zui')) {
            el.style.display = 'flex';
            el.classList.add('open');
        } else {
            el.style.display = 'block';
        }
    } else {
        el.style.display = 'none';
        if (el.classList.contains('zui')) el.classList.remove('open');
    }
}

function createGuiContent() {
    const content = gui.querySelector('.zui-content');
    content.innerHTML = '';
    Object.keys(settings).forEach(prop => {
        let name = fromCamel(prop);
        const item = document.createElement('div');
        item.className = 'zui-item';
        item.innerHTML = `<span>${name}</span><span class="zui-item-value" id="val_${prop}"></span>`;
        const valueEl = item.querySelector('.zui-item-value');
        const update = () => {
            const v = settings[prop];
            if (typeof v === 'boolean') { valueEl.innerText = v ? 'ON' : 'OFF'; valueEl.style.color = v ? '#7CFFB2' : '#FF8C8C'; }
            else { valueEl.innerText = v; }
        };
        if (typeof settings[prop] === 'boolean') {
            item.addEventListener('click', () => { settings[prop] = !settings[prop]; update(); saveSettings(); });
        }
        update();
        content.appendChild(item);
    });
}

function createGUI() {
    const guiEl = document.createElement('div');
    guiEl.className = 'zui';
    guiEl.style.cssText = 'position: fixed; right: 15px; top: 15px; z-index: 999999; display: flex; flex-direction: column; font-family: Arial, sans-serif; font-size: 14px; color: #fff; width: 320px; user-select: none; background: rgba(0,0,0,0.8); border-radius: 8px; overflow: hidden;';
    guiEl.innerHTML = `
        <div style="padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="font-weight: 700; color: #fff;">Control Panel [O]</span>
            <span class="zui-toggle-icon" style="transition: transform 0.25s ease; color:#ddd;">▼</span>
        </div>
        <div class="zui-content" style="max-height: 0; opacity: 0; overflow: hidden; transition: max-height 0.35s ease-out, opacity 0.25s ease-out;"></div>
    `;
    const headerEl = guiEl.querySelector('[style*="justify-content"]');
    headerEl.onclick = function () { guiEl.classList.toggle('open'); };
    return guiEl;
}

function fromCamel(text) {
    const result = text.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
}

function toggleSetting(key) {
    settings[key] = !settings[key];
    const elv = document.getElementById('val_' + key);
    if (elv) elv.innerText = (typeof settings[key] === 'boolean') ? (settings[key] ? 'ON' : 'OFF') : settings[key];
    saveSettings();
}

function animate() {
    requestAnimationFrame(animate);

    if (!scene && !injectTimer) {
        const el = document.querySelector('#loadingBg');
        if (el && el.style.display === 'none') {
            injectTimer = setTimeout(() => {
                Array.prototype.push = proxied;
            }, 2000);
        }
    }

    if (scene === undefined || !scene.children) return;

    const players = [];
    let myPlayer;

    for (let i = 0; i < scene.children.length; i++) {
        const child = scene.children[i];
        if (child.type === 'Object3D') {
            try {
                if (child.children[0].children[0].type === 'PerspectiveCamera') {
                    myPlayer = child;
                } else {
                    players.push(child);
                }
            } catch (err) {}
        }
    }

    if (!myPlayer) return;
    window.myPlayer = myPlayer;

    try {
        updateWatermark(players.length);
    } catch (e) {}

    if (!settings.aimbotEnabled || (settings.aimbotOnRightMouse && !rightMouseDown)) return;

    let targetPlayer;
    let minScreenDistance = Infinity;

    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        try {
            const camera = myPlayer.children[0].children[0];
            const screenPos = player.position.clone().project(camera);
            const screenX = (screenPos.x + 1) / 2 * window.innerWidth;
            const screenY = (1 - screenPos.y) / 2 * window.innerHeight;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const screenDist = Math.hypot(screenX - centerX, screenY - centerY);

            if (screenDist < settings.aimFov && screenDist < minScreenDistance) {
                targetPlayer = player;
                minScreenDistance = screenDist;
            }
        } catch (e) {}
    }

    if (!targetPlayer) return;

    const targetPosition = new THREE.Vector3();
    switch (settings.aimbotTarget) {
        case 'head':
            try { targetPlayer.children[0].children[0].localToWorld(targetPosition); } catch (e) { targetPosition.setFromMatrixPosition(targetPlayer.matrixWorld); }
            break;
        default:
            targetPosition.setFromMatrixPosition(targetPlayer.matrixWorld);
    }

    const camera = myPlayer.children[0].children[0];
    const projectedPos = targetPosition.clone().project(camera);

    if (projectedPos.z > 1) return;

    const screenX = (projectedPos.x + 1) / 2 * window.innerWidth;
    const screenY = (1 - projectedPos.y) / 2 * window.innerHeight;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const distance_from_center = Math.hypot(screenX - centerX, screenY - centerY);

    if (distance_from_center > settings.aimFov) return;

    tempObject.position.copy(myPlayer.position);
    tempObject.lookAt(targetPosition);

    const targetX = -tempObject.rotation.x;
    let targetY = tempObject.rotation.y + Math.PI;
    const currentY = myPlayer.rotation.y;
    let diff = targetY - currentY;

    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;

    const easedSmooth = easeOutCubic(settings.aimbotSmoothness);

    myPlayer.children[0].rotation.x = lerp(myPlayer.children[0].rotation.x, targetX, easedSmooth);
    myPlayer.rotation.y += diff * easedSmooth;

    if (settings.triggerBot && distance_from_center < settings.triggerThreshold) {
        triggerShot();
    }
}

animate();
