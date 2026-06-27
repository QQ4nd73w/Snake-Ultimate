const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');
const modalMenu = document.getElementById('modalMenu');
const themeToggle = document.getElementById('themeToggle');

const modal = document.getElementById('gameOverModal');
const finalScoreEl = document.getElementById('finalScore');
const recordsTableBody = document.querySelector('#recordsTable tbody');
const modalRestart = document.getElementById('modalRestart');
const pauseOverlay = document.getElementById('pauseOverlay');
const muteBtn = document.getElementById('muteBtn');

let snake = [ {x:150,y:150}, {x:140,y:150}, {x:130,y:150}, {x:120,y:150}, {x:110,y:150} ];
let dx = 10, dy = 0;
let foodX = 0, foodY = 0;
let score = 0;
let bestScore = parseInt(localStorage.getItem('snakeBest')) || 0;
let changingDirection = false;
let gameRunning = false;
let isGameOver = false;
let isPaused = false;

let prevSnake = null;
let animStart = 0;
let baseTickInterval = 100;
let tickInterval = baseTickInterval;
let lastTick = 0;
let animating = false;
let lastEaten = null;

let buffs = [];
let nextBuffSpawn = 0;
const buffVisibleMs = 5000;
const buffDurationMs = 20000;
const buffTypes = ['x2','magnet','speed','slow','bigcoin'];
let activeBuffs = { x2: 0, magnet: 0, speed: 0, slow: 0 };

let isMuted = localStorage.getItem('snakeMuted') === 'true';

let buffSpawnMin = 5000, buffSpawnMax = 15000, startLength = 5;
const difficultySelect = document.getElementById('difficultySelect');
let gameMode = localStorage.getItem('snakeMode') || 'classic';
let timedEnd = 0;
let buffsEnabled = true;

function createStartingSnake(len){
  const headX = 150, headY = 150; const arr = [];
  for(let i=0;i<len;i++){ arr.push({x: headX - i*10, y: headY}); }
  return arr;
}

function applyDifficulty(level){
  if(level === 'insane'){
    localStorage.setItem('snakeDifficulty','insane');
    baseTickInterval = 40;
    buffSpawnMin = 2000; buffSpawnMax = 8000; startLength = 3;
    if(difficultySelect) difficultySelect.value = 'insane';
    tickInterval = baseTickInterval;
    return;
  }
  if(level === 'easy'){
    localStorage.setItem('snakeDifficulty','easy');
    baseTickInterval = 140;
    buffSpawnMin = 8000; buffSpawnMax = 20000; startLength = 7;
  } else if(level === 'hard'){
    localStorage.setItem('snakeDifficulty','hard');
    baseTickInterval = 70;
    buffSpawnMin = 3000; buffSpawnMax = 12000; startLength = 4;
  } else {
    localStorage.setItem('snakeDifficulty','normal');
    baseTickInterval = 100;
    buffSpawnMin = 5000; buffSpawnMax = 15000; startLength = 5;
  }
  tickInterval = baseTickInterval;
  if(difficultySelect) difficultySelect.value = level;
}

function randBetween(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

function shadeColor(hex, percent){
  try{
    const h = hex.replace('#','');
    const num = parseInt(h,16);
    let r = (num >> 16) & 0xFF; let g = (num >> 8) & 0xFF; let b = num & 0xFF;
    const amt = Math.round(2.55 * percent);
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
  }catch(e){ return hex; }
}

function fixCanvasSize(){
  const w = 300, h = 300;
  if(gameCanvas){
    gameCanvas.width = w;
    gameCanvas.height = h;
    gameCanvas.style.width = w + 'px';
    gameCanvas.style.height = h + 'px';
  }
}

let audioCtx = null;
function ensureAudio(){ if(!audioCtx){ try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ audioCtx = null; } } return audioCtx; }
function playTone(freq, type='sine', duration=0.12, volume=0.08){ if(isMuted) return; const ac = ensureAudio(); if(!ac) return; const o = ac.createOscillator(); const g = ac.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = volume; o.connect(g); g.connect(ac.destination); const now = ac.currentTime; o.start(now); g.gain.setValueAtTime(volume, now); g.gain.exponentialRampToValueAtTime(0.001, now + duration); o.stop(now + duration + 0.02); }
function playEatSound(){ playTone(880,'sine',0.14,0.09); playTone(1320,'sine',0.08,0.06); }
function playGameOverSound(){ playTone(240,'triangle',0.45,0.12); playTone(160,'sawtooth',0.45,0.08); }

