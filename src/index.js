'use strict';

// Disable the inverted mirrored pass while keeping the gallery view upright.
var useReflexion = false;
var showStats = false;

// Handle different screen ratios
const mapVal = (value, min1, max1, min2, max2) => min2 + (value - min1) * (max2 - min2) / (max1 - min1);
var fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, 1.7, Math.PI / 3);

if (navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i)) {
	useReflexion = false;
	// Account for the searchbar
	fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, 1.5, Math.PI / 3);
}
var fovY = () => 2 * Math.atan(Math.tan(fovX() * 0.5) * window.innerHeight / window.innerWidth);

const mat4 = require('gl-mat4');
const drawText = require('./text').draw;
const Stats = require('stats.js');
var stats = new Stats();
stats.showPanel(0);
if(showStats) {
	document.body.appendChild( stats.dom );
}

let regl, map, drawMap, placement, drawPainting, fps;

regl = require('regl')({
	extensions: [
		//'angle_instanced_arrays',
		'OES_element_index_uint',
		'OES_standard_derivatives'
	],
	optionalExtensions: [
		//'oes_texture_float',
		'EXT_texture_filter_anisotropic'
	],
	attributes: { alpha : true }
});

map = require('./map')();
const mesh = require('./mesh');
drawMap = mesh(regl, map, useReflexion);
placement = require('./placement')(regl, map);
drawPainting = require('./painting')(regl);
fps = require('./fps')(map, fovY);

// Fixed world-space inscription on the entrance signboard.
const drawEntranceInscription = drawText(regl);
const signCanvas = document.createElement('canvas');
signCanvas.width = 1024;
signCanvas.height = 256;
const signContext = signCanvas.getContext('2d');
signContext.clearRect(0, 0, signCanvas.width, signCanvas.height);
signContext.direction = 'rtl';
signContext.textAlign = 'center';
signContext.textBaseline = 'middle';
signContext.fillStyle = '#f5df9a';
signContext.shadowColor = 'rgba(0,0,0,0.5)';
signContext.shadowBlur = 3;
signContext.font = 'bold 62px Tahoma, Arial, sans-serif';
signContext.fillText('دومین جشنواره کشوری', 512, 83, 950);
signContext.font = 'bold 54px Tahoma, Arial, sans-serif';
signContext.fillText('طراحی و دوخت لباس دانش‌آموزی', 512, 174, 950);
const signTexture = regl.texture({ data: signCanvas, min: 'linear', mag: 'linear', flipY: true });
// Interior-facing inscription (positive Z side).
const signModel = mat4.identity([]);
mat4.translate(signModel, signModel, [24, 5.18, 0.59]);
mat4.scale(signModel, signModel, [8.4, 1.16, 1]);

// Matching inscription on the exterior-facing side. Rotate the plane 180 degrees
// around Y so the Persian text is readable from outside rather than mirrored.
const signOutsideModel = mat4.identity([]);
mat4.translate(signOutsideModel, signOutsideModel, [15.6, 5.18, 0.13]);
mat4.rotateY(signOutsideModel, signOutsideModel, Math.PI);
mat4.scale(signOutsideModel, signOutsideModel, [8.4, 1.16, 1]);

const entranceInscription = [
	{ text: signTexture, textmodel: signModel },
	{ text: signTexture, textmodel: signOutsideModel }
];

const context = regl({
	cull: {
		enable: true,
		face: 'back'
	},
	uniforms: {
		view: fps.view,
		proj: fps.proj,
		yScale: 1.0
	}
});

const reflexion = regl({
	cull: {
		enable: true,
		face: 'front'
	},
	uniforms: {
		yScale: -1.0
	},
	depth: { enable: true, mask: false }
});

