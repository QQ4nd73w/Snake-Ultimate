const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const themeToggle = document.getElementById('themeToggle');

let snake = [ {x:150,y:150}, {x:140,y:150}, {x:130,y:150}, {x:120,y:150}, {x:110,y:150} ];
let dx = 10, dy = 0;
let foodX = 0, foodY = 0;
let score = 0;
let bestScore = parseInt(localStorage.getItem('snakeBest')) || 0;
let changingDirection = false;
let gameRunning = false;

let prevSnake = null;
let animStart = 0;
const tickInterval = 100;
let lastTick = 0;
let animating = false;
let lastEaten = null;

function clearCanvas(){
  const dark = document.body.classList.contains('dark');
  ctx.fillStyle = dark ? '#071126' : 'white';
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'black';
  ctx.fillRect(0,0,gameCanvas.width,gameCanvas.height);
  ctx.strokeRect(0,0,gameCanvas.width,gameCanvas.height);
}

function drawSnakePartAt(x,y){
  const dark = document.body.classList.contains('dark');
  ctx.fillStyle = dark ? '#7ee7c7' : 'lightgreen';
  ctx.strokeStyle = dark ? '#0b5a51' : 'darkgreen';
  ctx.fillRect(x,y,10,10); ctx.strokeRect(x,y,10,10);
}

function drawSnake(){ snake.forEach(p => drawSnakePartAt(p.x,p.y)); }

function randomTen(min,max){ return Math.round((Math.random()*(max-min)+min)/10)*10; }
function createFood(){
  foodX = randomTen(0, gameCanvas.width-10);
  foodY = randomTen(0, gameCanvas.height-10);
  snake.forEach(function isOnSnake(part){ if(part.x === foodX && part.y === foodY) createFood(); });
}

function drawFood(now){
  const size = 10;
  if(lastEaten){
    const dt = now - lastEaten.start; const dur = 300;
    if(dt < dur){ const t = dt/dur; const scale = 1 + 0.8*(1-t); const cx = lastEaten.x + size/2; const cy = lastEaten.y + size/2;
      ctx.beginPath(); ctx.fillStyle = `rgba(255,100,100,${1-t})`; ctx.arc(cx, cy, (size/2)*scale, 0, Math.PI*2); ctx.fill(); ctx.closePath();
    }
  }
  const dark = document.body.classList.contains('dark');
  ctx.fillStyle = dark ? '#ff9b9b' : 'red'; ctx.strokeStyle = dark ? '#ff6b6b' : 'darkred'; ctx.fillRect(foodX,foodY,size,size); ctx.strokeRect(foodX,foodY,size,size);
}

function advanceSnake(){
  const head = {x: snake[0].x + dx, y: snake[0].y + dy};
  snake.unshift(head);
  const didEatFood = head.x === foodX && head.y === foodY;
  if(didEatFood){ score += 10; scoreEl.textContent = 'Score: ' + score; } else { snake.pop(); }
  return didEatFood;
}

function changeDirection(event){
  const LEFT=37, UP=38, RIGHT=39, DOWN=40;
  if(changingDirection) return;
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
  if(animating && prevSnake){
    const t = Math.min(1, (now - animStart) / tickInterval);
    for(let i=0;i<snake.length;i++){
      const prev = prevSnake[i] || prevSnake[prevSnake.length-1];
      const cur = snake[i] || snake[snake.length-1];
      const x = prev.x + (cur.x - prev.x) * t;
      const y = prev.y + (cur.y - prev.y) * t;
      drawSnakePartAt(x,y);
    }
    if(t >= 1) animating = false;
  } else {
    drawSnake();
  }
}

function gameLoop(timestamp){
  if(!gameRunning) return;
  if(didGameEnd()){ gameRunning = false; updateBestIfNeeded(); alert('Game over! Score: ' + score + ' — Best: ' + bestScore); return; }
  if(!lastTick) lastTick = timestamp;
  if(timestamp - lastTick >= tickInterval){
    lastTick = timestamp;
    prevSnake = snake.map(p => ({x:p.x,y:p.y}));
    changingDirection = false;
    const didEat = advanceSnake();
    animStart = timestamp; animating = true;
    if(didEat){ lastEaten = {x: prevSnake[0].x, y: prevSnake[0].y, start: timestamp}; createFood(); }
  }
  render(timestamp);
  requestAnimationFrame(gameLoop);
}

function startGame(){ if(gameRunning) return; gameRunning = true; score = 0; scoreEl.textContent = 'Score: ' + score; createFood(); lastTick = 0; requestAnimationFrame(gameLoop); }
function pauseGame(){ gameRunning = false; }
function restartGame(){ gameRunning = false; snake = [ {x:150,y:150}, {x:140,y:150}, {x:130,y:150}, {x:120,y:150}, {x:110,y:150} ]; dx = 10; dy = 0; score = 0; scoreEl.textContent = 'Score: ' + score; clearCanvas(); drawSnake(); }

document.addEventListener('keydown', changeDirection);
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
restartBtn.addEventListener('click', restartGame);

function applyTheme(theme){ if(theme === 'dark'){ document.body.classList.add('dark'); if(themeToggle) { themeToggle.textContent = 'Light'; themeToggle.setAttribute('aria-pressed','true'); } } else { document.body.classList.remove('dark'); if(themeToggle) { themeToggle.textContent = 'Dark'; themeToggle.setAttribute('aria-pressed','false'); } } localStorage.setItem('snakeTheme', theme); }
const savedTheme = localStorage.getItem('snakeTheme') || 'light'; applyTheme(savedTheme);
if(themeToggle){ themeToggle.addEventListener('click', ()=>{ const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark'; applyTheme(newTheme); }); }

clearCanvas(); drawSnake();
if(bestEl) bestEl.textContent = 'Best: ' + bestScore;

function updateBestIfNeeded(){ if(score > bestScore){ bestScore = score; localStorage.setItem('snakeBest', bestScore); if(bestEl) bestEl.textContent = 'Best: ' + bestScore; } }