function playBuffSound(type){ if(isMuted) return; if(type === 'x2'){ playTone(1200,'sine',0.12,0.09); playTone(1600,'sine',0.08,0.06); }
  else if(type === 'magnet'){ playTone(900,'triangle',0.14,0.08); playTone(700,'sine',0.1,0.06); }
  else if(type === 'speed'){ playTone(1500,'sawtooth',0.12,0.08); }
  else if(type === 'slow'){ playTone(320,'sine',0.2,0.08); }
  else if(type === 'bigcoin'){ playTone(1800,'square',0.12,0.12); playTone(2200,'sine',0.08,0.06); }
  else { playTone(1040,'square',0.12,0.08); }
}

function clearCanvas(){
  const dark = document.body.classList.contains('dark');
  ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
  if(dark){
    ctx.fillStyle = 'rgba(7,17,38,0.45)';
    ctx.fillRect(0,0,gameCanvas.width,gameCanvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0,0,gameCanvas.width,gameCanvas.height);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  }
  ctx.strokeRect(0,0,gameCanvas.width,gameCanvas.height);
}

function drawSnakePartAt(x,y,i){
  const dark = document.body.classList.contains('dark');
  const w = 10, h = 10, r = 3;
  let fill, stroke;
  if(typeof i === 'number'){
    const mod = i % 3;
    if(mod === 0){ fill = '#ffffff'; stroke = dark ? '#cfcfcf' : '#d0d0d0'; }
    else if(mod === 1){ fill = '#0039a6'; stroke = dark ? '#03223f' : '#002b66'; }
    else { fill = '#d52b1e'; stroke = dark ? '#4a120f' : '#7a1b16'; }
  } else {
    fill = dark ? '#7ee7c7' : '#9fe59f';
    stroke = dark ? '#0b5a51' : '#196619';
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, fill);
  const highlight = (fill === '#ffffff') ? 'rgba(255,255,255,0.6)' : shadeColor(fill, 10);
  grad.addColorStop(1, highlight);
  ctx.fillStyle = grad; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke();
}

function drawSnake(){ snake.forEach((p,i) => drawSnakePartAt(p.x,p.y,i)); }

function randomTen(min,max){ return Math.round((Math.random()*(max-min)+min)/10)*10; }
function createFood(){
  foodX = randomTen(0, gameCanvas.width-10);
  foodY = randomTen(0, gameCanvas.height-10);
  snake.forEach(function isOnSnake(part){ if(part.x === foodX && part.y === foodY) createFood(); });
}

function drawFood(now){
  const size = 10;
  const cx = foodX + size/2; const cy = foodY + size/2;
  if(lastEaten){
    const dt = now - lastEaten.start; const dur = 300;
    if(dt < dur){ const t = dt/dur; const scale = 1 + 0.8*(1-t);
      ctx.beginPath(); ctx.fillStyle = `rgba(255,90,90,${1-t})`; ctx.arc(lastEaten.x + size/2, lastEaten.y + size/2, (size/2)*scale, 0, Math.PI*2); ctx.fill(); ctx.closePath();
    }
  }
  const dark = document.body.classList.contains('dark');
  const bodyColor = dark ? '#ff8b8b' : '#ff3b3b';
  ctx.beginPath(); ctx.fillStyle = bodyColor; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx, cy, size/2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
  ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.ellipse(cx - 2, cy - 3, 3, 2, Math.PI/4, 0, Math.PI*2); ctx.fill(); ctx.closePath();
  ctx.beginPath(); ctx.strokeStyle = dark ? '#2b6b2b' : '#2b8a2b'; ctx.lineWidth = 2; ctx.moveTo(cx + 1, cy - 6); ctx.lineTo(cx + 3, cy - 10); ctx.stroke(); ctx.closePath();
}

