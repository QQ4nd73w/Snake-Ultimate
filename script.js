const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const themeToggle = document.getElementById('themeToggle');

const modal = document.getElementById('gameOverModal');
const finalScoreEl = document.getElementById('finalScore');
const recordsTableBody = document.querySelector('#recordsTable tbody');
const modalRestart = document.getElementById('modalRestart');
const pauseOverlay = document.getElementById('pauseOverlay');
const muteBtn = document.getElementById('muteBtn');
// menu page is separate (menu.html)

let snake = [ {x:150,y:150}, {x:140,y:150}, {x:130,y:150}, {x:120,y:150}, {x:110,y:150} ];
let dx = 10, dy = 0;
let foodX = 0, foodY = 0;
let score = 0;
let bestScore = parseInt(localStorage.getItem('snakeBest')) || 0;
let changingDirection = false;
let gameRunning = false;
let isGameOver = false;
let isPaused = false;

// animation state
let prevSnake = null;
let animStart = 0;
let baseTickInterval = 100; // ms per grid step
let tickInterval = baseTickInterval;
let lastTick = 0;
let animating = false;
let lastEaten = null; // {x,y,start}

// Buff system
let buffs = []; // active on-field buffs
let nextBuffSpawn = 0;
const buffVisibleMs = 5000; // 5 seconds visible on field
const buffDurationMs = 20000; // 20 seconds active when picked
const buffTypes = ['x2','magnet','shield','speed','slow','bigcoin'];
let activeBuffs = { x2: 0, magnet: 0, shield: 0, speed: 0, slow: 0 };

// mute
let isMuted = localStorage.getItem('snakeMuted') === 'true';

// Note: background image for the page is handled via CSS; canvas uses solid fill

// Difficulty settings (will be applied via applyDifficulty)
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
    baseTickInterval = 40; // very fast
    buffSpawnMin = 2000; buffSpawnMax = 8000; startLength = 3;
    if(difficultySelect) difficultySelect.value = 'insane';
    tickInterval = baseTickInterval;
    return;
  }
  if(level === 'easy'){
    localStorage.setItem('snakeDifficulty','easy');
    baseTickInterval = 140; // slower
    buffSpawnMin = 8000; buffSpawnMax = 20000; startLength = 7;
  } else if(level === 'hard'){
    localStorage.setItem('snakeDifficulty','hard');
    baseTickInterval = 70; // faster
    buffSpawnMin = 3000; buffSpawnMax = 12000; startLength = 4;
  } else {
    localStorage.setItem('snakeDifficulty','normal');
    baseTickInterval = 100; // normal
    buffSpawnMin = 5000; buffSpawnMax = 15000; startLength = 5;
  }
  // update tickInterval
  tickInterval = baseTickInterval;
  if(difficultySelect) difficultySelect.value = level;
}

function randBetween(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

// utility: lighten/darken hex color by percent (-100..100)
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
  // ensure canvas element has fixed drawing buffer and CSS size
  const w = 300, h = 300;
  if(gameCanvas){
    gameCanvas.width = w;
    gameCanvas.height = h;
    gameCanvas.style.width = w + 'px';
    gameCanvas.style.height = h + 'px';
  }
}

// Audio
let audioCtx = null;
function ensureAudio(){ if(!audioCtx){ try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ audioCtx = null; } } return audioCtx; }
function playTone(freq, type='sine', duration=0.12, volume=0.08){ if(isMuted) return; const ac = ensureAudio(); if(!ac) return; const o = ac.createOscillator(); const g = ac.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = volume; o.connect(g); g.connect(ac.destination); const now = ac.currentTime; o.start(now); g.gain.setValueAtTime(volume, now); g.gain.exponentialRampToValueAtTime(0.001, now + duration); o.stop(now + duration + 0.02); }
function playEatSound(){ playTone(880,'sine',0.14,0.09); playTone(1320,'sine',0.08,0.06); }
function playGameOverSound(){ playTone(240,'triangle',0.45,0.12); playTone(160,'sawtooth',0.45,0.08); }

