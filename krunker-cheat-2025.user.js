// ==UserScript==
// @name         KRUNKER - Elite Mod (v1.0.0 - Full Edition)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Complete Krunker.io enhancement with advanced features - VAPE-style UI
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

// Store THREE reference before it gets cleaned up
const THREE = window.THREE;

// ============= SETTINGS =============
const DEFAULT_SETTINGS = {
  // AIMBOT
  aimbot_enabled: true,
  aimbot_target: 'body', // body, head
  aimbot_smoothness: 0.15,
  aimbot_fov: 180,
  aimbot_predict: true,
  aimbot_humanize: 0.2,
  aimbot_hold_right_click: false,

  // ESP
  esp_enabled: false,
  esp_boxes: false,
  esp_lines: false,
  esp_health: false,
  esp_distance: false,
  esp_names: false,
  esp_skeletons: false,

  // CHAMS
  chams_enabled: false,
  chams_fill: true,
  chams_enemy_color: '#ff3366',
  chams_ally_color: '#00ff88',
  chams_opacity: 0.6,

  // VISUALS
  wireframe_enabled: false,
  remove_fog: false,

  // ASSISTANCE
  trigger_bot: false,
  trigger_threshold: 8,
  trigger_delay: 10,
  recoil_compensation: false,
  recoil_factor: 0.7,
  no_spread: false,
  faster_reload: false,
  reload_speed: 0.8,
  auto_bhop: false,
  bhop_speed: 150,

  // MISC
  humanize_aim: true,
  random_delay: 0.2,
  show_watermark: true,
  menu_opacity: 0.95,
  menu_position: 'right' // right, left
};

const SETTINGS_KEY = 'krunker_elite_v1';
let settings = { ...DEFAULT_SETTINGS };

// Load saved settings
function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) settings = { ...settings, ...JSON.parse(saved) };
  } catch (e) {
    console.warn('[Elite] Settings load error:', e.message);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[Elite] Settings save error:', e.message);
  }
}

loadSettings();

// ============= UTILITIES =============
function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function rand(min, max) { return Math.random() * (max - min) + min; }

function getGameCanvas() {
  const cands = document.querySelectorAll('canvas');
  for (let c of cands) {
    if (c.width > 50 && c.height > 50 && c.style.display !== 'none') return c;
  }
  return null;
}

function humanizeValue(name, value) {
  const human = {
    'aimbot_enabled': 'Aimbot',
    'aimbot_target': 'Target',
    'aimbot_smoothness': 'Smoothness',
    'aimbot_fov': 'FOV',
    'aimbot_predict': 'Prediction',
    'aimbot_humanize': 'Humanize',
    'aimbot_hold_right_click': 'Hold Right Click',
    'esp_enabled': 'ESP',
    'esp_boxes': 'Boxes',
    'esp_lines': 'Lines',
    'esp_health': 'Health',
    'esp_distance': 'Distance',
    'esp_names': 'Names',
    'esp_skeletons': 'Skeletons',
    'chams_enabled': 'Chams',
    'chams_fill': 'Fill',
    'chams_opacity': 'Opacity',
    'trigger_bot': 'Trigger Bot',
    'trigger_threshold': 'Threshold',
    'recoil_compensation': 'Recoil Comp',
    'no_spread': 'No Spread',
    'auto_bhop': 'Auto Bhop',
    'humanize_aim': 'Humanize',
  };
  return human[name] || name.replace(/_/g, ' ').toUpperCase();
}

function settingToSection(name) {
  if (name.startsWith('aimbot_')) return 'Combat';
  if (name.startsWith('esp_')) return 'Visual';
  if (name.startsWith('chams_')) return 'Visual';
  if (name.startsWith('trigger_') || name.startsWith('recoil_') || name.startsWith('no_') || name.startsWith('auto_')) return 'Utility';
  return 'Settings';
}