function playBuffSound(){ playTone(1040,'square',0.12,0.08); playTone(780,'sine',0.09,0.06); }

let gameAudio = null;
let gameAudioRateCurrent = 1;
let gameAudioRateTarget = 1;
const gameAudioSmoothing = 0.12;
function computeMusicRate(now){ const sp = activeBuffs.speed > now; const sl = activeBuffs.slow > now; if(sp && sl) return 1; if(sp) return 1.4; if(sl) return 0.7; return 1; }
function applyGameAudioRate(now){ try{ if(!gameAudio) return; const rate = computeMusicRate(now); gameAudioRateTarget = rate;
    gameAudioRateCurrent += (gameAudioRateTarget - gameAudioRateCurrent) * gameAudioSmoothing;
    gameAudioRateCurrent = Math.max(0.25, Math.min(4, gameAudioRateCurrent));
    gameAudio.playbackRate = gameAudioRateCurrent;
  }catch(e){} }

function startGameMusic(){ if(isMuted) return; if(gameAudio) return; try{ gameAudio = new Audio('game.mp3'); gameAudio.loop = true; gameAudio.volume = 0.12; const now = performance.now(); gameAudioRateCurrent = computeMusicRate(now); gameAudioRateTarget = gameAudioRateCurrent; gameAudio.playbackRate = gameAudioRateCurrent; gameAudio.play().catch(()=>{}); }catch(e){ gameAudio = null; } }
function pauseGameMusic(){ if(gameAudio){ try{ gameAudio.pause(); }catch(e){} } }
function resumeGameMusic(){ if(isMuted) return; if(gameAudio){ try{ gameAudio.play().catch(()=>{}); }catch(e){} } else { startGameMusic(); } }
function stopGameMusic(){ if(gameAudio){ try{ gameAudio.pause(); gameAudio.currentTime = 0; }catch(e){} gameAudio = null; } }

function spawnBuff(timestamp){
  const r = Math.random();
  let type;
  if(r < 0.18) type = 'x2';
  else if(r < 0.34) type = 'magnet';
  else if(r < 0.70) type = 'speed';
  else if(r < 0.90) type = 'slow';
  else type = 'bigcoin';
  let bx = randomTen(0, gameCanvas.width-10);
  let by = randomTen(0, gameCanvas.height-10);
  const onSnake = () => snake.some(p=>p.x===bx && p.y===by);
  while((bx===foodX && by===foodY) || onSnake()){
    bx = randomTen(0, gameCanvas.width-10);
    by = randomTen(0, gameCanvas.height-10);
  }
  let visible = buffVisibleMs;
  if(activeBuffs.slow > timestamp && !(activeBuffs.speed > timestamp)){
    visible = Math.round(buffVisibleMs * 1.5);
  }
  buffs.push({x: bx, y: by, type, spawn: timestamp, expires: timestamp + visible});
  nextBuffSpawn = timestamp + randBetween(buffSpawnMin, buffSpawnMax);
  fixCanvasSize();
}

