const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');

let snake = [ {x:150,y:150}, {x:140,y:150}, {x:130,y:150}, {x:120,y:150}, {x:110,y:150} ];
let dx = 10; let dy = 0;
let foodX = 0; let foodY = 0;
let score = 0;
let bestScore = parseInt(localStorage.getItem('snakeBest')) || 0;
let changingDirection = false;
let gameRunning = false;

function clearCanvas(){ ctx.fillStyle='white'; ctx.strokeStyle='black'; ctx.fillRect(0,0,gameCanvas.width,gameCanvas.height); ctx.strokeRect(0,0,gameCanvas.width,gameCanvas.height); }
function drawSnakePart(part){ ctx.fillStyle='lightgreen'; ctx.strokeStyle='darkgreen'; ctx.fillRect(part.x, part.y, 10,10); ctx.strokeRect(part.x, part.y,10,10); }
function drawSnake(){ snake.forEach(drawSnakePart); }
function advanceSnake(){ const head = {x: snake[0].x + dx, y: snake[0].y + dy}; snake.unshift(head);
  const didEatFood = head.x === foodX && head.y === foodY;
  if(didEatFood){ score += 10; scoreEl.textContent = 'Score: ' + score; createFood(); } else { snake.pop(); }
}
function changeDirection(event){ const LEFT=37, UP=38, RIGHT=39, DOWN=40; if(changingDirection) return; changingDirection = true;
  const key = event.keyCode; const goingUp = dy === -10; const goingDown = dy === 10; const goingLeft = dx === -10; const goingRight = dx === 10;
  if(key === LEFT && !goingRight){ dx = -10; dy = 0; }
  if(key === UP && !goingDown){ dx = 0; dy = -10; }
  if(key === RIGHT && !goingLeft){ dx = 10; dy = 0; }
  if(key === DOWN && !goingUp){ dx = 0; dy = 10; }
}
function randomTen(min, max){ return Math.round((Math.random()*(max-min)+min)/10)*10; }
function createFood(){ foodX = randomTen(0, gameCanvas.width-10); foodY = randomTen(0, gameCanvas.height-10);
  snake.forEach(function isOnSnake(part){ if(part.x === foodX && part.y === foodY) createFood(); }); }
function drawFood(){ ctx.fillStyle='red'; ctx.strokeStyle='darkred'; ctx.fillRect(foodX,foodY,10,10); ctx.strokeRect(foodX,foodY,10,10); }
function didGameEnd(){ for(let i=4;i<snake.length;i++){ if(snake[i].x===snake[0].x && snake[i].y===snake[0].y) return true; }
  const hitLeft = snake[0].x < 0; const hitRight = snake[0].x > gameCanvas.width - 10; const hitTop = snake[0].y < 0; const hitBottom = snake[0].y > gameCanvas.height - 10;
  return hitLeft || hitRight || hitTop || hitBottom;
}

function main(){ if(!gameRunning) return; if(didGameEnd()){ gameRunning = false; updateBestIfNeeded(); alert('Game over! Score: ' + score + ' — Best: ' + bestScore); return; }
  setTimeout(function onTick(){ changingDirection = false; clearCanvas(); drawFood(); advanceSnake(); drawSnake(); main(); }, 100);
}

function startGame(){ if(gameRunning) return; gameRunning = true; score = 0; scoreEl.textContent = 'Score: ' + score; createFood(); main(); }
function pauseGame(){ gameRunning = false; }
function restartGame(){ gameRunning = false; snake = [ {x:150,y:150}, {x:140,y:150}, {x:130,y:150}, {x:120,y:150}, {x:110,y:150} ]; dx = 10; dy = 0; score = 0; scoreEl.textContent = 'Score: ' + score; clearCanvas(); drawSnake(); }

document.addEventListener('keydown', changeDirection);
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
restartBtn.addEventListener('click', restartGame);

clearCanvas(); drawSnake();

// initialize best score display
if(bestEl) bestEl.textContent = 'Best: ' + bestScore;

function updateBestIfNeeded(){ if(score > bestScore){ bestScore = score; localStorage.setItem('snakeBest', bestScore); if(bestEl) bestEl.textContent = 'Best: ' + bestScore; } }