// ============= MENU UI =============
const MENU_STYLES = `
  .elite-sidebar {
    position: fixed; left: 20px; top: 20px; z-index: 999998;
    width: 100px; height: auto; background: rgba(15, 15, 20, 0.95);
    border: 1px solid rgba(0, 102, 255, 0.3); border-radius: 12px;
    padding: 20px 0; backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .elite-sidebar-icon {
    width: 60px; height: 60px; margin: 0 auto 15px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border-radius: 8px; transition: all 0.2s;
    color: rgba(255, 255, 255, 0.6); font-size: 24px;
  }

  .elite-sidebar-icon:hover {
    background: rgba(0, 102, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
  }

  .elite-sidebar-icon.active {
    background: rgba(0, 102, 255, 0.3);
    color: #0066ff;
    border: 1px solid #0066ff;
  }

  .elite-main {
    position: fixed; right: 20px; top: 20px; z-index: 999999;
    width: 500px; max-height: 800px; background: rgba(15, 15, 20, 0.98);
    border: 1px solid rgba(0, 102, 255, 0.3); border-radius: 12px;
    overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(12px);
    display: none;
  }

  .elite-main.open { display: flex; flex-direction: column; }

  .elite-header {
    background: linear-gradient(135deg, #0066ff 0%, #0044aa 100%);
    color: #fff; padding: 20px; font-weight: 700; font-size: 16px;
    display: flex; justify-content: space-between; align-items: center;
    text-transform: uppercase; letter-spacing: 1px;
  }

  .elite-close-btn {
    background: none; border: none; color: #fff; font-size: 24px;
    cursor: pointer; transition: transform 0.2s; padding: 0; width: 30px; height: 30px;
  }

  .elite-close-btn:hover { transform: rotate(90deg); }

  .elite-content {
    flex: 1; padding: 20px; overflow-y: auto; color: #ddd;
  }

  .elite-content::-webkit-scrollbar { width: 6px; }
  .elite-content::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
  .elite-content::-webkit-scrollbar-thumb { background: #0066ff; border-radius: 3px; }

  .elite-feature-card {
    background: rgba(0, 102, 255, 0.08); border: 1px solid rgba(0, 102, 255, 0.2);
    border-radius: 8px; padding: 15px; margin-bottom: 12px;
    transition: all 0.2s; cursor: pointer; display: flex;
    align-items: center; justify-content: space-between;
  }

  .elite-feature-card:hover {
    background: rgba(0, 102, 255, 0.15); border-color: rgba(0, 102, 255, 0.4);
    transform: translateX(5px);
  }

  .elite-feature-card.active {
    background: rgba(0, 102, 255, 0.25); border-color: #0066ff;
  }

  .elite-feature-info {
    display: flex; align-items: center; gap: 12px; flex: 1;
  }

  .elite-feature-icon {
    font-size: 20px; width: 30px; text-align: center;
  }

  .elite-feature-text {
    display: flex; flex-direction: column;
  }

  .elite-feature-name {
    font-weight: 600; color: #fff; font-size: 14px;
  }

  .elite-feature-desc {
    font-size: 11px; color: rgba(255, 255, 255, 0.5);
  }

  .elite-toggle {
    width: 50px; height: 28px; background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 102, 255, 0.3); border-radius: 14px;
    position: relative; cursor: pointer; transition: all 0.3s;
  }

  .elite-toggle.on {
    background: #0066ff; border-color: #0066ff;
  }

  .elite-toggle::after {
    content: ''; position: absolute; width: 24px; height: 24px;
    background: #fff; border-radius: 50%; top: 2px; left: 2px;
    transition: all 0.3s;
  }

  .elite-toggle.on::after { left: 24px; }

  .elite-menu-more {
    background: none; border: none; color: #888; font-size: 18px;
    cursor: pointer; padding: 5px; transition: all 0.2s; margin-left: 10px;
  }

  .elite-menu-more:hover { color: #0066ff; }

  .elite-section-title {
    font-size: 13px; font-weight: 700; color: #0066ff; margin-top: 15px;
    margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;
    padding-bottom: 8px; border-bottom: 1px solid rgba(0, 102, 255, 0.2);
  }

  .elite-slider-group {
    display: flex; align-items: center; gap: 10px; padding: 10px;
    background: rgba(0, 102, 255, 0.05); border-radius: 6px; margin-bottom: 10px;
  }

  .elite-slider {
    flex: 1; height: 6px; background: rgba(0, 102, 255, 0.2);
    border-radius: 3px; -webkit-appearance: none; appearance: none;
    cursor: pointer; border: 1px solid rgba(0, 102, 255, 0.3);
  }

  .elite-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 16px; height: 16px;
    background: #0066ff; border-radius: 50%; cursor: pointer; border: 2px solid #fff;
  }

  .elite-slider::-moz-range-thumb {
    width: 16px; height: 16px; background: #0066ff; border-radius: 50%;
    cursor: pointer; border: 2px solid #fff;
  }

  .elite-slider-value {
    color: #0066ff; font-weight: 700; font-size: 12px; min-width: 40px;
  }

  .elite-watermark {
    position: fixed; left: 15px; bottom: 20px; z-index: 999997;
    background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(6px);
    padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(0, 102, 255, 0.3);
    font-family: 'Courier New', monospace; color: #0066ff; font-size: 11px;
    line-height: 1.6; font-weight: 700; text-shadow: 0 0 10px rgba(0, 102, 255, 0.3);
  }

  .elite-status { color: #00ff88; }
  .elite-status.inactive { color: #ff3366; }

  @media (max-width: 1400px) {
    .elite-main { width: 420px; }
  }
  @media (max-width: 1000px) {
    .elite-sidebar { left: 10px; }
    .elite-main { right: 10px; width: 380px; }
  }
`;