function drawBuffs(now){
  const size = 10;
  for(let i=buffs.length-1;i>=0;i--){
    const b = buffs[i];
    if(now >= b.expires){ buffs.splice(i,1); continue; }
    const cx = b.x + size/2, cy = b.y + size/2;
    if(b.type === 'x2'){
      ctx.beginPath(); ctx.fillStyle = '#ffd24d'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
      ctx.fillStyle = '#6a3b00'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('x2', cx, cy);
    } else if(b.type === 'magnet'){
      ctx.beginPath(); ctx.fillStyle = '#8be0ff'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
      ctx.fillStyle = '#003040'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('М', cx, cy);
    } else if(b.type === 'speed'){
      ctx.beginPath(); ctx.fillStyle = '#ffd1ff'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
      ctx.fillStyle = '#43003a'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⚡', cx, cy);
    } else if(b.type === 'slow'){
      ctx.beginPath(); ctx.fillStyle = '#cfe6d3'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
      ctx.fillStyle = '#0b3a1a'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🐌', cx, cy);
    } else if(b.type === 'bigcoin'){
      ctx.beginPath(); ctx.fillStyle = '#ffe18a'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
      ctx.fillStyle = '#6a3b00'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('+50', cx, cy);
    }
    const rem = b.expires - now; const frac = Math.max(0, Math.min(1, rem / buffVisibleMs));
    ctx.beginPath(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; ctx.arc(cx, cy-12, 6, -Math.PI/2, -Math.PI/2 + 2*Math.PI*frac); ctx.stroke(); ctx.closePath();
  }
}

function updateBuffUI(now){
  const el = document.getElementById('buffs'); if(!el) return;
  el.innerHTML = '';
  const nowt = now || performance.now();
  const sp = activeBuffs.speed > nowt;
  const sl = activeBuffs.slow > nowt;
  for(const k of Object.keys(activeBuffs)){
    const exp = activeBuffs[k]; if(exp > nowt){
      const rem = Math.ceil((exp - nowt)/1000);
      const div = document.createElement('div'); div.className = 'buff-badge';
      if(sp && sl) div.classList.add('buff-neutral');
      const icon = document.createElement('span'); icon.className = 'buff-icon';
      icon.textContent = k==='x2' ? 'x2' : k==='magnet' ? 'М' : k==='speed' ? '⚡' : k==='slow' ? '🐌' : '';
      div.appendChild(icon);
      const name = k==='x2'? 'Удвоение' : k==='magnet' ? 'Магнит' : k==='speed' ? 'Скорость' : 'Замедление';
      const txt = document.createElement('span'); txt.textContent = name + ' • ' + rem + 'с' + ((sp && sl) ? ' (нейтр.)' : '');
      div.appendChild(txt);
      el.appendChild(div);
    }
  }
  const existingOverlay = document.getElementById('buffOverlay'); if(existingOverlay) existingOverlay.remove();
  if(sp && sl){
    const overlay = document.createElement('div'); overlay.id = 'buffOverlay'; overlay.className = 'buff-badge buff-neutral';
    overlay.style.position = 'absolute'; overlay.style.left = '50%'; overlay.style.transform = 'translateX(-50%)'; overlay.style.top = '72px'; overlay.style.zIndex = 30;
    overlay.innerHTML = '<span class="buff-icon">⚡</span><span class="buff-icon">🐌</span><span style="margin-left:8px">Нейтрализация</span>';
    const container = document.querySelector('.container'); if(container) container.appendChild(overlay);
  }
}

function tryMagnetPickup(timestamp){
  if(!(activeBuffs.magnet > timestamp)) return false;
  const hx = snake[0].x, hy = snake[0].y;
  if(hy === foodY && (foodX === hx - 10 || foodX === hx + 10)){
    const mul = (activeBuffs.x2 > timestamp) ? 2 : 1;
    score += 10 * mul; scoreEl.textContent = 'Счёт: ' + score;
    snake.push({...snake[snake.length-1]});
    lastEaten = {x: foodX, y: foodY, start: timestamp}; playEatSound(); createFood();
    return true;
  }
  return false;
}

function drawHeadEyes(x,y){
  const eyeSize = 2;
  const dirX = dx === 0 ? 0 : Math.sign(dx);
  const dirY = dy === 0 ? 0 : Math.sign(dy);
  const ex = x + 3 + dirX*2; const ey = y + 3 + dirY*2;
  ctx.beginPath(); ctx.fillStyle = '#111'; ctx.arc(ex, ey, eyeSize, 0, Math.PI*2); ctx.fill(); ctx.closePath();
  ctx.beginPath(); ctx.fillStyle = '#111'; ctx.arc(ex + 4*dirX, ey + 4*dirY, eyeSize, 0, Math.PI*2); ctx.fill(); ctx.closePath();
}

function advanceSnake(){
  const head = {x: snake[0].x + dx, y: snake[0].y + dy};
  snake.unshift(head);
  const didEatFood = head.x === foodX && head.y === foodY;
  if(didEatFood){
    const now = performance.now();
    const mul = (activeBuffs.x2 > now) ? 2 : 1;
    score += 10 * mul; scoreEl.textContent = 'Счёт: ' + score;
  } else { snake.pop(); }
  return didEatFood;
}

function changeDirection(event){
  if(changingDirection) return;
  if(event.code === 'Space' || event.key === ' ' || event.keyCode === 32) return;
  changingDirection = true;
  const goingUp = dy === -10; const goingDown = dy === 10; const goingLeft = dx === -10; const goingRight = dx === 10;
  const k = (event.key || '').toLowerCase(); const c = event.code || '';
  if((k === 'arrowleft' || k === 'a' || c === 'KeyA' || event.keyCode === 37) && !goingRight){ dx = -10; dy = 0; }
  if((k === 'arrowup' || k === 'w' || c === 'KeyW' || event.keyCode === 38) && !goingDown){ dx = 0; dy = -10; }
  if((k === 'arrowright' || k === 'd' || c === 'KeyD' || event.keyCode === 39) && !goingLeft){ dx = 10; dy = 0; }
  if((k === 'arrowdown' || k === 's' || c === 'KeyS' || event.keyCode === 40) && !goingUp){ dx = 0; dy = 10; }
}

function didGameEnd(){
  for(let i=4;i<snake.length;i++){ if(snake[i].x===snake[0].x && snake[i].y===snake[0].y) return true; }
  const hitLeft = snake[0].x < 0; const hitRight = snake[0].x > gameCanvas.width - 10;
  const hitTop = snake[0].y < 0; const hitBottom = snake[0].y > gameCanvas.height - 10;
  return hitLeft || hitRight || hitTop || hitBottom;
}

function render(now){
  clearCanvas();
  drawFood(now);
  drawBuffs(now);
  if(animating && prevSnake){
    const t = Math.min(1, (now - animStart) / tickInterval);
    for(let i=0;i<snake.length;i++){
      const prev = prevSnake[i] || prevSnake[prevSnake.length-1];
      const cur = snake[i] || snake[snake.length-1];
      const x = prev.x + (cur.x - prev.x) * t;
      const y = prev.y + (cur.y - prev.y) * t;
      drawSnakePartAt(x,y,i);
      if(i===0){ drawHeadEyes(x,y); }
    }
    if(t >= 1) animating = false;
  } else {
    drawSnake();
    if(snake.length) drawHeadEyes(snake[0].x, snake[0].y);
  }
}

function saveScoreToRecords(value){
  const key = 'snakeScores';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push({score: value, date: new Date().toISOString()});
  list.sort((a,b)=>b.score-a.score);
  const top = list.slice(0,10);
  localStorage.setItem(key, JSON.stringify(top));
  return top;
}

function populateRecordsTable(){
  const key = 'snakeScores';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  recordsTableBody.innerHTML = '';
  list.forEach((r,idx)=>{
    const tr = document.createElement('tr');
    const d = new Date(r.date);
    tr.innerHTML = `<td>${idx+1}</td><td>${r.score}</td><td>${d.toLocaleString()}</td>`;
    recordsTableBody.appendChild(tr);
  });
  if(list.length===0){ const tr = document.createElement('tr'); tr.innerHTML = '<td colspan="3">— записей нет —</td>'; recordsTableBody.appendChild(tr); }
}

function showGameOverModal(){
  try{ const ov = document.getElementById('buffOverlay'); if(ov) ov.remove(); }catch(e){}
  isGameOver = true; gameRunning = false; isPaused = false;
  finalScoreEl.textContent = 'Счёт: ' + score;
  populateRecordsTable();
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); modal.style.display = 'flex';
  playGameOverSound();
  stopGameMusic();
}

function hideGameOverModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); modal.style.display = 'none'; isGameOver = false; }
 

function showPause(){ isPaused = true; pauseOverlay.classList.remove('hidden'); }
function hidePause(){ isPaused = false; pauseOverlay.classList.add('hidden'); }

function gameLoop(timestamp){
  if(!gameRunning) return;
  const ended = didGameEnd();
  if(ended){
    gameRunning = false; updateBestIfNeeded(); saveScoreToRecords(score); showGameOverModal(); return;
  }
  if(!lastTick) lastTick = timestamp;
  if(timestamp - lastTick >= tickInterval){
    lastTick = timestamp;
    prevSnake = snake.map(p => ({x:p.x,y:p.y}));
    changingDirection = false;
    updateTickInterval(timestamp);
    if(buffsEnabled){ if(nextBuffSpawn === 0) nextBuffSpawn = timestamp + randBetween(buffSpawnMin, buffSpawnMax);
      if(timestamp >= nextBuffSpawn){ spawnBuff(timestamp); }
    }
    tryMagnetPickup(timestamp);

    const didEat = advanceSnake();
    animStart = timestamp; animating = true;
    if(didEat){ lastEaten = {x: prevSnake[0].x, y: prevSnake[0].y, start: timestamp}; createFood(); playEatSound(); }
    else { lastEaten = null; }

    for(let i=buffs.length-1;i>=0;i--){ const b = buffs[i]; if(b.x===snake[0].x && b.y===snake[0].y){
        if(b.type === 'bigcoin'){
          score += 50; scoreEl.textContent = 'Счёт: ' + score; playBuffSound('bigcoin');
        } else {
          activeBuffs[b.type] = timestamp + buffDurationMs; playBuffSound(b.type);
        }
        buffs.splice(i,1); lastEaten = {x:b.x,y:b.y,start:timestamp}; }
    }
    fixCanvasSize();

    tryMagnetPickup(timestamp);
  }
  updateBuffUI(timestamp);
  try{ applyGameAudioRate(timestamp); }catch(e){}
  if(gameMode === 'timed' && timedEnd){
    const remMs = Math.max(0, timedEnd - timestamp);
    const sec = Math.ceil(remMs / 1000);
    const timerEl = document.getElementById('timer'); if(timerEl) timerEl.textContent = 'Осталось: ' + sec + 'с';
    if(timestamp >= timedEnd){ gameRunning = false; updateBestIfNeeded(); saveScoreToRecords(score); showGameOverModal(); return; }
  }
  render(timestamp);
  requestAnimationFrame(gameLoop);
}

