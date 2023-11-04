'use strict';
console.clear();
const UIS = 48;

/* --- canvas initialisation --- */

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width = innerWidth;
canvas.height = innerHeight - UIS / 4;

/* --- VARIABLES --- */

let MIN_PONG_SPEED = 4;
let MAX_PONG_COUNT = 5;

let gameScore = 0;
let gameStartTS = Date.now();

let playerPad = {
	x: canvas.width - UIS / 2,
	y: canvas.height - 280,
	w: UIS / 4,
	h: canvas.height / 8,
	velocityRotation: 0,
	velocityY: 0,
};
let botPad = {
	x: UIS / 2,
	y: canvas.height - 280,
	w: UIS / 4,
	h: canvas.height / 8,
	velocityY: 0,
	tgpong: undefined,
};
let goals = {
	bot: {
		count: 0,
		newGoal: {
			_bool: true,
			i: 0,
		},
	},
	player: {
		count: 0,
		newGoal: {
			_bool: false,
			i: 0,
		},
	},
};

let bouncersExtraRadius = {
	top: 0,
	bottom: 0,
};

let pong = [];
let collisionMap = [];

/* --- REUSABLE FUNCTIONS --- */

let ctxS = {
	clearRect: function () {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	},
	fillText: function (text = 'DEFAULT TEXT', fillStyle = '#FFF', fontSize = 36, x = 0, y = 0, alignStyle = 'c') {
		ctx.font = `${fontSize}px DotGothic16`;
		ctx.fillStyle = fillStyle;

		let boundingBox = ctx.measureText(text);
		switch (alignStyle) {
			case 'tl':
				ctx.fillText(text, x, y + boundingBox.actualBoundingBoxAscent + boundingBox.actualBoundingBoxDescent);
				break;
			case 'tr':
				ctx.fillText(text, x - boundingBox.width, y + boundingBox.actualBoundingBoxAscent + boundingBox.actualBoundingBoxDescent);
				break;
			case 'c':
				ctx.fillText(text, x - boundingBox.width / 2, y + (boundingBox.actualBoundingBoxAscent + boundingBox.actualBoundingBoxDescent) / 2);
				break;

			default:
				ctx.fillText(text, x, y);
				console.error(`unknown 'alignStyle' argument: ${alignStyle}`);
				break;
		}
	},
	fillRect: function (x, y, w, h, fillStyle, rotation = 0) {
		ctx.fillStyle = fillStyle;
		ctx.translate(x + w / 2, y + h / 2);
		ctx.rotate(rotation);
		ctx.fillRect(-w / 2, -h / 2, w, h);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	},
	fillCirc: function (x, y, r, fillStyle) {
		ctx.fillStyle = fillStyle;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2, false);
		ctx.fill();
	},
};

let tools = {
	isOutOfBound: function (x, y, w, h, isScreenWalls, x2, y2, w2, h2) {
		if (isScreenWalls) return Math.abs(x + w / 2 - canvas.width / 2) > (canvas.width + w) / 2 || Math.abs(y + h / 2 - canvas.height / 2) > (canvas.height + h) / 2;
		else return false;
	},
	isBumpingBound: function (x, y, w, h, isScreenWalls, x2, y2, w2, h2) {
		if (isScreenWalls) return Math.abs(x + w / 2 - canvas.width / 2) > (canvas.width - w) / 2 || Math.abs(y + h / 2 - canvas.height / 2) > (canvas.height - h) / 2;
		else return false;
	},
	sleep: function (ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	},
};

/* --- GAME --- */