// ============= STATE =============
let scene = null;
let myPlayer = null;
let watermarkEl = null;
let menuEl = null;
let sidebarEl = null;
let currentSection = 'Combat';
let rightMouseDown = false;
let spaceHeld = false;
let fps = 0;
let frameCount = 0;
let lastFpsTime = performance.now();

const tempObject = new THREE.Object3D();
tempObject.rotation.order = 'YXZ';

// ============= SCENE DETECTION =============
function setupSceneDetection() {
  const originalPush = Array.prototype.push;

  // Intercept scene children safely
  Object.defineProperty(Array.prototype, 'push', {
    value: function(...args) {
      try {
        if (this.length === 0 && args[0] && args[0].type === 'Object3D') {
          // Likely scene.children
          for (let obj of args) {
            if (obj.parent?.type === 'Scene' && obj.parent.name === 'Main') {
              scene = obj.parent;
              break;
            }
          }
        }
      } catch (e) {
        // Silently ignore
      }
      return originalPush.apply(this, args);
    },
    writable: true,
    configurable: true
  });
}

setTimeout(setupSceneDetection, 1000);

// ============= UI CREATION =============
function createSidebar() {
  const div = document.createElement('div');
  div.className = 'elite-sidebar';

  const sections = [
    { name: 'Home', icon: '⚡', key: 'home' },
    { name: 'Combat', icon: '🎯', key: 'combat' },
    { name: 'Visual', icon: '👁️', key: 'visual' },
    { name: 'Utility', icon: '⚙️', key: 'utility' },
    { name: 'Settings', icon: '⚙️', key: 'settings' },
    { name: 'About', icon: 'ℹ️', key: 'about' }
  ];

  sections.forEach(sec => {
    const icon = document.createElement('div');
    icon.className = 'elite-sidebar-icon';
    icon.textContent = sec.icon;
    icon.title = sec.name;
    icon.onclick = () => selectSection(sec.name, icon);
    div.appendChild(icon);
  });

  return div;
}