function playBuffSound(type){ if(isMuted) return; if(type === 'x2'){ playTone(1200,'sine',0.12,0.09); playTone(1600,'sine',0.08,0.06); }
  else if(type === 'magnet'){ playTone(900,'triangle',0.14,0.08); playTone(700,'sine',0.1,0.06); }
  else if(type === 'shield'){ playTone(520,'sine',0.18,0.1); playTone(780,'triangle',0.12,0.06); }
  else if(type === 'speed'){ playTone(1500,'sawtooth',0.12,0.08); }
  else if(type === 'slow'){ playTone(320,'sine',0.2,0.08); }
  else if(type === 'bigcoin'){ playTone(1800,'square',0.12,0.12); playTone(2200,'sine',0.08,0.06); }
  else { playTone(1040,'square',0.12,0.08); }
}

function clearCanvas(){
  const dark = document.body.classList.contains('dark');
  ctx.fillStyle = dark ? '#071126' : 'white';
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'black';
  ctx.fillRect(0,0,gameCanvas.width,gameCanvas.height);
  ctx.strokeRect(0,0,gameCanvas.width,gameCanvas.height);
}

function drawSnakePartAt(x,y,i){
  const dark = document.body.classList.contains('dark');
  const w = 10, h = 10, r = 3;
  // Russian tricolor: white, blue, red repeating from head to tail
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
  // rounded rect
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  // subtle gradient
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, fill);
  // slight highlight for the second stop
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
  // pulse when eaten
  if(lastEaten){
    const dt = now - lastEaten.start; const dur = 300;
    if(dt < dur){ const t = dt/dur; const scale = 1 + 0.8*(1-t);
      ctx.beginPath(); ctx.fillStyle = `rgba(255,90,90,${1-t})`; ctx.arc(lastEaten.x + size/2, lastEaten.y + size/2, (size/2)*scale, 0, Math.PI*2); ctx.fill(); ctx.closePath();
    }
  }
  // apple body
  const dark = document.body.classList.contains('dark');
  const bodyColor = dark ? '#ff8b8b' : '#ff3b3b';
  ctx.beginPath(); ctx.fillStyle = bodyColor; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx, cy, size/2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
  // highlight
  ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.ellipse(cx - 2, cy - 3, 3, 2, Math.PI/4, 0, Math.PI*2); ctx.fill(); ctx.closePath();
  // stem
  ctx.beginPath(); ctx.strokeStyle = dark ? '#2b6b2b' : '#2b8a2b'; ctx.lineWidth = 2; ctx.moveTo(cx + 1, cy - 6); ctx.lineTo(cx + 3, cy - 10); ctx.stroke(); ctx.closePath();
}

function playBuffSound(){ playTone(1040,'square',0.12,0.08); playTone(780,'sine',0.09,0.06); }

// Gameplay background music (use anthem.mp3 provided by user)
let gameAudio = null;
function startGameMusic(){ if(isMuted) return; if(gameAudio) return; try{ gameAudio = new Audio('Tatyana_Kurtukova_-_Matushka_74861522.mp3'); gameAudio.loop = true; gameAudio.volume = 0.12; gameAudio.play().catch(()=>{}); }catch(e){ gameAudio = null; } }
function pauseGameMusic(){ if(gameAudio){ try{ gameAudio.pause(); }catch(e){} } }
function resumeGameMusic(){ if(isMuted) return; if(gameAudio){ try{ gameAudio.play().catch(()=>{}); }catch(e){} } else { startGameMusic(); } }
function stopGameMusic(){ if(gameAudio){ try{ gameAudio.pause(); gameAudio.currentTime = 0; }catch(e){} gameAudio = null; } }

function spawnBuff(timestamp){
  // choose random type and location not on snake or food
  // weighted choice: bigcoin rarer
  const r = Math.random();
  let type;
  if(r < 0.18) type = 'x2';
  else if(r < 0.34) type = 'magnet';
  else if(r < 0.50) type = 'shield';
  else if(r < 0.70) type = 'speed';
  else if(r < 0.90) type = 'slow';
  else type = 'bigcoin';
  let bx = randomTen(0, gameCanvas.width-10);
  let by = randomTen(0, gameCanvas.height-10);
  // avoid collisions
  const onSnake = () => snake.some(p=>p.x===bx && p.y===by);
  while((bx===foodX && by===foodY) || onSnake()){
    bx = randomTen(0, gameCanvas.width-10);
    by = randomTen(0, gameCanvas.height-10);
  }
  buffs.push({x: bx, y: by, type, spawn: timestamp, expires: timestamp + buffVisibleMs});
  // schedule next spawn
  nextBuffSpawn = timestamp + randBetween(buffSpawnMin, buffSpawnMax);
  fixCanvasSize();
}