function startGame(){ if(gameRunning) return; hideGameOverModal(); hidePause(); isGameOver = false; gameRunning = true; score = 0; scoreEl.textContent = 'Счёт: ' + score;
  if(!snake || snake.length !== startLength) snake = createStartingSnake(startLength);
  createFood(); lastTick = 0;
  if(gameMode === 'timed'){ const now = performance.now(); timedEnd = now + 60000; }
  startGameMusic();
  requestAnimationFrame(gameLoop); }
function pauseGame(){ if(!gameRunning) return; gameRunning = false; showPause(); pauseGameMusic(); }
function resumeGame(){ if(gameRunning) return; hidePause(); gameRunning = true; lastTick = 0; requestAnimationFrame(gameLoop); resumeGameMusic(); }
function restartGame(){ hideGameOverModal(); hidePause(); gameRunning = false; snake = createStartingSnake(startLength); dx = 10; dy = 0; score = 0; scoreEl.textContent = 'Счёт: ' + score; clearCanvas(); drawSnake(); startGame(); }

function updateTickInterval(now){ tickInterval = baseTickInterval; const sp = activeBuffs.speed > now; const sl = activeBuffs.slow > now; if(sp && sl){ tickInterval = baseTickInterval; } else if(sp){ tickInterval = Math.max(40, Math.round(baseTickInterval * 0.6)); } else if(sl){ tickInterval = Math.round(baseTickInterval * 1.5); } }

function updateBestIfNeeded(){ if(score > bestScore){ bestScore = score; localStorage.setItem('snakeBest', bestScore); if(bestEl) bestEl.textContent = 'Рекорд: ' + bestScore; } }

function onKeyDown(e){ if(e.code === 'Space' || e.keyCode === 32){ e.preventDefault(); if(isGameOver){
    restartGame(); return; }
    if(gameRunning){ pauseGame(); } else { resumeGame(); }
    return; }
  changeDirection(e);
}