// Pick the artwork/flyer under the actual screen coordinate.
const downloadedThisVisit = new Set();
// Touch is handled separately because fps.js prevents the browser's synthetic click.
const activateGalleryItem = (clientX, clientY, mode) => {
	const clickYaw = fps.fmouse[1] + ((clientX / window.innerWidth) - 0.5) * fovX();
	// The camera's positive pitch looks downward, so screen Y and target elevation use the opposite sign.
	const clickPitch = fps.fmouse[0] + (clientY / window.innerHeight - 0.5) * fovY();
	const candidates = placement.batch().filter(p => p.file && !p.isMannequinPrototype);
	let best = null;
	let bestScore = Infinity;
	for (const p of candidates) {
		if (!p.pos || !p.dir || !p.segLen || !p.width) continue;
		const ux = p.dir[0] / p.segLen;
		const uz = p.dir[1] / p.segLen;
		const cx = p.pos[0] + ux * p.width;
		const cz = p.pos[2] + uz * p.width;
		const distance = Math.hypot(cx - fps.pos[0], cz - fps.pos[2]);
		if (distance > 25 || distance < 0.1) continue;
		const targetYaw = Math.atan2(cx - fps.pos[0], fps.pos[2] - cz);
		const yawDiff = Math.atan2(Math.sin(targetYaw - clickYaw), Math.cos(targetYaw - clickYaw));
		const targetPitch = -Math.atan2(2.1 - fps.pos[1], distance);
		const pitchDiff = targetPitch - clickPitch;
		const halfHeight = p.clickHalfHeight || p.globalScale || (p.width * 1.4);
		const yawLimit = Math.atan2(p.width * 1.12, distance) + 0.025;
		const pitchLimit = Math.atan2(halfHeight * 1.12, distance) + 0.025;
		if (Math.abs(yawDiff) > yawLimit || Math.abs(pitchDiff) > pitchLimit) continue;
		const score = Math.pow(yawDiff / yawLimit, 2) + Math.pow(pitchDiff / pitchLimit, 2);
		if (score < bestScore) { best = p; bestScore = score; }
	}
	// Reject loose angular matches so clicks on empty walls/floor never download anything.
	if (!best || bestScore > 0.72) {
		if (mode === 'download') alert('لطفاً یک اثر را دقیقاً در مرکز صفحه قرار دهید.');
		return;
	}
	if (best.isSurveyFlyer) {
		if (mode !== 'download') window.open('https://digiform.ir/wab710d2e6', '_blank', 'noopener,noreferrer');
		else alert('برای دانلود، یک اثر لباس را انتخاب کنید.');
		return;
	}
	if (mode === 'download' && downloadedThisVisit.has(best.file)) {
		alert('این اثر در همین بازدید قبلاً دانلود شده است.');
		return;
	}
	if (downloadedThisVisit.has(best.file)) return;
	downloadedThisVisit.add(best.file);
	const link = document.createElement('a');
	link.href = 'images/' + encodeURIComponent(best.file).replace(/%2F/g, '/');
	link.download = best.file;
	document.body.appendChild(link);
	link.click();
	link.remove();
};

window.addEventListener('gallery-download-front-artwork', () => {
	activateGalleryItem(window.innerWidth / 2, window.innerHeight / 2, 'download');
});

let galleryTouchStart = null;
let lastTouchHandledAt = 0;
document.addEventListener('touchstart', event => {
	if (event.touches.length !== 1) { galleryTouchStart = null; return; }
	const t = event.touches[0];
	galleryTouchStart = { x: t.clientX, y: t.clientY, time: event.timeStamp };
}, { capture: true, passive: true });

document.addEventListener('touchend', event => {
	if (!galleryTouchStart || !event.changedTouches.length) return;
	const t = event.changedTouches[0];
	const moved = Math.hypot(t.clientX - galleryTouchStart.x, t.clientY - galleryTouchStart.y);
	const elapsed = event.timeStamp - galleryTouchStart.time;
	galleryTouchStart = null;
	if (moved > 18 || elapsed > 350) return;
	if (event.target && event.target.closest && event.target.closest('.survey-link')) return;
	lastTouchHandledAt = Date.now();
	activateGalleryItem(t.clientX, t.clientY);
}, { capture: true, passive: true });

document.addEventListener('click', event => {
	if (event.target && event.target.closest && event.target.closest('.gallery-actions')) return;
	// Ignore the synthetic click some mobile browsers emit after touchend.
	if (Date.now() - lastTouchHandledAt < 600) return;
	// Pick from the actual click position; some desktop browsers report the body as target
	// when the WebGL canvas fills the viewport, so do not require tagName === CANVAS.
	activateGalleryItem(event.clientX, event.clientY);
});
regl.frame(({
	time
}) => {
	stats.begin();
	fps.tick({
		time
	});
	placement.update(fps.pos, fps.fmouse[1], fovX());
	regl.clear({
		color: [0.48, 0.75, 0.94, 1], // Daylight blue fallback outside the horizon mesh
		depth: 1
	});
	context(() => {
		if(useReflexion) {
			reflexion(() => {
				drawMap();
				drawPainting(placement.batch());
			});
		}
		drawMap();
		drawPainting(placement.batch());
		drawEntranceInscription(entranceInscription);
	});
	stats.end();
});