async function intro() {
	let n = 0;
	let pixelizedWordArray = [];
	let PIXEL_SIZE = 0;

	async function animateTitle() {
		ctxS.clearRect();
		ctxS.fillText('NOT BORING PONG', `#FFF${n.toString(16)}`, 156 - n * 6, canvas.width / 2, canvas.height / 2, 'c');

		if (n == 16) {
			console.log('done');

			await tools.sleep(1000);

			ctx.font = `${159 - n * 6}px DotGothic16`;
			let boundingBox = ctx.measureText('NOT BORING PONG');
			scanAndPixelize('NOT BORING PONG', canvas.width / 2 - boundingBox.width / 2, canvas.height / 2 + (boundingBox.actualBoundingBoxAscent + boundingBox.actualBoundingBoxDescent) / 2, boundingBox);
		} else {
			n++;
			requestAnimationFrame(animateTitle);
		}
	}

	function scanAndPixelize(text, xStart, yStart, boundingBox) {
		PIXEL_SIZE = (boundingBox.actualBoundingBoxAscent + boundingBox.actualBoundingBoxDescent) / 13;
		let x = xStart - PIXEL_SIZE / 2 + 6;
		let y = yStart - PIXEL_SIZE / 2;

		console.log(boundingBox.width / 13);

		for (let i = 0; i < (Math.floor(boundingBox.width / PIXEL_SIZE) - 4) * 2; i++) {
			for (let j = 0; j < 12; j++) {
				const data = ctx.getImageData(x, y, 1, 1).data;
				const rgb = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
				if (rgb == 'rgb(255, 255, 255)') pixelizedWordArray.push({ x: x, y: y, a: Math.random() * Math.PI * 2 });
				y -= PIXEL_SIZE;
			}
			x += PIXEL_SIZE / 1.5;
			y = yStart - PIXEL_SIZE / 2;
		}
		console.log(pixelizedWordArray);

		n = 0;
		pongOutro();
	}

	async function pongOutro() {
		ctxS.clearRect();
		for (let i = 0; i < pixelizedWordArray.length; i++) {
			if (pixelizedWordArray[i] == undefined) continue;

			let pixelX = pixelizedWordArray[i].x;
			let pixelY = pixelizedWordArray[i].y;
			ctx.fillStyle = '#FFF';
			ctx.fillRect(pixelX, pixelY, PIXEL_SIZE, PIXEL_SIZE);

			if (n * 5 >= i) {
				let angle = pixelizedWordArray[i].a;
				pixelizedWordArray[i].a = pixelizedWordArray[i].a - 0.01;
				pixelizedWordArray[i].x = pixelX + (Math.cos(angle) * Math.max(canvas.width, canvas.height)) / 200;
				pixelizedWordArray[i].y = pixelY + (Math.sin(angle) * Math.max(canvas.width, canvas.height)) / 200;
				if (tools.isOutOfBound(pixelX, pixelY, PIXEL_SIZE, PIXEL_SIZE, true)) {
					delete pixelizedWordArray[i];
					pixelizedWordArray = pixelizedWordArray.filter((item) => !!item);
				}
			}
		}

		n++;
		if (pixelizedWordArray.length > 0) requestAnimationFrame(pongOutro);
		else {
			ctxS.clearRect();
			await tools.sleep(1000);
			game();
		}
	}

	animateTitle();
}

document.addEventListener('mousemove', function (e) {
	const NEW_Y = Math.max(Math.min(e.offsetY - playerPad.h / 2, canvas.height - playerPad.h - UIS * 1.414), UIS * 1.414);
	playerPad.velocityY = playerPad.y - NEW_Y;
	playerPad.y = NEW_Y;
});

function game() {
	ctxS.fillRect(0, 0, canvas.width, canvas.height, '#0008');

	if (MIN_PONG_SPEED < 9) MIN_PONG_SPEED += 0.0015;
	if (Math.floor((Date.now() - gameStartTS) / 10000) - pong.length > 0 && pong.length < MAX_PONG_COUNT) addPong(1);

	drawBoard();
	drawPads();
	pongPhysics();

	requestAnimationFrame(game);
}