function drawBuffs(now){
  const size = 10;
  for(let i=buffs.length-1;i>=0;i--){
    const b = buffs[i];
    if(now >= b.expires){ buffs.splice(i,1); continue; }
    const cx = b.x + size/2, cy = b.y + size/2;
    // body
    if(b.type === 'x2'){
      ctx.beginPath(); ctx.fillStyle = '#ffd24d'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
      ctx.fillStyle = '#6a3b00'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('x2', cx, cy);
    } else if(b.type === 'magnet'){
      ctx.beginPath(); ctx.fillStyle = '#8be0ff'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
      ctx.fillStyle = '#003040'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('M', cx, cy);
    } else if(b.type === 'shield'){
      ctx.beginPath(); ctx.fillStyle = '#dfe7ff'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.closePath();
      ctx.fillStyle = '#0b2b6b'; ctx.font = '10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('S', cx, cy);
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
    // countdown arc above
    const rem = b.expires - now; const frac = Math.max(0, Math.min(1, rem / buffVisibleMs));
    ctx.beginPath(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; ctx.arc(cx, cy-12, 6, -Math.PI/2, -Math.PI/2 + 2*Math.PI*frac); ctx.stroke(); ctx.closePath();
  }
}

function updateBuffUI(now){
  const el = document.getElementById('buffs'); if(!el) return;
  el.innerHTML = '';
  const nowt = now || performance.now();
  for(const k of Object.keys(activeBuffs)){
    const exp = activeBuffs[k]; if(exp > nowt){
      const rem = Math.ceil((exp - nowt)/1000);
      const div = document.createElement('div'); div.className = 'buff-badge';
      const icon = document.createElement('span'); icon.className = 'buff-icon';
      icon.textContent = k==='x2' ? 'x2' : k==='magnet' ? 'M' : k==='shield' ? 'S' : k==='speed' ? '⚡' : k==='slow' ? '🐌' : '';
      div.appendChild(icon);
      const name = k==='x2'? 'Double' : k==='magnet' ? 'Magnet' : k==='shield' ? 'Shield' : k==='speed' ? 'Speed' : 'Slow';
      const txt = document.createElement('span'); txt.textContent = name + ' • ' + rem + 's';
      div.appendChild(txt);
      el.appendChild(div);
    }
  }
}

function tryMagnetPickup(timestamp){
  if(!(activeBuffs.magnet > timestamp)) return false;
  // check left/right adjacency (one cell) relative to current head
  const hx = snake[0].x, hy = snake[0].y;
  if(hy === foodY && (foodX === hx - 10 || foodX === hx + 10)){
    const mul = (activeBuffs.x2 > timestamp) ? 2 : 1;
    score += 10 * mul; scoreEl.textContent = 'Score: ' + score;
    // grow snake by duplicating tail
    snake.push({...snake[snake.length-1]});
    lastEaten = {x: foodX, y: foodY, start: timestamp}; playEatSound(); createFood();
    return true;
  }
  return false;
}

// draw head with eyes (call from render when drawing index 0?)
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
    score += 10 * mul; scoreEl.textContent = 'Score: ' + score;
  } else { snake.pop(); }
  return didEatFood;
}

function changeDirection(event){
  const LEFT=37, UP=38, RIGHT=39, DOWN=40;
  if(changingDirection) return;
  // ignore space here
  if(event.keyCode === 32) return;
  changingDirection = true;
  const key = event.keyCode;
  const goingUp = dy === -10; const goingDown = dy === 10; const goingLeft = dx === -10; const goingRight = dx === 10;
  if(key === LEFT && !goingRight){ dx = -10; dy = 0; }
  if(key === UP && !goingDown){ dx = 0; dy = -10; }
  if(key === RIGHT && !goingLeft){ dx = 10; dy = 0; }
  if(key === DOWN && !goingUp){ dx = 0; dy = 10; }
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
    // draw eyes on head
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
  if(list.length===0){ const tr = document.createElement('tr'); tr.innerHTML = '<td colspan="3">— no records —</td>'; recordsTableBody.appendChild(tr); }
}

function showGameOverModal(){
  isGameOver = true; gameRunning = false; isPaused = false;
  finalScoreEl.textContent = 'Score: ' + score;
  populateRecordsTable();
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); modal.style.display = 'flex';
  playGameOverSound();
  // stop gameplay music on game over
  stopGameMusic();
}

function hideGameOverModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); modal.style.display = 'none'; isGameOver = false; }
 

function showPause(){ isPaused = true; pauseOverlay.classList.remove('hidden'); }
function hidePause(){ isPaused = false; pauseOverlay.classList.add('hidden'); }

function gameLoop(timestamp){
  if(!gameRunning) return;
  // check collisions; if shield active consume it instead of ending
  const ended = didGameEnd();
  if(ended){
    if(activeBuffs.shield > timestamp){ activeBuffs.shield = 0; playBuffSound('shield'); }
    else { gameRunning = false; updateBestIfNeeded(); saveScoreToRecords(score); showGameOverModal(); return; }
  }
  if(!lastTick) lastTick = timestamp;
  if(timestamp - lastTick >= tickInterval){
    lastTick = timestamp;
    prevSnake = snake.map(p => ({x:p.x,y:p.y}));
    changingDirection = false;
    // update dynamic tickInterval based on buffs
    updateTickInterval(timestamp);
    // spawn buffs occasionally
    if(buffsEnabled){ if(nextBuffSpawn === 0) nextBuffSpawn = timestamp + randBetween(buffSpawnMin, buffSpawnMax);
      if(timestamp >= nextBuffSpawn){ spawnBuff(timestamp); }
    }
    // try magnet pickup before moving (in case apple is adjacent)
    tryMagnetPickup(timestamp);

    const didEat = advanceSnake();
    animStart = timestamp; animating = true;
    if(didEat){ lastEaten = {x: prevSnake[0].x, y: prevSnake[0].y, start: timestamp}; createFood(); playEatSound(); }
    else { lastEaten = null; }

    // check buff pickups by head
    for(let i=buffs.length-1;i>=0;i--){ const b = buffs[i]; if(b.x===snake[0].x && b.y===snake[0].y){ // activate
        if(b.type === 'bigcoin'){
          score += 50; scoreEl.textContent = 'Score: ' + score; playBuffSound('bigcoin');
        } else {
          activeBuffs[b.type] = timestamp + buffDurationMs; playBuffSound(b.type);
        }
        buffs.splice(i,1); lastEaten = {x:b.x,y:b.y,start:timestamp}; }
    }
    // ensure canvas size remains fixed after pickups
    fixCanvasSize();

    // magnet effect: if active and apple is immediately left/right of head, magnet pulls and counts as eaten
    // try magnet pickup again after moving
    tryMagnetPickup(timestamp);
  }
  // update buff UI
  updateBuffUI(timestamp);
  // check timed mode end
  if(gameMode === 'timed' && timedEnd && timestamp >= timedEnd){ gameRunning = false; updateBestIfNeeded(); saveScoreToRecords(score); showGameOverModal(); return; }
  render(timestamp);
  requestAnimationFrame(gameLoop);
}

function startGame(){ if(gameRunning) return; hideGameOverModal(); hidePause(); isGameOver = false; gameRunning = true; score = 0; scoreEl.textContent = 'Score: ' + score; // ensure snake length matches difficulty
  if(!snake || snake.length !== startLength) snake = createStartingSnake(startLength);
  createFood(); lastTick = 0; // start gameplay music
  startGameMusic();
  requestAnimationFrame(gameLoop); }
function pauseGame(){ if(!gameRunning) return; gameRunning = false; showPause(); pauseGameMusic(); }
function resumeGame(){ if(gameRunning) return; hidePause(); gameRunning = true; lastTick = 0; requestAnimationFrame(gameLoop); resumeGameMusic(); }
function restartGame(){ hideGameOverModal(); hidePause(); gameRunning = false; snake = createStartingSnake(startLength); dx = 10; dy = 0; score = 0; scoreEl.textContent = 'Score: ' + score; clearCanvas(); drawSnake(); startGame(); }

function updateTickInterval(now){ tickInterval = baseTickInterval; if(activeBuffs.speed > now) tickInterval = Math.max(40, Math.round(baseTickInterval * 0.6)); else if(activeBuffs.slow > now) tickInterval = Math.round(baseTickInterval * 1.5); }

function updateBestIfNeeded(){ if(score > bestScore){ bestScore = score; localStorage.setItem('snakeBest', bestScore); if(bestEl) bestEl.textContent = 'Best: ' + bestScore; } }