function createMainMenu() {
  const div = document.createElement('div');
  div.className = 'elite-main';

  const header = document.createElement('div');
  header.className = 'elite-header';
  header.innerHTML = '<span>🔥 ELITE MOD v1.0.0</span>';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'elite-close-btn';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => div.classList.remove('open');
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'elite-content';
  content.id = 'elite-content';

  div.appendChild(header);
  div.appendChild(content);

  return div;
}

function updateMenuContent() {
  const content = document.getElementById('elite-content');
  if (!content) return;

  let html = '';

  if (currentSection === 'Home') {
    html = `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 48px; margin-bottom: 20px;">🔥</div>
        <div style="font-size: 18px; font-weight: 700; color: #0066ff; margin-bottom: 10px;">KRUNKER ELITE</div>
        <div style="font-size: 12px; color: #888; margin-bottom: 20px;">v1.0.0 - Full Edition</div>
        <div style="text-align: left; font-size: 11px; color: #aaa; line-height: 1.8;">
          <div style="margin-bottom: 10px;"><strong>Features:</strong></div>
          <div>✓ Advanced Aimbot</div>
          <div>✓ ESP System</div>
          <div>✓ Chams & Visuals</div>
          <div>✓ Trigger Bot</div>
          <div>✓ Auto Bhop</div>
          <div style="margin-top: 15px;"><strong>Status:</strong> Active</div>
        </div>
      </div>
    `;
  } else if (currentSection === 'About') {
    html = `
      <div style="padding: 20px 0; text-align: center;">
        <div style="font-size: 12px; color: #888; line-height: 2;">
          <div><strong>KRUNKER ELITE MOD</strong></div>
          <div>v1.0.0 - Full Edition</div>
          <div style="margin-top: 15px; font-size: 11px;">Advanced enhancement suite</div>
          <div>for Krunker.io</div>
          <div style="margin-top: 15px; border-top: 1px solid rgba(0, 102, 255, 0.2); padding-top: 15px;">
            <div>Author: WeRhAt69</div>
            <div style="margin-top: 10px; color: #0066ff;">Right Shift = Toggle Menu</div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Show features by section
    const sectionMap = {
      'Combat': ['aimbot_enabled', 'aimbot_target', 'aimbot_smoothness', 'aimbot_fov', 'aimbot_predict', 'aimbot_humanize', 'trigger_bot', 'trigger_threshold', 'recoil_compensation'],
      'Visual': ['esp_enabled', 'esp_boxes', 'esp_lines', 'esp_health', 'esp_distance', 'esp_names', 'chams_enabled', 'chams_fill', 'chams_opacity', 'wireframe_enabled'],
      'Utility': ['auto_bhop', 'no_spread', 'faster_reload', 'humanize_aim'],
      'Settings': ['show_watermark', 'menu_opacity', 'menu_position']
    };

    const keys = sectionMap[currentSection] || [];
    const icons = {
      'aimbot_enabled': '🎯', 'aimbot_target': '👁️', 'aimbot_smoothness': '📊', 'aimbot_fov': '🔍',
      'trigger_bot': '🔫', 'trigger_threshold': '📍', 'recoil_compensation': '🎚️',
      'esp_enabled': '👁️', 'esp_boxes': '📦', 'esp_lines': '📍', 'esp_health': '❤️',
      'chams_enabled': '🎨', 'chams_fill': '💧', 'chams_opacity': '🌫️',
      'auto_bhop': '🦘', 'no_spread': '📌', 'faster_reload': '⚡',
      'wireframe_enabled': '🔲', 'humanize_aim': '🤖', 'show_watermark': '💧'
    };

    keys.forEach(key => {
      const val = settings[key];
      const type = typeof val;
      const icon = icons[key] || '▪️';
      const desc = `${type === 'number' ? `${val.toFixed(2)}` : (val ? 'Enabled' : 'Disabled')}`;

      html += `
        <div class="elite-feature-card ${val && typeof val === 'boolean' ? 'active' : ''}">
          <div class="elite-feature-info">
            <div class="elite-feature-icon">${icon}</div>
            <div class="elite-feature-text">
              <div class="elite-feature-name">${humanizeValue(key)}</div>
              <div class="elite-feature-desc">${desc}</div>
            </div>
          </div>
          <div class="elite-toggle ${val && typeof val === 'boolean' ? 'on' : ''}" onclick="toggleSetting('${key}', event)"></div>
        </div>
      `;
    });

    // Add numeric sliders
    const numericKeys = keys.filter(k => typeof settings[k] === 'number');
    if (numericKeys.length > 0) {
      html += `<div class="elite-section-title">Advanced Settings</div>`;
      numericKeys.forEach(key => {
        const val = settings[key];
        let min = 0, max = 1, step = 0.01;

        if (key === 'aimbot_fov' || key === 'trigger_threshold') {
          min = 10; max = 200; step = 1;
        } else if (key === 'menu_opacity') {
          min = 0.5; max = 1; step = 0.05;
        }

        html += `
          <div class="elite-slider-group">
            <label style="flex: 1; font-size: 12px; color: #aaa;">${humanizeValue(key)}</label>
            <input type="range" class="elite-slider" min="${min}" max="${max}" step="${step}" value="${val}"
              onchange="updateSetting('${key}', this.value)" style="flex: 2;">
            <div class="elite-slider-value">${val.toFixed(2)}</div>
          </div>
        `;
      });
    }
  }

  content.innerHTML = html;
}

function selectSection(section, iconEl) {
  currentSection = section;
  document.querySelectorAll('.elite-sidebar-icon').forEach(el => el.classList.remove('active'));
  if (iconEl) iconEl.classList.add('active');
  updateMenuContent();
}

// ============= WINDOW FUNCTIONS =============
window.toggleSetting = function(key, event) {
  event.stopPropagation();
  const val = settings[key];
  if (typeof val === 'boolean') settings[key] = !val;
  saveSettings();
  updateMenuContent();
};

window.updateSetting = function(key, value) {
  settings[key] = parseFloat(value);
  saveSettings();
  updateMenuContent();
};

// ============= WATERMARK =============
function createWatermark() {
  const wm = document.createElement('div');
  wm.className = 'elite-watermark';
  wm.innerHTML = `
    <div>⚡ KRUNKER ELITE v1.0.0</div>
    <div>FPS: <span id="wm-fps">0</span></div>
    <div>Players: <span id="wm-players">0</span></div>
    <div>Status: <span id="wm-status" class="elite-status">ACTIVE</span></div>
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

// ============= GAME LOGIC =============
function triggerShot() {
  const cvs = getGameCanvas();
  if (!cvs) return;
  try {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const downEvent = new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: cx, clientY: cy, buttons: 1
    });
    const upEvent = new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, clientX: cx, clientY: cy
    });
    cvs.dispatchEvent(downEvent);
    setTimeout(() => cvs.dispatchEvent(upEvent), settings.trigger_delay);
  } catch (e) {
    console.warn('[Elite] Trigger error:', e.message);
  }
}