function drawBoard() {
	// timer
	const secondsSince = Math.max(Math.floor((180 - (Date.now() - gameStartTS) / 1000) % 60), 0);
	const minutesSince = Math.max(Math.floor(3 - (Date.now() - gameStartTS) / 60000), 0);
	ctxS.fillText(`${minutesSince.toString().padStart(2, '0')}${secondsSince % 2 == 0 ? ':' : ' '}${secondsSince.toString().padStart(2, '0')}`, '#FFD', 36, canvas.width - UIS * 1.414 - 5, 5, 'tr');
	// goals
	ctxS.fillText(`${goals.bot.count} goal${goals.bot.count > 1 ? 's' : ''}`, '#FFD', 36 + goals.bot.newGoal._bool * Math.sin(goals.bot.newGoal.i++ * (Math.PI / 18)) * 10, canvas.width / 2 - UIS - 5, 5, 'tr');
	ctxS.fillText(`${goals.player.count} goal${goals.player.count > 1 ? 's' : ''}`, '#FFD', 36 + goals.player.newGoal._bool * Math.sin(goals.player.newGoal.i++ * (Math.PI / 18)) * 10, canvas.width / 2 + UIS + 5, 5, 'tl');
	if (goals.bot.newGoal._bool && goals.bot.newGoal.i > 18) goals.bot.newGoal._bool = false;
	if (goals.player.newGoal._bool && goals.player.newGoal.i > 18) goals.player.newGoal._bool = false;

	// middle lines
	for (let i = 0; i < Math.ceil(canvas.height / UIS); i++) {
		ctxS.fillRect((canvas.width - UIS / 5) / 2, (i - 0.25) * UIS + (canvas.height % UIS) / 2, UIS / 5, UIS / 2);
	}

	// top and bottom bouncers
	ctxS.fillCirc(canvas.width / 2, 0, UIS + bouncersExtraRadius.top, '#FFD');
	ctxS.fillCirc(canvas.width / 2, canvas.height, UIS + bouncersExtraRadius.bottom, '#FFD');
	bouncersExtraRadius.top *= 0.85;
	bouncersExtraRadius.bottom *= 0.85;

	// corners wedge
	ctxS.fillRect(-UIS, -UIS, 2 * UIS, 2 * UIS, '#FFF', Math.PI / 4);
	ctxS.fillRect(canvas.width - UIS, -UIS, 2 * UIS, 2 * UIS, '#FFF', Math.PI / 4);
	ctxS.fillRect(-UIS, canvas.height - UIS, 2 * UIS, 2 * UIS, '#FFF', Math.PI / 4);
	ctxS.fillRect(canvas.width - UIS, canvas.height - UIS, 2 * UIS, 2 * UIS, '#FFF', Math.PI / 4);
}

function drawPads() {
	// playerPad
	playerPad.velocityRotation = Math.min(Math.max(playerPad.velocityRotation / 1.75 + playerPad.velocityY / 100, -Math.PI / 16), Math.PI / 16);
	playerPad.velocityY = 0;
	ctxS.fillRect(playerPad.x, playerPad.y, playerPad.w, playerPad.h, 'white', playerPad.velocityRotation);

	// botPad
	if (botPad.tgpong == undefined) botPad.tgpong = pong[0];
	let mostLeft = Infinity;
	for (let i = 1; i < Math.ceil(collisionMap[0].length / 2); i++) {
		for (let j = 0; j < collisionMap.length; j++) {
			const cell = collisionMap[j][i];
			if (cell.length == 0) continue;
			if (cell[0].x < mostLeft) {
				botPad.tgpong = cell[0];
				mostLeft = cell[0].x;
			}
		}
		if (mostLeft != Infinity) break;
	}
	botPad.velocityY = Math.min(Math.max(((botPad.tgpong.y - botPad.y - botPad.h / 2 + botPad.tgpong.s / 2) / 20 + botPad.velocityY) * 0.8, -200), 200);
	botPad.y = Math.max(Math.min(botPad.y + botPad.velocityY, canvas.height - playerPad.h - UIS * 1.414), UIS * 1.414);
	//botPad.y = botPad.tgpong.y;
	ctxS.fillRect(botPad.x, botPad.y, botPad.w, botPad.h, 'white');
}