document.removeEventListener('keydown', changeDirection);
document.addEventListener('keydown', onKeyDown);
if(startBtn) startBtn.addEventListener('click', ()=>{ startGame(); });
if(pauseBtn) pauseBtn.addEventListener('click', ()=>{ if(gameRunning) pauseGame(); else resumeGame(); });
if(restartBtn) restartBtn.addEventListener('click', ()=>{ restartGame(); });
if(modalRestart) modalRestart.addEventListener('click', (e)=>{ e.stopPropagation(); restartGame(); });
if(menuBtn) menuBtn.addEventListener('click', ()=>{ stopGameMusic(); window.location.href = 'menu.html'; });
if(modalMenu) modalMenu.addEventListener('click', (e)=>{ e.stopPropagation(); stopGameMusic(); window.location.href = 'menu.html'; });

if(muteBtn){ const setUI = ()=>{ muteBtn.textContent = isMuted ? '🔇' : '🔊'; if(isMuted) muteBtn.classList.add('muted'); else muteBtn.classList.remove('muted'); };
  setUI(); muteBtn.addEventListener('click', ()=>{ isMuted = !isMuted; localStorage.setItem('snakeMuted', isMuted); setUI();
    if(isMuted){ stopGameMusic(); } else { if(gameRunning) startGameMusic(); }
  }); }

if(difficultySelect){ const savedDifficulty = localStorage.getItem('snakeDifficulty') || 'normal'; applyDifficulty(savedDifficulty); difficultySelect.addEventListener('change', (e)=>{ applyDifficulty(e.target.value); }); }
else { const savedDifficulty = localStorage.getItem('snakeDifficulty') || 'normal'; applyDifficulty(savedDifficulty); }

try{
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get('mode');
  const diffParam = params.get('difficulty');
  if(modeParam){ gameMode = modeParam; localStorage.setItem('snakeMode', gameMode); }
  if(diffParam){ applyDifficulty(diffParam); localStorage.setItem('snakeDifficulty', diffParam); }
  if(modeParam || diffParam){
    history.replaceState(null, '', window.location.pathname);
    gameMode = gameMode || localStorage.getItem('snakeMode') || 'classic';
    buffsEnabled = (gameMode !== 'nobuffs');
    if(gameMode === 'timed'){
      const now = performance.now(); timedEnd = now + 60000;
    } else { timedEnd = 0; }
    if(gameMode === 'insane'){
      buffSpawnMin = 150; buffSpawnMax = 250; startLength = 3;
    }
    try{ hideGameOverModal(); }catch(e){}
    restartGame();
  }
}catch(e){}

try{
  const seen = localStorage.getItem('snakeSeenMenu');
  const isMenuPage = window.location.pathname.endsWith('menu.html') || window.location.pathname.endsWith('/menu.html');
  if(!seen && !isMenuPage){
    window.location.href = 'menu.html';
  }
}catch(e){}

if(difficultySelect){
  difficultySelect.addEventListener('keydown', (e)=>{
    if(e.key && e.key.startsWith('Arrow')){
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape'){ if(gameRunning) pauseGame(); stopGameMusic(); window.location.href = 'menu.html'; } });

function applyTheme(theme){ if(theme === 'dark'){ document.body.classList.add('dark'); if(themeToggle) { themeToggle.textContent = 'Светлая'; themeToggle.setAttribute('aria-pressed','true'); } } else { document.body.classList.remove('dark'); if(themeToggle) { themeToggle.textContent = 'Тёмная'; themeToggle.setAttribute('aria-pressed','false'); } } localStorage.setItem('snakeTheme', theme); }
const savedTheme = localStorage.getItem('snakeTheme') || 'light'; applyTheme(savedTheme);
if(themeToggle){ themeToggle.addEventListener('click', ()=>{ const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark'; applyTheme(newTheme); }); }

clearCanvas(); drawSnake(); if(bestEl) bestEl.textContent = 'Рекорд: ' + bestScore; populateRecordsTable();