function findPlayers() {
  if (!scene) return [];
  const players = [];
  try {
    for (let child of scene.children) {
      if (!child || !child.type) continue;

      // Check if this is the player (has camera)
      if (child.children && child.children[0] && child.children[0].children) {
        let hasCamera = false;
        for (let sub of child.children[0].children) {
          if (sub.type === 'PerspectiveCamera') {
            hasCamera = true;
            break;
          }
        }
        if (hasCamera) {
          myPlayer = child;
          continue;
        }
      }

      // Check if valid enemy (has position and matrix)
      if (child.position && child.matrixWorld && child.children && child.children.length > 0) {
        players.push(child);
      }
    }
  } catch (e) {
    console.warn('[Elite] Player detection error:', e.message);
  }
  return players;
}

function getWorldPos(obj) {
  try {
    const pos = new THREE.Vector3();
    pos.setFromMatrixPosition(obj.matrixWorld);
    return pos;
  } catch (e) {
    return null;
  }
}

function screenPos(worldPos, camera) {
  try {
    const pos = worldPos.clone();
    const projected = pos.project(camera);
    const sx = (projected.x + 1) / 2 * window.innerWidth;
    const sy = (1 - projected.y) / 2 * window.innerHeight;
    return { x: sx, y: sy };
  } catch (e) {
    return null;
  }
}