//tgpong.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');
function pongPhysics() {
	for (let i = 0; i < pong.length; i++) {
		let tgpong = pong[i];

		// exit if pong does not move
		if (tgpong.motionless._bool) {
			const exs = tgpong.motionless.extraSize;
			ctxS.fillRect(tgpong.x - exs / 2, tgpong.y - exs / 2, tgpong.s + exs, tgpong.s + exs, tgpong.fillStyle + Math.floor(tgpong.motionless.opacity * 16).toString(16));
			tgpong.motionless.extraSize -= 2;
			tgpong.motionless.opacity += 0.05;
			if (tgpong.motionless.extraSize <= 0) {
				tgpong.motionless._bool = false;
				tgpong.motionless.extraSize = 0;
				tgpong.motionless.opacity = 1;
			}
			continue;
		}

		// draw pong
		ctxS.fillRect(tgpong.x, tgpong.y, tgpong.s, tgpong.s, tgpong.fillStyle);

		// move pong
		tgpong.x = Math.min(Math.max(tgpong.x + Math.cos(tgpong.a) * tgpong.v, -64), Math.ceil(canvas.width / 64) * 65);
		tgpong.y = Math.min(Math.max(tgpong.y + Math.sin(tgpong.a) * tgpong.v, -64), Math.ceil(canvas.height / 64) * 65);
		tgpong.v = Math.min(Math.max((tgpong.v - MIN_PONG_SPEED) / 1.025 + MIN_PONG_SPEED, MIN_PONG_SPEED), 40);

		// bounce off wall/wedge/bouncers if applies
		if (Math.abs(tgpong.y + tgpong.s / 2 - canvas.height / 2) > (canvas.height - tgpong.s) / 2) {
			tgpong.y = Math.min(Math.max(tgpong.y, 0), canvas.height - tgpong.s);
			tgpong.a = Math.PI * 2 - tgpong.a;
		}
		if (tgpong.y < -tgpong.x + UIS * 1.414) {
			// top left
			tgpong.a = Math.PI * 1.5 - tgpong.a;
			const incrX = -tgpong.y + UIS * 1.414;
			const incrY = -tgpong.x + UIS * 1.414;
			tgpong.x += incrX - tgpong.x + 1;
			tgpong.y += incrY - tgpong.y + 1;
		} else if (tgpong.y < tgpong.x + tgpong.s - canvas.width + UIS * 1.414) {
			// top right
			tgpong.a = Math.PI * 0.5 - tgpong.a;
			const incrX = tgpong.y - tgpong.s + canvas.width - UIS * 1.414;
			const incrY = tgpong.x + tgpong.s - canvas.width + UIS * 1.414;
			tgpong.x += incrX - tgpong.x + 1;
			tgpong.y += incrY - tgpong.y + 1;
		} else if (tgpong.y + tgpong.s > tgpong.x + canvas.height - UIS * 1.414) {
			// bottom left
			tgpong.a = Math.PI * 0.5 - tgpong.a;
			const incrX = tgpong.y + tgpong.s - canvas.height + UIS * 1.414;
			const incrY = tgpong.x - tgpong.s + canvas.height - UIS * 1.414;
			tgpong.x += incrX - tgpong.x + 1;
			tgpong.y += incrY - tgpong.y + 1;
		} else if (tgpong.y + tgpong.s > -tgpong.x - tgpong.s + canvas.width + canvas.height - UIS * 1.414) {
			// bottom right
			tgpong.a = Math.PI * 1.5 - tgpong.a;
			const incrX = -tgpong.y - tgpong.s * 2 + canvas.width + canvas.height - UIS * 1.414;
			const incrY = -tgpong.x - tgpong.s * 2 + canvas.width + canvas.height - UIS * 1.414;
			tgpong.x += incrX - tgpong.x + 1;
			tgpong.y += incrY - tgpong.y + 1;
		}
		const a = Math.abs(tgpong.x + tgpong.s / 2 - canvas.width / 2);
		const b = Math.abs(tgpong.y + tgpong.s / 2 - canvas.height / 2) - canvas.height / 2;
		const c = Math.sqrt(a * a + b * b);
		const r = UIS + (tgpong.s * 1.414 + tgpong.s) / 4;
		if (c < r) {
			//tgpong.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');
			if (tgpong.y + tgpong.s / 2 < canvas.height / 2) {
				const angleToBouncer = Math.atan2(tgpong.y + tgpong.s / 2, tgpong.x + tgpong.s / 2 - canvas.width / 2);
				tgpong.a = 2 * (angleToBouncer - Math.PI / 2) - tgpong.a;
				tgpong.x = Math.cos(angleToBouncer) * (r + 2) + canvas.width / 2 - tgpong.s / 2;
				tgpong.y = Math.sin(angleToBouncer) * (r + 2) - tgpong.s / 2;
				bouncersExtraRadius.top += 20;
			} else {
				const angleToBouncer = Math.atan2(tgpong.y + tgpong.s / 2 - canvas.height, tgpong.x + tgpong.s / 2 - canvas.width / 2);
				tgpong.a = 2 * (angleToBouncer - Math.PI / 2) - tgpong.a;
				tgpong.x = Math.cos(angleToBouncer) * (r + 2) + canvas.width / 2 - tgpong.s / 2;
				tgpong.y = Math.sin(angleToBouncer) * (r + 2) + canvas.height - tgpong.s / 2;
				bouncersExtraRadius.bottom += 20;
			}
			tgpong.v += 7;
		}

		// collision with pad
		let realPongX = tgpong.x + tgpong.s / 2;
		let realPongY = tgpong.y + tgpong.s / 2;
		let realPlatfX = playerPad.x + playerPad.w / 2;
		let realPlatfY = playerPad.y + playerPad.h / 2;
		if (Math.abs(realPongY - realPlatfY) < (tgpong.s + playerPad.h) / 2 && Math.abs(realPongX - realPlatfX) < (tgpong.s + playerPad.w) / 2) {
			const SIDE_COLLISION_DEEPNESS = playerPad.w / 2 - Math.abs(tgpong.x + tgpong.s / 2 - (playerPad.x + playerPad.w / 2));
			const LEVEL_COLLISION_DEEPNESS = playerPad.h / 2 - Math.abs(tgpong.y + tgpong.s / 2 - (playerPad.y + playerPad.h / 2));
			if (SIDE_COLLISION_DEEPNESS > LEVEL_COLLISION_DEEPNESS) {
				tgpong.a = playerPad.velocityRotation * 2 - tgpong.a + Math.PI * 2;
				if (tgpong.y + tgpong.s / 2 < playerPad.y + playerPad.h / 2) tgpong.y = playerPad.y - tgpong.s;
				else tgpong.y = playerPad.y + playerPad.h;
			} else {
				tgpong.a = (playerPad.velocityRotation + Math.PI / 2) * 2 - tgpong.a;
				tgpong.v += 1 + Math.abs(playerPad.velocityRotation) * 5;
				if (tgpong.x + tgpong.s / 2 < playerPad.x + playerPad.w / 2) tgpong.x = playerPad.x - tgpong.s;
				else tgpong.x = playerPad.x + playerPad.w;
			}
		}
		realPlatfX = botPad.x + botPad.w / 2;
		realPlatfY = botPad.y + botPad.h / 2;
		if (Math.abs(realPongY - realPlatfY) < (tgpong.s + botPad.h) / 2 && Math.abs(realPongX - realPlatfX) < (tgpong.s + botPad.w) / 2) {
			const SIDE_COLLISION_DEEPNESS = botPad.w / 2 - Math.abs(tgpong.x + tgpong.s / 2 - (botPad.x + botPad.w / 2));
			const LEVEL_COLLISION_DEEPNESS = botPad.h / 2 - Math.abs(tgpong.y + tgpong.s / 2 - (botPad.y + botPad.h / 2));
			if (SIDE_COLLISION_DEEPNESS > LEVEL_COLLISION_DEEPNESS) {
				tgpong.a = 0 - tgpong.a + Math.PI * 2;
				if (tgpong.y + tgpong.s / 2 < botPad.y + botPad.h / 2) tgpong.y = botPad.y - tgpong.s;
				else tgpong.y = botPad.y + botPad.h;
			} else {
				tgpong.a = Math.PI - tgpong.a;
				tgpong.v += 1;
				if (tgpong.x + tgpong.s / 2 < botPad.x + botPad.w / 2) tgpong.x = botPad.x - tgpong.s;
				else tgpong.x = botPad.x + botPad.w;
			}
		}

		// log into collision table
		const ocmi = collisionMap[tgpong.ogy][tgpong.ogx].indexOf(tgpong);
		collisionMap[tgpong.ogy][tgpong.ogx].splice(ocmi, 1);

		[tgpong.ogx, tgpong.ogy] = [tgpong.gx, tgpong.gy];
		[tgpong.gx, tgpong.gy] = [Math.floor(tgpong.x / 64) + 1, Math.floor(tgpong.y / 64) + 1];

		collisionMap[tgpong.gy][tgpong.gx].push(tgpong);

		// execute collisions
		let cannotCollideWith = [];
		for (let i = -1; i <= 1; i++) {
			const arrLine = collisionMap[tgpong.gy + i];
			if (arrLine != undefined) {
				for (let j = -1; j <= 1; j++) {
					const collisionCell = arrLine[tgpong.gx + j];
					if (collisionCell != undefined) {
						collisionCell.forEach((otherPong) => {
							if (otherPong != tgpong && !otherPong.motionless._bool && otherPong.pongID > tgpong.pongID && !tgpong.cannotCollideWith.includes(otherPong.pongID)) {
								if (Math.abs(otherPong.x + otherPong.s - (tgpong.x + tgpong.s)) < (otherPong.s + tgpong.s) / 2 && Math.abs(otherPong.y + otherPong.s - (tgpong.y + tgpong.s)) < (otherPong.s + tgpong.s) / 2) {
									const MY_OLD_A = tgpong.a;
									const MY_OLD_X = tgpong.x;
									const MY_OLD_Y = tgpong.y;

									const SIDE_COLLISION_DEEPNESS = (otherPong.s + tgpong.s) / 2 - Math.abs(otherPong.x + otherPong.s - (tgpong.x + tgpong.s));
									const LEVEL_COLLISION_DEEPNESS = (otherPong.s + tgpong.s) / 2 - Math.abs(otherPong.y + otherPong.s - (tgpong.y + tgpong.s));

									if (SIDE_COLLISION_DEEPNESS > LEVEL_COLLISION_DEEPNESS) {
										const a1 = ((MY_OLD_A % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
										const a2 = ((otherPong.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
										tgpong.a = Math.atan(Math.sin(otherPong.a) / Math.cos(MY_OLD_A)) + (a1 > 0.5 * Math.PI && a1 < 1.5 * Math.PI) * Math.PI;
										otherPong.a = Math.atan(Math.sin(MY_OLD_A) / Math.cos(otherPong.a)) + (a2 > 0.5 * Math.PI && a2 < 1.5 * Math.PI) * Math.PI;

										if (otherPong.y < tgpong.y) {
											//otherPong.y = tgpong.y - otherPong.s;
											otherPong.y -= LEVEL_COLLISION_DEEPNESS / 2 + 1;
											tgpong.y += LEVEL_COLLISION_DEEPNESS / 2 + 1;
										} else {
											//otherPong.y = tgpong.y + tgpong.s;
											otherPong.y += LEVEL_COLLISION_DEEPNESS / 2 + 1;
											tgpong.y -= LEVEL_COLLISION_DEEPNESS / 2 + 1;
										}
									} else {
										tgpong.a = Math.atan(Math.sin(MY_OLD_A) / Math.cos(otherPong.a)) + (tgpong.x < otherPong.x) * Math.PI;
										otherPong.a = Math.atan(Math.sin(otherPong.a) / Math.cos(MY_OLD_A)) + (tgpong.x > otherPong.x) * Math.PI;

										if (otherPong.x + otherPong.s / 2 < tgpong.x + tgpong.s / 2) {
											//otherPong.x = tgpong.x - otherPong.s;
											otherPong.x -= SIDE_COLLISION_DEEPNESS / 2 + 1;
											tgpong.x += SIDE_COLLISION_DEEPNESS / 2 + 1;
										} else {
											//otherPong.x = tgpong.x + tgpong.s;
											otherPong.x += SIDE_COLLISION_DEEPNESS / 2 + 1;
											tgpong.x -= SIDE_COLLISION_DEEPNESS / 2 + 1;
										}
									}
									//tgpong.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');

									cannotCollideWith.push(otherPong.pongID);
								}
							}
						});
					}
				}
			}
		}
		tgpong.cannotCollideWith = cannotCollideWith;

		// if outsite reset pong
		if (tools.isOutOfBound(tgpong.x, tgpong.y, tgpong.s, tgpong.s, true)) {
			if (tgpong.x > canvas.width / 2) goals.bot.count++;
			else goals.player.count++;

			goals.bot.newGoal._bool = true;
			goals.bot.newGoal.i = 0;

			tgpong.s = Math.random() * 20 + 32;
			tgpong.x = canvas.width / 2 - tgpong.s / 2;
			tgpong.y = canvas.height / 2 - tgpong.s / 2;
			tgpong.a = Math.random() * Math.PI * 2;
			tgpong.motionless = { _bool: true, extraSize: 40, opacity: 0 };
		}
	}
}

function addPong(times = 1) {
	for (let i = 0; i < times; i++) {
		const randomAngle = 2 * Math.PI * Math.random();
		let idx = pong.push({
			x: canvas.width / 2 - 16, // + Math.cos(randomAngle) * 100,
			y: canvas.height / 2 - 16, // + Math.sin(randomAngle) * 100,
			gx: Math.floor(canvas.width / 2 / 64) + 1,
			gy: Math.floor(canvas.height / 2 / 64) + 1,
			ogx: Math.floor(canvas.width / 2 / 64) + 1,
			ogy: Math.floor(canvas.height / 2 / 64) + 1,
			s: Math.random() * 20 + 32,
			a: randomAngle + Math.PI,
			v: 5,
			motionless: {
				_bool: true,
				extraSize: 40,
				opacity: 0,
			},
			pongID: pong.length,
			fillStyle: '#FFF',
			cannotCollideWith: [],
		});

		collisionMap[pong[idx - 1].gy][pong[idx - 1].gx].push(pong[idx - 1]);
	}
}

/* --- LOAD FONT, THEN KICKSTART GAME --- */

ctx.font = '60px Arial';
ctx.fillText('LOADING...', 0, canvas.height);

const F = new FontFace('DotGothic16', 'url(./DotGothic16/DotGothic16-Regular.ttf)');
F.load().then((font) => {
	document.fonts.add(font);
	ctxS.clearRect();
	console.log('font ready');

	for (let i = 0; i < Math.ceil(canvas.height / 64) + 2; i++) {
		collisionMap.push([]);
		for (let j = 0; j < Math.ceil(canvas.width / 64) + 2; j++) {
			collisionMap[i].push([]);
		}
	}

	addPong(1);
	game();
});
