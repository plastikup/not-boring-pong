'use strict';
console.clear();
const UIS = 80;

/* --- canvas initialisation --- */

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width = innerWidth;
canvas.height = innerHeight - UIS / 4;

/* --- OH!DIO --- */

const mouseClick = new Audio('./sfx/mouseClick.mp3');
const paddle = new Audio('./sfx/paddle.mp3');
const collide = new Audio('./sfx/collide.mp3');
const score = new Audio('./sfx/score.mp3');
paddle.volume = 0.5;
score.volume = 0.2;

function playAudio(audioRef) {
	audioRef.currentTime = 0;
	audioRef.play();
}

/* --- VARIABLES --- */

let GAME_ENDED = false;
const previousPB = localStorage.getItem('previousPB') || 0;

let menuSettings = [
	{ description: 'timer', key: 'min', value: 2, max: 4 },
	{ description: 'bot difficulty', key: '/5', value: 2, max: 5 },
	{ description: 'active balls (sus)', key: '', value: 5, max: 10 },
	{ description: 'color theme', key: '', value: Math.round(localStorage.getItem('colorTheme') || 1), max: 3 },
];
canvas.className = menuSettings[3].value == 1 ? 'a' : menuSettings[3].value == 2 ? 'b' : 'c';

let MIN_PONG_SPEED = 5;
let MAX_PONG_COUNT = 5;
const SUPERPOWER_TS_EFFECTIVE = 3000;
let pongIDCount = 0;
let specialsCount = 0;

let gameScore = 0;
let gameStartTS = undefined;

let colorThemes = {
	_current: menuSettings[3].value - 1,
	primary: ['#DFF', '#FDF', '#FA8'],
	secondary: ['#000', '#056', '#369'],
	tertiary: ['#FF0', '#09F', '#DE8'],
};