function animate() {
  requestAnimationFrame(animate);

  const players = findPlayers();
  if (players.length === 0 && !myPlayer) return;

  if (!myPlayer) return;

  updateWatermark(players.length);

  if (!settings.aimbot_enabled) return;
  if (settings.aimbot_hold_right_click && !rightMouseDown) return;

  const camera = myPlayer.children[0]?.children[0];
  if (!camera) return;

  let target = null;
  let minDist = Infinity;

  for (let player of players) {
    try {
      const worldPos = getWorldPos(player);
      if (!worldPos) continue;

      const screen = screenPos(worldPos, camera);
      if (!screen) continue;

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const dist = Math.hypot(screen.x - centerX, screen.y - centerY);

      if (dist < settings.aimbot_fov && dist < minDist) {
        target = player;
        minDist = dist;
      }
    } catch (e) {
      // Silently skip this player
    }
  }

  if (!target) return;

  // Get target position
  const targetPos = getWorldPos(target);
  if (!targetPos) return;

  if (settings.aimbot_target === 'head' && target.children[0] && target.children[0].children[1]) {
    try {
      const headPos = new THREE.Vector3();
      headPos.setFromMatrixPosition(target.children[0].children[1].matrixWorld);
      targetPos.copy(headPos);
    } catch (e) {
      // Use body pos
    }
  }

  // Apply prediction
  if (settings.aimbot_predict && target.velocity) {
    try {
      const vel = target.velocity.clone().multiplyScalar(1.5);
      targetPos.add(vel);
    } catch (e) {
      // No prediction available
    }
  }

  // Calculate rotation
  tempObject.position.copy(myPlayer.position);
  tempObject.lookAt(targetPos);

  const humanize = settings.humanize_aim ? rand(-settings.aimbot_humanize, settings.aimbot_humanize) : 0;
  const smooth = easeOutCubic(settings.aimbot_smoothness + humanize);

  myPlayer.children[0].rotation.x = lerp(myPlayer.children[0].rotation.x, -tempObject.rotation.x, smooth);
  myPlayer.rotation.y = lerp(myPlayer.rotation.y, tempObject.rotation.y, smooth);

  // Trigger bot
  if (settings.trigger_bot && minDist < settings.trigger_threshold) {
    triggerShot();
  }
}

animate();

// ============= INPUT HANDLING =============
window.addEventListener('DOMContentLoaded', () => {
  // Inject styles
  const style = document.createElement('style');
  style.textContent = MENU_STYLES;
  document.head.appendChild(style);

  // Create UI elements
  sidebarEl = createSidebar();
  menuEl = createMainMenu();
  watermarkEl = createWatermark();

  document.body.appendChild(sidebarEl);
  document.body.appendChild(menuEl);
  if (settings.show_watermark) document.body.appendChild(watermarkEl);

  // Set initial section
  selectSection('Home', sidebarEl.children[0]);
});

window.addEventListener('keydown', (e) => {
  // Right Shift toggles menu
  if (e.shiftKey && e.location === 2) {
    e.preventDefault();
    if (menuEl) {
      menuEl.classList.toggle('open');
    }
  }
  if (e.code === 'Space') spaceHeld = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') spaceHeld = false;
});

window.addEventListener('pointerdown', (e) => {
  if (e.button === 2) rightMouseDown = true;
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 2) rightMouseDown = false;
});

// Prevent right-click context menu on canvas
document.addEventListener('contextmenu', (e) => {
  if (e.target.tagName === 'CANVAS') e.preventDefault();
}, false);
