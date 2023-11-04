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

let gameScore = 0;

let playerPad = {
	x: canvas.width - UIS / 2,
	y: canvas.height - 280,
	w: UIS / 4,
	h: canvas.height / 8,
	velocityRotation: 0,
	velocityY: 0,
};

let bouncersExtraRadius = {
	top: 0,
	bottom: 0,
}

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

	if (e.offsetY < e.offsetX - canvas.width + UIS * 1.414) {
		console.log('yes');
	}
});

function game() {
	ctxS.fillRect(0, 0, canvas.width, canvas.height, '#0008');
	drawBoard();
	drawPlayerPad();
	pongPhysics();

	requestAnimationFrame(game);
}

function drawBoard() {
	ctxS.fillText('text', '#FFF', 36, 0, 0);

	// middle lines
	for (let i = 0; i < Math.ceil(canvas.height / UIS); i++) {
		ctxS.fillRect((canvas.width - UIS / 5) / 2, (i - 0.25) * UIS + (canvas.height % UIS) / 2, UIS / 5, UIS / 2);
	}

	// top and bottom bouncers
	ctxS.fillCirc(canvas.width / 2, 0, UIS + bouncersExtraRadius.top, '#FFD');
	ctxS.fillCirc(canvas.width / 2, canvas.height, UIS + bouncersExtraRadius.bottom, '#FFD');
	bouncersExtraRadius.top *= 0.85;
	bouncersExtraRadius.bottom *= 0.85

	// corners wedge
	ctxS.fillRect(-UIS, -UIS, 2 * UIS, 2 * UIS, '#FFF', Math.PI / 4);
	ctxS.fillRect(canvas.width - UIS, -UIS, 2 * UIS, 2 * UIS, '#FFF', Math.PI / 4);
	ctxS.fillRect(-UIS, canvas.height - UIS, 2 * UIS, 2 * UIS, '#FFF', Math.PI / 4);
	ctxS.fillRect(canvas.width - UIS, canvas.height - UIS, 2 * UIS, 2 * UIS, '#FFF', Math.PI / 4);
}

function drawPlayerPad() {
	playerPad.velocityRotation = Math.min(Math.max(playerPad.velocityRotation / 1.75 + playerPad.velocityY / 100, -Math.PI / 16), Math.PI / 16);
	playerPad.velocityY = 0;
	ctxS.fillRect(playerPad.x, playerPad.y, playerPad.w, playerPad.h, 'white', playerPad.velocityRotation);
}

//tgpong.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');
function pongPhysics() {
	for (let i = 0; i < pong.length; i++) {
		let tgpong = pong[i];

		// draw pong
		ctx.fillStyle = tgpong.fillStyle;
		ctx.fillRect(tgpong.x, tgpong.y, tgpong.s, tgpong.s);

		// exit if pong does not move
		if (tgpong.motionless) return null;

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
			tgpong.v += 5;
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
							if (otherPong != tgpong && otherPong.pongID > tgpong.pongID && !tgpong.cannotCollideWith.includes(otherPong.pongID)) {
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
			tgpong.x = canvas.width / 2;
			tgpong.y = canvas.height / 2;
			tgpong.a = Math.random() * Math.PI * 2;
		}
	}
}

function addPong(times = 1) {
	for (let i = 0; i < times; i++) {
		const randomAngle = 2 * Math.PI * Math.random();
		let idx = pong.push({
			x: canvas.width / 2 + Math.cos(randomAngle) * 100,
			y: canvas.height / 2 + Math.sin(randomAngle) * 100,
			gx: Math.floor(canvas.width / 2 / 64) + 1,
			gy: Math.floor(canvas.height / 2 / 64) + 1,
			ogx: Math.floor(canvas.width / 2 / 64) + 1,
			ogy: Math.floor(canvas.height / 2 / 64) + 1,
			s: Math.random() * 20 + 32,
			a: randomAngle + Math.PI,
			v: 5,
			motionless: false,
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

	addPong(20);
	game();
});