let playerPad = {
	x: canvas.width - UIS / 2,
	y: canvas.height - 280,
	tgy: canvas.height - 280,
	w: UIS / 4,
	h: canvas.height / 8,
	velocityRotation: 0,
	velocityY: 0,
	superpower: {
		freeze: {
			_bool: false,
			startTS: 0,
		},
		larger: {
			_bool: false,
			extraSize: 0,
		},
		bouncer: {
			_bool: false,
			startTS: 0,
		},
	},
};
let botPad = {
	x: UIS / 2,
	y: canvas.height - 280,
	w: UIS / 4,
	h: canvas.height / 8,
	velocityY: 0,
	tgpong: undefined,
	superpower: {
		freeze: {
			_bool: false,
			startTS: 0,
		},
		larger: {
			_bool: false,
			extraSize: 0,
		},
		bouncer: {
			_bool: false,
			startTS: 0,
		},
	},
};
let goals = {
	bot: {
		count: 0,
		newGoal: {
			_bool: false,
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
let newSuperpowerAnnouncement = {
	_fillStyle: {
		freeze: '#09E',
		larger: '#0D0',
		bouncer: '#FA0',
	},
	bot: {
		_bool: false,
		type: null,
		i: 0,
	},
	player: {
		_bool: false,
		type: null,
		i: 0,
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
	fillText: function (text = 'DEFAULT TEXT', fillStyle = '#EEE', fontSize = 36, x = 0, y = 0, alignStyle = 'c') {
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
	drawImage: function (src, x, y, w, h, opacity) {
		ctx.globalAlpha = opacity;
		ctx.drawImage(src, x, y, w, h);
		ctx.globalAlpha = 1;
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

/* --- MENU/INTRO --- */

let unreadTouchEvents = [];
document.addEventListener('touchstart', (e) => {
	// mobile client
	unreadTouchEvents.push({ x: e.touches[0].clientX, y: e.touches[0].clientY });
	playAudio(mouseClick);
});
document.addEventListener('mousedown', (e) => {
	// computer client
	unreadTouchEvents.push({ x: e.offsetX, y: e.offsetY });
	playAudio(mouseClick);
});

let lastRegisteredMousePosition = [canvas.width / 2, canvas.height / 2];
function menu() {
	let reqNew = true;

	function menuBgAnimation() {
		const ox = (Date.now() / 60) % 128;
		const oy = (Math.sin(Date.now() / 1200) * 32 + Date.now() / 100) % 128;
		for (let i = 0; i <= Math.ceil(canvas.width / 128); i++) {
			const x = i * 128 + ox - 64;
			for (let j = 0; j <= Math.ceil(canvas.height / 128); j++) {
				const y = j * 128 + oy - 64;
				const d = Math.sqrt((lastRegisteredMousePosition[0] - x) ** 2 + (lastRegisteredMousePosition[1] - y) ** 2);
				const w = 20 - Math.max(Math.min(d / 4, 111), 30);
				const h = 20 - Math.max(Math.min(d / 4, 111), 30);
				ctxS.fillRect(x - w / 2, y - h / 2, w, h, colorThemes.tertiary[colorThemes._current] + '2', 2 * Math.sin(Date.now() / 600));
			}
		}
	}

	menuBgAnimation();

	ctxS.fillRect(0, 0, canvas.width, canvas.height, colorThemes.secondary[colorThemes._current] + '6');

	// title
	ctxS.fillText('NOT BORING PONG', colorThemes.primary[colorThemes._current], canvas.height / 10 + Math.sin(Date.now() / 500) * 5, canvas.width / 2, canvas.height / 4 - canvas.height / 16, 'c');

	// sliders
	let ocx = canvas.width / 2;
	let ocy = canvas.height / 2 - canvas.height / 5;
	for (let i = unreadTouchEvents.length - 1; i >= 0; i--) {
		const coord = unreadTouchEvents[i];

		if (Math.abs(canvas.width / 2 - coord.x) <= canvas.width / 10 && Math.abs(ocy + (canvas.height / 9) * 4 + canvas.height / 30 - coord.y) <= canvas.height / 40) {
			reqNew = false;
		} else if (Math.abs(ocx - coord.x) >= canvas.width / 8 + 8 && Math.abs(ocx - coord.x) <= canvas.width / 8 + canvas.height / 32 + 8) {
			if ((coord.y - ocy) % (canvas.height / 9) >= canvas.height / 32 && (coord.y - ocy) % (canvas.height / 9) <= canvas.height / 16) {
				let j = Math.floor((coord.y - ocy) / (canvas.height / 9));
				menuSettings[j].value = Math.max(Math.min(menuSettings[j].value + (coord.x < ocx ? -1 : 1), menuSettings[j].max), 1);
				if (j == 3) {
					colorThemes._current = menuSettings[j].value - 1;
					localStorage.setItem('colorTheme', menuSettings[j].value);
					canvas.className = menuSettings[j].value == 1 ? 'a' : menuSettings[j].value == 2 ? 'b' : 'c';
				}
			}
		}

		unreadTouchEvents.splice(i, 1);
	}
	for (let i = 0; i < 4; i++) {
		ctxS.fillText(`${menuSettings[i].description}: ${menuSettings[i].value}${menuSettings[i].key}`, colorThemes.primary[colorThemes._current] + '7', canvas.height / 36, ocx, ocy, 'c');

		ctxS.fillRect(ocx - canvas.width / 8 - canvas.height / 32 - 8, ocy + canvas.height / 32, canvas.height / 32, canvas.height / 32, colorThemes.primary[colorThemes._current]);
		ctxS.fillRect(ocx + canvas.width / 8 + 8, ocy + canvas.height / 32, canvas.height / 32, canvas.height / 32, colorThemes.primary[colorThemes._current]);

		ctxS.fillText('  - :', colorThemes.secondary[colorThemes._current], canvas.height / 32, ocx - canvas.width / 8 - canvas.height / 64 - 8, ocy + canvas.height / 32 + canvas.height / 64, 'c');
		ctxS.fillText('+', colorThemes.secondary[colorThemes._current], canvas.height / 32, ocx + canvas.width / 8 + canvas.height / 64 + 8, ocy + canvas.height / 32 + canvas.height / 64, 'c');

		const subdivis = menuSettings[i].max;
		for (let j = 0; j < subdivis; j++) {
			ctxS.fillRect(ocx - canvas.width / 8 + (canvas.width / 4 / subdivis) * j, ocy + canvas.height / 32, canvas.width / 4 / subdivis - 2, canvas.height / 32, j < menuSettings[i].value ? colorThemes.tertiary[colorThemes._current] : colorThemes.primary[colorThemes._current] + '1');
		}

		ocy += canvas.height / 9;
	}

	// play button
	ctxS.fillText('>> PLAY <<', colorThemes.tertiary[colorThemes._current], canvas.height / 20 + Math.sin(Date.now() / -500) * 5, canvas.width / 2, ocy + canvas.height / 30, 'c');

	if (reqNew) requestAnimationFrame(menu);
	else {
		gameStartTS = Date.now() + 999;
		MAX_PONG_COUNT = menuSettings[2].value;
		addPong(1);
		game();
	}
}

/* --- GAME --- */

document.addEventListener('mousemove', (e) => onMove(e.offsetX, e.offsetY, true)); // computer client
document.addEventListener('touchmove', (e) => onMove(undefined, e.touches[0].clientY, false)); // mobile client

function onMove(xTouch, yTouch, save) {
	if (save) lastRegisteredMousePosition = [xTouch, yTouch];
	if (!playerPad.superpower.freeze._bool) {
		const playerExtraSize = playerPad.superpower.larger._bool * playerPad.superpower.larger.extraSize;
		playerPad.tgy = yTouch - (playerPad.h + playerExtraSize) / 2;
	}
}

function game() {
	//tgpong.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padEnd(6, '0');
	ctxS.fillRect(0, 0, canvas.width, canvas.height, colorThemes.secondary[colorThemes._current] + '8');

	if (MIN_PONG_SPEED < 9) MIN_PONG_SPEED += 0.0015;
	if (Math.floor((Date.now() - gameStartTS) / 15000) + 1 - (pong.length - specialsCount) > 0 && pong.length - specialsCount < MAX_PONG_COUNT) addPong(1);

	superpowerPopup();
	drawPads();
	pongPhysics();
	drawBoard();
	if (GAME_ENDED) endScreen();

	requestAnimationFrame(game);

	function superpowerPopup() {
		if (newSuperpowerAnnouncement.bot._bool) {
			const shorthand = newSuperpowerAnnouncement.bot;

			let alpha = '8';
			if (shorthand.i < 8) alpha = shorthand.i;
			else if (shorthand.i > 172) alpha = 180 - shorthand.i;
			ctxS.fillRect(0, 0, canvas.width / 2, canvas.height, newSuperpowerAnnouncement._fillStyle[shorthand.type] + alpha);

			let text = '';
			if (shorthand.type == 'freeze') text = `You got FROZEN!`;
			else if (shorthand.type == 'larger') text = `You WIDENED!`;
			else text = `You became BOUNCY!`;
			ctxS.fillText(text, '#FFF' + alpha, 36, canvas.width / 4, canvas.height / 2, 'c');
			if (shorthand.i >= 180) {
				shorthand._bool = false;
				shorthand.type = null;
				shorthand.i = 0;
			} else shorthand.i++;
		}
		if (newSuperpowerAnnouncement.player._bool) {
			const shorthand = newSuperpowerAnnouncement.player;

			let alpha = '8';
			if (shorthand.i < 8) alpha = shorthand.i;
			else if (shorthand.i > 172) alpha = 180 - shorthand.i;
			ctxS.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height, newSuperpowerAnnouncement._fillStyle[shorthand.type] + alpha);

			let text = '';
			if (shorthand.type == 'freeze') text = `You got FROZEN!`;
			else if (shorthand.type == 'larger') text = `You WIDENED!`;
			else text = `You became BOUNCY!`;
			ctxS.fillText(text, '#FFF' + alpha, 36, canvas.width * 0.75, canvas.height / 2, 'c');
			if (shorthand.i >= 180) {
				shorthand._bool = false;
				shorthand.type = null;
				shorthand.i = 0;
			} else shorthand.i++;
		}
	}

	function drawBoard() {
		// timer
		const secondsLeft = Math.max(Math.floor((menuSettings[0].value * 60 - (Date.now() - gameStartTS) / 1000) % 60), 0);
		const minutesLeft = Math.max(Math.floor(menuSettings[0].value - (Date.now() - gameStartTS) / 60000), 0);
		GAME_ENDED = minutesLeft + secondsLeft == 0;

		ctxS.fillText(`${minutesLeft.toString().padStart(2, '0')}${secondsLeft % 2 == 0 ? ':' : ' '}${secondsLeft.toString().padStart(2, '0')}`, colorThemes.primary[colorThemes._current], 36, canvas.width - UIS * 1.414 - 5, 5, 'tr');

		// goals
		ctxS.fillText(`${goals.bot.count} goal${goals.bot.count > 1 ? 's' : ''}`, colorThemes.primary[colorThemes._current], 36 + goals.bot.newGoal._bool * Math.sin(goals.bot.newGoal.i++ * (Math.PI / 18)) * 10, canvas.width / 2 - UIS - 5, 5, 'tr');
		ctxS.fillText(`${goals.player.count} goal${goals.player.count > 1 ? 's' : ''}`, colorThemes.primary[colorThemes._current], 36 + goals.player.newGoal._bool * Math.sin(goals.player.newGoal.i++ * (Math.PI / 18)) * 10, canvas.width / 2 + UIS + 5, 5, 'tl');
		if (goals.bot.newGoal._bool && goals.bot.newGoal.i > 18) goals.bot.newGoal._bool = false;
		if (goals.player.newGoal._bool && goals.player.newGoal.i > 18) goals.player.newGoal._bool = false;

		// middle lines
		for (let i = 0; i < Math.ceil(canvas.height / UIS); i++) {
			ctxS.fillRect((canvas.width - UIS / 5) / 2, (i - 0.25) * UIS + (canvas.height % UIS) / 2, UIS / 5, UIS / 2);
		}

		// top and bottom bouncers
		ctxS.fillCirc(canvas.width / 2, 0, UIS + bouncersExtraRadius.top, colorThemes.primary[colorThemes._current]);
		ctxS.fillCirc(canvas.width / 2, canvas.height, UIS + bouncersExtraRadius.bottom, colorThemes.primary[colorThemes._current]);
		bouncersExtraRadius.top *= 0.85;
		bouncersExtraRadius.bottom *= 0.85;

		// corners wedge
		ctxS.fillRect(-UIS, -UIS, 2 * UIS, 2 * UIS, colorThemes.primary[colorThemes._current], Math.PI / 4);
		ctxS.fillRect(canvas.width - UIS, -UIS, 2 * UIS, 2 * UIS, colorThemes.primary[colorThemes._current], Math.PI / 4);
		ctxS.fillRect(-UIS, canvas.height - UIS, 2 * UIS, 2 * UIS, colorThemes.primary[colorThemes._current], Math.PI / 4);
		ctxS.fillRect(canvas.width - UIS, canvas.height - UIS, 2 * UIS, 2 * UIS, colorThemes.primary[colorThemes._current], Math.PI / 4);
	}

	function drawPads() {
		// playerPad
		const playerExtraSize = playerPad.superpower.larger._bool * playerPad.superpower.larger.extraSize;
		const NEW_Y = Math.max(Math.min(playerPad.y + (playerPad.tgy - playerPad.y) / 5, canvas.height - playerPad.h - playerExtraSize - UIS * 1.414), UIS * 1.414);
		playerPad.velocityY = playerPad.y - NEW_Y;
		playerPad.y = NEW_Y;
		playerPad.velocityRotation = Math.min(Math.max(playerPad.velocityRotation / 1.75 + playerPad.velocityY / 100, -Math.PI / 16), Math.PI / 16);
		playerPad.velocityY = 0;
		ctxS.fillRect(playerPad.x, playerPad.y, playerPad.w, playerPad.h + playerExtraSize, colorThemes.primary[colorThemes._current], playerPad.velocityRotation);
		if (playerPad.superpower.freeze._bool && Date.now() - SUPERPOWER_TS_EFFECTIVE >= playerPad.superpower.freeze.startTS) playerPad.superpower.freeze._bool = false;
		if (playerPad.superpower.larger._bool) {
			playerPad.superpower.larger.extraSize -= 0.1;
			if (playerPad.superpower.larger.extraSize <= 0) playerPad.superpower.larger._bool = false;
		}
		if (playerPad.superpower.bouncer._bool && Date.now() - SUPERPOWER_TS_EFFECTIVE * 1.5 >= playerPad.superpower.bouncer.startTS) playerPad.superpower.bouncer._bool = false;

		// botPad
		if (GAME_ENDED) {
			botPad.tgpong = { y: Math.sin(Date.now() / 1000) * (canvas.height / 2 - UIS * 1.414 * 2) + canvas.height / 2, s: 0 };
		} else {
			let mostLeft = Infinity;
			if (botPad.tgpong == undefined) botPad.tgpong = pong[0];
			for (let i = 1; i < Math.ceil(collisionMap[0].length / 2); i++) {
				for (let j = 0; j < collisionMap.length; j++) {
					const cell = collisionMap[j][i];
					if (cell.length == 0) continue;
					for (const targetpong of cell) {
						if (targetpong.x < mostLeft && targetpong.pongType._type == 'pong') {
							botPad.tgpong = targetpong;
							mostLeft = targetpong.x;
						}
					}
				}
				if (mostLeft != Infinity) break;
			}
		}
		const botExtraSize = botPad.superpower.larger._bool * botPad.superpower.larger.extraSize;
		if (!botPad.superpower.freeze._bool) {
			botPad.velocityY = Math.min(Math.max(((botPad.tgpong.y - botPad.y - (botPad.h + botExtraSize) / 2 + botPad.tgpong.s / 2) / (45 - menuSettings[1].value) + botPad.velocityY) * (0.7 + menuSettings[1].value / 50), -20 - menuSettings[1].value * 2), 20 + menuSettings[1].value * 2);
			botPad.y = Math.max(Math.min(botPad.y + botPad.velocityY, canvas.height - botPad.h - botExtraSize - UIS * 1.414), UIS * 1.414);
			//botPad.y = botPad.tgpong.y;
		}
		ctxS.fillRect(botPad.x, botPad.y, botPad.w, botPad.h + botExtraSize, colorThemes.primary[colorThemes._current]);
		if (botPad.superpower.freeze._bool && Date.now() - SUPERPOWER_TS_EFFECTIVE >= botPad.superpower.freeze.startTS) botPad.superpower.freeze._bool = false;
		if (botPad.superpower.larger._bool) {
			botPad.superpower.larger.extraSize -= 0.1;
			if (botPad.superpower.larger.extraSize <= 0) botPad.superpower.larger._bool = false;
		}
		if (botPad.superpower.bouncer._bool && Date.now() - SUPERPOWER_TS_EFFECTIVE * 1.5 >= botPad.superpower.bouncer.startTS) botPad.superpower.bouncer._bool = false;
	}

	function pongPhysics() {
		for (let i = 0; i < pong.length; i++) {
			let tgpong = pong[i];

			// exit if pong does not move
			if (tgpong.motionless._bool) {
				const exs = tgpong.motionless.extraSize;
				if (tgpong.pongType._type == 'pong') ctxS.fillRect(tgpong.x - exs / 2, tgpong.y - exs / 2, tgpong.s + exs, tgpong.s + exs, tgpong.fillStyle + Math.floor(tgpong.motionless.opacity * 16).toString(16));
				else ctxS.drawImage(tgpong.pongType.src, tgpong.x - exs / 2, tgpong.y - exs / 2, tgpong.s + exs, tgpong.s + exs, tgpong.motionless.opacity);
				tgpong.motionless.extraSize -= 2;
				tgpong.motionless.opacity = Math.min(tgpong.motionless.opacity + 0.05, 1);
				if (tgpong.motionless.extraSize <= 0) {
					tgpong.motionless._bool = false;
					tgpong.motionless.extraSize = 0;
					tgpong.motionless.opacity = 1;
				}
				continue;
			}

			// draw pong
			if (tgpong.pongType._type == 'pong') ctxS.fillRect(tgpong.x, tgpong.y, tgpong.s, tgpong.s, tgpong.fillStyle);
			else ctxS.drawImage(tgpong.pongType.src, tgpong.x, tgpong.y, tgpong.s, tgpong.s);

			// move pong
			tgpong.x = tgpong.x + Math.cos(tgpong.a) * tgpong.v;
			tgpong.y = tgpong.y + Math.sin(tgpong.a) * tgpong.v;
			tgpong.v = Math.min(Math.max((tgpong.v - MIN_PONG_SPEED) / 1.025 + MIN_PONG_SPEED, MIN_PONG_SPEED), 40);

			// log into collision table
			[tgpong.x, tgpong.y] = mapPong(tgpong.x, tgpong.y);

			const ocmi = collisionMap[tgpong.ogy][tgpong.ogx].indexOf(tgpong);
			collisionMap[tgpong.ogy][tgpong.ogx].splice(ocmi, 1);

			[tgpong.ogx, tgpong.ogy] = [tgpong.gx, tgpong.gy];
			[tgpong.gx, tgpong.gy] = [Math.floor(tgpong.x / 64) + 1, Math.floor(tgpong.y / 64) + 1];

			collisionMap[tgpong.gy][tgpong.gx].push(tgpong);

			// execute collisions
			tgpong = executeCollisions(tgpong, undefined, GAME_ENDED);

			// exit if game has ended
			if (GAME_ENDED) {
				tgpong.v = 0;
				const angleToCenter = Math.atan2(canvas.height / 2 - tgpong.y - tgpong.s / 2, canvas.width / 2 - tgpong.x - tgpong.s / 2);
				const xDiff = Math.cos(angleToCenter) * 0.1;
				const yDiff = Math.sin(angleToCenter) * 0.1;
				tgpong.grav.vx += xDiff;
				tgpong.grav.vy += yDiff;
				tgpong.x += tgpong.grav.vx;
				tgpong.y += tgpong.grav.vy;

				continue;
			}

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
				if (tgpong.pongType._type == 'pong' && specialsCount < 5) {
					let img = new Image();
					switch (Math.floor(Math.random() * 3)) {
						case 0:
							img.src = './img/freeze.png';
							addPong(1, { _type: 'freeze', src: img });
							break;
						case 1:
							img.src = './img/larger.png';
							addPong(1, { _type: 'larger', src: img });
							break;
						case 2:
							img.src = './img/bouncer.png';
							addPong(1, { _type: 'bouncer', src: img });
							break;

						default:
							console.error('Invalid type of specials');
							break;
					}
				}
			}

			// collision with pad
			const playerExtraSize = playerPad.superpower.larger._bool * playerPad.superpower.larger.extraSize;
			let realPongX = tgpong.x + tgpong.s / 2;
			let realPongY = tgpong.y + tgpong.s / 2;
			let realPlatfX = playerPad.x + playerPad.w / 2;
			let realPlatfY = playerPad.y + (playerPad.h + playerExtraSize) / 2;
			if (Math.abs(realPongY - realPlatfY) < (tgpong.s + playerPad.h + playerExtraSize) / 2 && Math.abs(realPongX - realPlatfX) < (tgpong.s + playerPad.w) / 2) {
				const SIDE_COLLISION_DEEPNESS = playerPad.w / 2 - Math.abs(realPongX - realPlatfX);
				const LEVEL_COLLISION_DEEPNESS = (playerPad.h + playerExtraSize) / 2 - Math.abs(realPongY - realPlatfY);
				if (SIDE_COLLISION_DEEPNESS > LEVEL_COLLISION_DEEPNESS) {
					tgpong.a = playerPad.velocityRotation * 2 - tgpong.a + Math.PI * 2;
					if (realPongY < realPlatfY) tgpong.y = playerPad.y - playerExtraSize / 2 - tgpong.s;
					else tgpong.y = playerPad.y + playerPad.h + playerExtraSize;
				} else {
					tgpong.a = (playerPad.velocityRotation + Math.PI / 2) * 2 - tgpong.a;
					tgpong.v += 1 + Math.abs(playerPad.velocityRotation) * 5 + playerPad.superpower.bouncer._bool * 12;
					if (realPongX < realPlatfX) tgpong.x = playerPad.x - tgpong.s;
					else tgpong.x = playerPad.x + playerPad.w;
				}
				playAudio(paddle);
			}
			const botExtraSize = botPad.superpower.larger._bool * botPad.superpower.larger.extraSize;
			realPlatfX = botPad.x + botPad.w / 2;
			realPlatfY = botPad.y + (botPad.h + botExtraSize) / 2;
			if (Math.abs(realPongY - realPlatfY) < (tgpong.s + botPad.h + botExtraSize) / 2 && Math.abs(realPongX - realPlatfX) < (tgpong.s + botPad.w) / 2) {
				const SIDE_COLLISION_DEEPNESS = botPad.w / 2 - Math.abs(realPongX - realPlatfX);
				const LEVEL_COLLISION_DEEPNESS = (botPad.h + botExtraSize) / 2 - Math.abs(realPongY - realPlatfY);
				if (SIDE_COLLISION_DEEPNESS > LEVEL_COLLISION_DEEPNESS) {
					tgpong.a = -tgpong.a + Math.PI * 2;
					if (realPongY < realPlatfY) tgpong.y = botPad.y - botExtraSize / 2 - tgpong.s;
					else tgpong.y = botPad.y + botPad.h + botExtraSize;
				} else {
					tgpong.a = Math.PI - tgpong.a;
					tgpong.v += botPad.superpower.bouncer._bool * 12;
					if (realPongX < realPlatfX) tgpong.x = botPad.x - tgpong.s;
					else tgpong.x = botPad.x + botPad.w;
				}
				playAudio(paddle);
			}

			// if outsite reset pong
			if (tools.isOutOfBound(tgpong.x, tgpong.y, tgpong.s, tgpong.s, true)) {
				if (tgpong.pongType._type != 'pong') {
					if (tgpong.x > canvas.width / 2) {
						if (tgpong.pongType._type == 'freeze') {
							botPad.superpower.freeze._bool = true;
							botPad.superpower.freeze.startTS = Date.now();

							newSuperpowerAnnouncement.bot._bool = true;
							newSuperpowerAnnouncement.bot.type = 'freeze';
							newSuperpowerAnnouncement.bot.i = 0;
						} else if (tgpong.pongType._type == 'larger') {
							playerPad.superpower.larger._bool = true;
							playerPad.superpower.larger.extraSize = canvas.height / 8;

							newSuperpowerAnnouncement.player._bool = true;
							newSuperpowerAnnouncement.player.type = 'larger';
							newSuperpowerAnnouncement.player.i = 0;
						} else if (tgpong.pongType._type == 'bouncer') {
							playerPad.superpower.bouncer._bool = true;
							playerPad.superpower.bouncer.startTS = Date.now();

							newSuperpowerAnnouncement.player._bool = true;
							newSuperpowerAnnouncement.player.type = 'bouncer';
							newSuperpowerAnnouncement.player.i = 0;
						}
					} else {
						if (tgpong.pongType._type == 'freeze') {
							playerPad.superpower.freeze._bool = true;
							playerPad.superpower.freeze.startTS = Date.now();

							newSuperpowerAnnouncement.player._bool = true;
							newSuperpowerAnnouncement.player.type = 'freeze';
							newSuperpowerAnnouncement.player.i = 0;
						} else if (tgpong.pongType._type == 'larger') {
							botPad.superpower.larger._bool = true;
							botPad.superpower.larger.extraSize = canvas.height / 8;

							newSuperpowerAnnouncement.bot._bool = true;
							newSuperpowerAnnouncement.bot.type = 'larger';
							newSuperpowerAnnouncement.bot.i = 0;
						} else if (tgpong.pongType._type == 'bouncer') {
							botPad.superpower.bouncer._bool = true;
							botPad.superpower.bouncer.startTS = Date.now();

							newSuperpowerAnnouncement.bot._bool = true;
							newSuperpowerAnnouncement.bot.type = 'bouncer';
							newSuperpowerAnnouncement.bot.i = 0;
						}
					}
					try {
						// why dafuk this refuses to work until i force it with a while loop
						while (collisionMap[tgpong.gy][tgpong.gx].indexOf(tgpong) != -1) {
							const selfIdx = collisionMap[tgpong.gy][tgpong.gx].indexOf(tgpong);
							delete collisionMap[tgpong.gy][tgpong.gx][selfIdx];
							collisionMap[tgpong.gy][tgpong.gx].splice(selfIdx, 1);
						}
					} catch (error) {
						console.error(error);
					}
					pong.splice(i, 1);
					specialsCount--;

					continue;
				}

				if (tgpong.x > canvas.width / 2) {
					goals.bot.count++;
					goals.bot.newGoal._bool = true;
					goals.bot.newGoal.i = 0;
				} else {
					goals.player.count++;
					goals.player.newGoal._bool = true;
					goals.player.newGoal.i = 0;
				}

				tgpong.s = Math.random() * 20 + 32;
				tgpong.x = canvas.width / 2 - tgpong.s / 2;
				tgpong.y = canvas.height / 2 - tgpong.s / 2;
				tgpong.a = Math.random() * Math.PI * 2;
				tgpong.v = MIN_PONG_SPEED;
				tgpong.motionless = { _bool: true, extraSize: 40, opacity: 0 };

				playAudio(score);
			}
		}
	}

	function executeCollisions(tgpong, cannotCollideWith = [], collideWithMultipleTypes = false) {
		for (let i = -1; i <= 1; i++) {
			const arrLine = collisionMap[tgpong.gy + i];
			if (arrLine != undefined) {
				for (let j = -1; j <= 1; j++) {
					const collisionCell = arrLine[tgpong.gx + j];
					if (collisionCell != undefined) {
						collisionCell.forEach((otherPong) => {
							if (otherPong != tgpong && !otherPong.motionless._bool && otherPong.pongID > tgpong.pongID && !tgpong.cannotCollideWith.includes(otherPong.pongID)) {
								if (!((tgpong.pongType._type != 'pong' && otherPong.pongType._type == 'pong') || (tgpong.pongType._type == 'pong' && otherPong.pongType._type != 'pong')) || collideWithMultipleTypes) {
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
											[tgpong.grav.vy, otherPong.grav.vy] = [otherPong.grav.vy, tgpong.grav.vy];

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
											[tgpong.grav.vx, otherPong.grav.vx] = [otherPong.grav.vx, tgpong.grav.vx];

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
										playAudio(collide);
									}
								}
							}
						});
					}
				}
			}
		}
		tgpong.cannotCollideWith = cannotCollideWith;
		return tgpong;
	}

	function mapPong(x, y) {
		return [Math.min(Math.max(x, -64), Math.ceil(canvas.width / 64) * 65), Math.min(Math.max(y, -64), Math.ceil(canvas.height / 64) * 65)];
	}

	function endScreen() {
		ctxS.fillRect(0, 0, canvas.width, canvas.height, '#000A');
		ctxS.fillText('NOT BORING PONG', colorThemes.primary[colorThemes._current], canvas.height / 10 + Math.sin(Date.now() / 500) * 5, canvas.width / 2, canvas.height / 4 - canvas.height / 16, 'c');
		ctxS.fillText('thanks for playing!', colorThemes.primary[colorThemes._current], canvas.height / 20 + Math.sin(Date.now() / 500) * 5, canvas.width / 2, canvas.height / 4 + canvas.height / 16, 'c');

		ctxS.fillText(`you scored ${goals.player.count}, bot scored ${goals.bot.count}`, colorThemes.tertiary[colorThemes._current], canvas.height / 20, canvas.width / 2, canvas.height / 2 - canvas.height / 30, 'c');
		const diff = goals.player.count - goals.bot.count;
		ctxS.fillText(`you are officially a ${diff > 0 ? 'winner' : diff < 0 ? 'looser' : 'tie-lover (sus)'}!`, colorThemes.tertiary[colorThemes._current], canvas.height / 20, canvas.width / 2, canvas.height / 2 + canvas.height / 30, 'c');

		ctxS.fillText(`previous PB: ${previousPB}`, colorThemes.primary[colorThemes._current], canvas.height / 20 + Math.sin(Date.now() / 500) * 2, canvas.width / 2, canvas.height - (canvas.height / 4 + canvas.height / 16), 'c');
		if (goals.player.count > previousPB) localStorage.setItem('previousPB', goals.player.count);
	}
}

function addPong(times = 1, pongType = { _type: 'pong' }) {
	for (let i = 0; i < times; i++) {
		const randomAngle = 2 * Math.PI * Math.random();
		let idx = pong.push({
			x: canvas.width / 2 - 16, // + Math.cos(randomAngle) * 100,
			y: canvas.height / 2 - 16, // + Math.sin(randomAngle) * 100,
			gx: Math.floor(canvas.width / 2 / 64) + 1,
			gy: Math.floor(canvas.height / 2 / 64) + 1,
			ogx: Math.floor(canvas.width / 2 / 64) + 1,
			ogy: Math.floor(canvas.height / 2 / 64) + 1,
			s: Math.random() * 20 + 40,
			a: randomAngle + Math.PI,
			v: 5,
			motionless: {
				_bool: true,
				extraSize: 40,
				opacity: 0,
			},
			pongID: pongIDCount++,
			pongType: pongType,
			fillStyle: colorThemes.primary[colorThemes._current],
			cannotCollideWith: [],
			grav: {
				vx: 0,
				vy: 0,
			},
		});
		if (pongType._type != 'pong') specialsCount++;
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

	console.info('font ready');

	for (let i = 0; i < Math.ceil(canvas.height / 64) + 2; i++) {
		collisionMap.push([]);
		for (let j = 0; j < Math.ceil(canvas.width / 64) + 2; j++) {
			collisionMap[i].push([]);
		}
	}

	//game();
	menu();
});