// keyboard handling: space toggles pause/resume or starts new game when over
function onKeyDown(e){ if(e.code === 'Space' || e.keyCode === 32){ e.preventDefault(); if(isGameOver){ // start new game
    restartGame(); return; }
    if(gameRunning){ pauseGame(); } else { resumeGame(); }
    return; }
  // otherwise delegate to changeDirection
  changeDirection(e);
}

document.removeEventListener('keydown', changeDirection);
document.addEventListener('keydown', onKeyDown);
if(startBtn) startBtn.addEventListener('click', ()=>{ startGame(); });
if(pauseBtn) pauseBtn.addEventListener('click', ()=>{ if(gameRunning) pauseGame(); else resumeGame(); });
if(restartBtn) restartBtn.addEventListener('click', ()=>{ restartGame(); });
if(modalRestart) modalRestart.addEventListener('click', (e)=>{ e.stopPropagation(); restartGame(); });

// mute button
if(muteBtn){ const setUI = ()=>{ muteBtn.textContent = isMuted ? '🔇' : '🔊'; if(isMuted) muteBtn.classList.add('muted'); else muteBtn.classList.remove('muted'); };
  setUI(); muteBtn.addEventListener('click', ()=>{ isMuted = !isMuted; localStorage.setItem('snakeMuted', isMuted); setUI();
    if(isMuted){ stopGameMusic(); } else { if(gameRunning) startGameMusic(); }
  }); }

// difficulty select
if(difficultySelect){ const savedDifficulty = localStorage.getItem('snakeDifficulty') || 'normal'; applyDifficulty(savedDifficulty); difficultySelect.addEventListener('change', (e)=>{ applyDifficulty(e.target.value); }); }
else { const savedDifficulty = localStorage.getItem('snakeDifficulty') || 'normal'; applyDifficulty(savedDifficulty); }

// If opened with URL params, apply them (mode & difficulty)
try{
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get('mode');
  const diffParam = params.get('difficulty');
  if(modeParam){ gameMode = modeParam; localStorage.setItem('snakeMode', gameMode); }
  if(diffParam){ applyDifficulty(diffParam); localStorage.setItem('snakeDifficulty', diffParam); }
  // reset URL (remove params) to avoid reapplying on reload
  if(modeParam || diffParam){
    history.replaceState(null, '', window.location.pathname);
    // apply mode behavior and start the game immediately without showing Game Over
    gameMode = gameMode || localStorage.getItem('snakeMode') || 'classic';
    buffsEnabled = (gameMode !== 'nobuffs');
    if(gameMode === 'timed'){
      const now = performance.now(); timedEnd = now + 60000; // 60s
    } else { timedEnd = 0; }
    try{ hideGameOverModal(); }catch(e){}
    // start / restart the game
    restartGame();
  }
}catch(e){}

// On first run show menu page only
try{
  const seen = localStorage.getItem('snakeSeenMenu');
  const isMenuPage = window.location.pathname.endsWith('menu.html') || window.location.pathname.endsWith('/menu.html');
  if(!seen && !isMenuPage){
    window.location.href = 'menu.html';
  }
}catch(e){}

// Prevent arrow keys from changing the difficulty while playing
if(difficultySelect){
  difficultySelect.addEventListener('keydown', (e)=>{
    if(e.key && e.key.startsWith('Arrow')){
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

// When Esc is pressed, go to menu page and pause
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape'){ if(gameRunning) pauseGame(); stopGameMusic(); window.location.href = 'menu.html'; } });

// Theme handling (existing)
function applyTheme(theme){ if(theme === 'dark'){ document.body.classList.add('dark'); if(themeToggle) { themeToggle.textContent = 'Light'; themeToggle.setAttribute('aria-pressed','true'); } } else { document.body.classList.remove('dark'); if(themeToggle) { themeToggle.textContent = 'Dark'; themeToggle.setAttribute('aria-pressed','false'); } } localStorage.setItem('snakeTheme', theme); }
const savedTheme = localStorage.getItem('snakeTheme') || 'light'; applyTheme(savedTheme);
if(themeToggle){ themeToggle.addEventListener('click', ()=>{ const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark'; applyTheme(newTheme); }); }

// init
clearCanvas(); drawSnake(); if(bestEl) bestEl.textContent = 'Best: ' + bestScore; populateRecordsTable();
