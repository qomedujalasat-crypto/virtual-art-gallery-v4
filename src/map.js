'use strict';

const mapSize = 3; // Restore the previously published gallery layout.
const cellSize = 6; // Restore the previous gallery footprint.
const mapHeight = 7;
const wallThickness = 0.25;
const wallRemoval = 0.5;


const transform = (a, r, tx, ty, o = 1) => a.map((v) => [(o * v[r] + tx) / 2, (o * v[1 - r] + ty) / 2]);

function hilbert(n) {
	if (n === 1) return transform([[0, 0], [0, 1], [1, 1], [1, 0]], 0, 0.5, 0.5);
	const h = hilbert(n - 1);
	return [
		...transform(h, 1, 0, 0),
		...transform(h, 0, 0, 1),
		...transform(h, 0, 1, 1),
		...transform(h, 1, 2, 1, -1)
	];
}

function genBorder(n, w, m) {
	w = 0.5 - w / 4;
	m *= Math.pow(4, n);
	console.time('hilbert');
	const points = hilbert(n);
	console.timeEnd('hilbert');
	// Add points to fix end
	points.unshift(points[3]);
	points.push(points[points.length - 4]);
	// Calculate direction
	console.time('dir');
	let nodes = [];
	for (let i = 0; i < points.length - 2; i++) {
		const p0 = points[i];
		const p1 = points[i + 1];
		const p2 = points[i + 2];
		const d1 = [p1[0] - p0[0], p1[1] - p0[1]];
		const d2 = [p2[0] - p1[0], p2[1] - p1[1]];
		nodes[i] = { p0, p1, p2, s: Math.sign(d1[0] * d2[1] - d1[1] * d2[0]) };
	}
	console.timeEnd('dir');
	// Fix end
	let inverse = nodes.slice(0).reverse();
	inverse = inverse.map(({ p0, p1, p2, s }) => ({ p0: p2, p1, p2: p0, s: -s }));
	if (n % 2) nodes.splice(-3);
	else inverse.splice(0, 3);
	nodes = nodes.concat(inverse);
	// Remove walls
	const removeWall = (r) => {
		if (nodes[r + 1].s === -1 && nodes[r + 2].s === -1) {
			nodes[r].s--;
			nodes[r + 3].s--;
			nodes[r].p2 = nodes[r + 3].p1;
			nodes[r + 3].p0 = nodes[r].p1;
			nodes.splice(r + 1, 2);
		}
	};
	// Deterministic pseudo-random sequence: every visitor gets the same gallery layout.
	let randomSeed = 123456789;
	const seededRandom = () => {
		randomSeed = (1664525 * randomSeed + 1013904223) % 4294967296;
		return randomSeed / 4294967296;
	};
	// Remove the same walls in the same order on every load.
	console.time('rnd wall');
	for (let i = 0; i < m; i++) {
		let r = Math.floor(seededRandom() * (nodes.length - 3));
		while (nodes[r + 1].s !== -1 || nodes[r + 2].s !== -1) r = (r + 1) % (nodes.length - 3);
		removeWall(r);
	}
	console.timeEnd('rnd wall');
	// Remove bad looking walls
	console.time('pretty wall');
	for (let i = 0; i < nodes.length - 3; i++) {
		if (nodes[i].s === 1 || nodes[i + 3].s === 1) {
			removeWall(i);
		}
	}
	console.timeEnd('pretty wall');
	// Generate borders
	const path = [];
	console.time('border');
	nodes.map(({ p0, p1, p2, s }) => {
		const d1 = [(p1[0] - p0[0]) * w, (p1[1] - p0[1]) * w];
		const d2 = [(p2[0] - p1[0]) * w, (p2[1] - p1[1]) * w];
		if (s === 0) return;
		path.push([p1[0] + s * (d1[0] - d2[0]), p1[1] + s * (d1[1] - d2[1])]);
	});
	console.timeEnd('border');
	// Fix start
	if (n % 2) path.splice(0, 1, path[path.length - 1]);
	else path.splice(-1, 1, path[0]);
	return path;
}

function splitSegments(segments) {
	console.time('split segments');
    segments = segments.map(s => {
        // Calculate subsegment length
        let l = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
        l = Math.ceil(l / 8 - 0.3);
        if (l <= 0) return {parts: [s], seg:s};
        // Lerp coordinates
        let res = [];
        for (let t = 0; t <= 1; t += 1 / l)
            res.push([s[0][0] * (1 - t) + s[1][0] * t, s[0][1] * (1 - t) + s[1][1] * t]);
        // Form pairs of coordinates
        return {
			seg: s,
			parts: res.slice(0, -1).map((r, i) => [r, res[i + 1]])
		};
    });
	console.timeEnd('split segments');
	return segments;
}

// Apply riffle shuffle to sub-arrays
function merge(dest, org, aStart, aEnd, bStart, bEnd) {
    let a = org.slice(aStart, aEnd).reverse();
    let b = org.slice(bStart, bEnd);
    let prop = a.length / b.length;
    while (a.length > 0 && b.length > 0)
        dest.push(a.length / b.length > prop ? a.pop() : b.pop());
    while (a.length > 0) dest.push(a.pop());
    while (b.length > 0) dest.push(b.pop());
    return dest;
};

function reorderPlacements(placements, r) {
    console.time('reorder placements');
    let places = placements;
    placements = [];
    let i = 0, j = places.length - 1;
    let it = [], jt = [], len = 0;
    //console.log(segs);
    //debugger;
    //let temp = [...Array(segs.length)].map((_, i) => i);
    while (i < j) {
        let xi = Math.floor((places[i][0][0] + places[i][1][0]) / 4 / r);
        let yi = Math.floor((places[i][0][1] + places[i][1][1]) / 4 / r);
        let xj = Math.floor((places[j][0][0] + places[j][1][0]) / 4 / r);
        let yj = Math.floor((places[j][0][1] + places[j][1][1]) / 4 / r);
        //console.log(i, j, xi, yi, xj, yj);
        if (xi == xj && yi == yj) {
            //console.log("converge");
            //console.log(temp.slice(i - len, i + 1), temp.slice(j, j + len + 1));
            merge(placements, places, i - len, i + 1, j, j + len + 1);
            it = []; jt = []; len = 0;
        } else {
            //console.log("diverge");
            let findi = jt.findIndex(([x, y]) => x === xi && y === yi);
            let findj = it.findIndex(([x, y]) => x === xj && y === yj);
            //console.log(findi, findj);
            if (findi !== -1) {
                //console.log(temp.slice(i - len, i + 1), temp.slice(j + len - findi, j + len + 1));
                merge(placements, places, i - len, i + 1, j + len - findi, j + len + 1);
                j += len - findi; //rollback
                it = []; jt = []; len = 0;
            } else if (findj !== -1) {
                //console.log(temp.slice(j, j + len + 1), temp.slice(i - len, i - len + findj + 1));
                merge(placements, places, i - len, i - len + findj + 1, j, j + len + 1);
                i -= len - findj; //rollback
                it = []; jt = []; len = 0;
            } else {
                it.push([xi, yi]);
                jt.push([xj, yj]);
                len++;
            }
        }
        i++; j--;
    }
    //console.log(temp.slice(i - len, j + len + 1));
    placements.push(...places.slice(i - len, j + len + 1));
    console.timeEnd('reorder placements');
	return placements;
}

function genGrid(segments, n, r) {
	console.time('gen grid');
	let splittedSegments = splitSegments(segments, r);
	const cellCount = Math.pow(2, n);
	let gridSegs = Array(cellCount * cellCount).fill().map(() => []);
	let gridParts = Array(cellCount * cellCount).fill().map(() => []);
	splittedSegments.map(({seg, parts}) =>
		parts.map(part => {
			const indexes = [
				Math.round(part[0][0] / r - 0.5) +
				Math.round(part[0][1] / r - 0.5) * cellCount,
				Math.round(part[1][0] / r - 0.5) +
				Math.round(part[1][1] / r - 0.5) * cellCount,
				Math.round((part[0][0] + part[1][0]) / 2 / r - 0.5) +
				Math.round((part[0][1] + part[1][1]) / 2 / r - 0.5) * cellCount
			];
			for(let i of indexes) {
				if(!gridSegs[i]) gridSegs[i] = [];
				if(!gridSegs[i].includes(seg)) gridSegs[i].push(seg);
				if(!gridParts[i]) gridParts[i] = [];
				if(!gridParts[i].includes(part)) gridParts[i].push(part);
			}
		})
	);
	//console.log(gridSegs, gridParts);
	const getGridSegments = (x, y) =>
		gridSegs[Math.round(x/r - 0.5) + Math.round(y/r - 0.5) * cellCount] || [];
	const getGridParts = (x, y) =>
		gridParts[Math.round(x/r - 0.5) + Math.round(y/r - 0.5) * cellCount] || [];
	let placements = splittedSegments.flatMap(({parts}) => parts);
	// Ignore short segments for painting placement
	placements = placements.filter(([[ax, ay], [bx, by]]) => Math.hypot(ax - bx, ay - by) > 1);
	placements = reorderPlacements(placements, r);
	const areas = placements.map(place => [
        (Math.round((place[0][0] + place[1][0]) / 2 / r + 0.5) - 0.5) * r,
        (Math.round((place[0][1] + place[1][1]) / 2 / r + 0.5) - 0.5) * r
	]);
	const getAreaIndex = (x, y) => {
		let index = areas.findIndex(a => Math.abs(a[0] - x) < r / 2 && Math.abs(a[1] - y) < r / 2)
		if (index === -1) // Middle of room => search neighbour cells
			index = areas.findIndex(a => Math.abs(a[0] - x) + Math.abs(a[1] - y) < r)
		// Keep artwork loading progressing even when the visitor is between walls.
		if (index === -1 && areas.length) {
			let nearestDistance = Infinity;
			for (let i = 0; i < areas.length; i++) {
				const distance = Math.hypot(areas[i][0] - x, areas[i][1] - y);
				if (distance < nearestDistance) {
					nearestDistance = distance;
					index = i;
				}
			}
		}
		return index;
	};
	console.timeEnd('gen grid');
	return {getGridSegments, getGridParts, getAreaIndex, placements};
}

module.exports = function (n = mapSize, r = cellSize, w = wallThickness, m = wallRemoval, h = mapHeight) {
	let s = r * Math.pow(2, n);
	// A real serpentine gallery: outer perimeter plus three long inner walls.
	// Alternating door gaps connect the lanes so the visitor walks back and forth.
	const border = [[0,0],[s,s*0.38],[s,0],[s,s],[0,s],[0,0]].map(([x,y]) => [x,y]);
	let segments = [
		// Outer square: the centered opening is the main entrance from the park.
		[[0,0],[s*0.38,0]], [[s*0.62,0],[s,0]],
		[[s,0],[s,s]], [[s,s],[0,s]], [[0,s],[0,0]]
	];

	// Inner square gallery loop. Its front opening aligns with the main entrance,
	// so visitors can enter the square corridor, walk around all four sides,
	// and return through the same opening to the entrance sign.
	const innerInset = s * 0.20;
	const innerLeft = innerInset;
	const innerRight = s - innerInset;
	const innerFront = innerInset;
	const innerBack = s - innerInset;
	const innerOpeningHalf = s * 0.105;
	const innerOpeningLeft = s * 0.5 - innerOpeningHalf;
	const innerOpeningRight = s * 0.5 + innerOpeningHalf;
	segments.push(
		// Inner front wall faces the corridor (toward the entrance / -Z).
		[[innerOpeningLeft, innerFront], [innerLeft, innerFront]],
		[[innerRight, innerFront], [innerOpeningRight, innerFront]],
		// The remaining sides are oriented so their visible faces point into the corridor.
		[[innerRight, innerFront], [innerRight, innerBack]],
		[[innerRight, innerBack], [innerLeft, innerBack]],
		[[innerLeft, innerBack], [innerLeft, innerFront]]
	);
	// Simple square gallery: keep the outer perimeter and the central entrance opening.
	const entranceLeft = s * 0.38;
	const entranceRight = s * 0.62;
	const corridorLength = 8;
	console.time('gen mesh');
	let normal = segments
		.map(([[x1, y1], [x2, y2]]) => [Math.sign(y1 - y2), 0, Math.sign(x2 - x1)])
		.flatMap((v) => Array(4).fill(v));
	let position = segments.flat().flatMap(([x, y]) => [[x, 0, y], [x, h, y]]);
	// The two front-wall sections beside the entrance must also be visible from the park.
	// With back-face culling enabled, add reverse-facing geometry for those two wall sections.
	const frontSideWalls = [
		[[0, 0], [s * 0.38, 0]],
		[[s * 0.62, 0], [s, 0]]
	];
	frontSideWalls.forEach(([[x1, z1], [x2, z2]]) => {
		// Keep the interior-facing wall surface from `segments` and add a distinct
		// exterior-facing surface slightly into the park. The small offset avoids
		// coplanar duplicate faces being lost to depth-buffer z-fighting.
		const exteriorZ = z1 - 0.04;
		position.push([x2, 0, exteriorZ], [x2, h, exteriorZ], [x1, 0, exteriorZ], [x1, h, exteriorZ]);
		const reverseNormal = [0, 0, -1];
		for (let i = 0; i < 4; i++) normal.push(reverseNormal);
	});
	let {getAreaIndex, getGridSegments, getGridParts, placements} = genGrid(segments, n, r);
	//Add floor and ceilling
	normal.push([0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]);
	position.push([0, h, 0], [0, h, s], [s, h, 0], [s, h, s], [0, 0, 0], [s, 0, 0], [0, 0, s], [s, 0, s]);
	// Open-air park approach outside the entrance: a real walkable ground plane and distant horizon.
	// This is separate from the gallery floor and leaves the portal and interior layout untouched.
	const parkDepth = 30;
	const parkSkyHeight = 13;
	const addExteriorQuad = (a, b, c, d, nrm) => {
		[a, b, c, d].forEach(p => position.push(p));
		for (let i = 0; i < 4; i++) normal.push(nrm);
	};
	addExteriorQuad([0, 0, -parkDepth], [s, 0, -parkDepth], [0, 0, 0], [s, 0, 0], [0, 1, 0]);
	// Face the rear panorama toward the visitor standing outside the entrance.
	addExteriorQuad([0, 0, -parkDepth], [s, 0, -parkDepth], [0, parkSkyHeight, -parkDepth], [s, parkSkyHeight, -parkDepth], [0, 0, -1]);
	// Extend the same horizon backdrop along the left and right sides of the park approach.
	addExteriorQuad([0, 0, 0], [0, 0, -parkDepth], [0, parkSkyHeight, 0], [0, parkSkyHeight, -parkDepth], [-1, 0, 0]);
	addExteriorQuad([s, 0, -parkDepth], [s, 0, 0], [s, parkSkyHeight, -parkDepth], [s, parkSkyHeight, 0], [1, 0, 0]);

	// Three-dimensional Iranian-style entrance portal at the open gap in the front wall.
	// This geometry is rendered in the gallery itself, independently of the welcome overlay.
	const portalCenterX = s * 0.5;
	const portalZ = 0.18;
	const portalWidth = s * 0.24;
	const portalRadius = portalWidth * 0.5;
	const pillarHeight = h * 0.66;
	const portalTop = h * 0.94;
	const archRise = portalTop - pillarHeight;
	const frameDepth = 0.34;
	const addPortalQuad = (a, b, c, d, nrm) => {
		[a, b, c, d].forEach(p => position.push(p));
		for (let i = 0; i < 4; i++) normal.push(nrm);
	};
	const addPortalBox = (x1, y1, z1, x2, y2, z2) => {
		// Front and rear faces, plus the two narrow side faces; each quad uses the mesh's standard indexing.
		addPortalQuad([x1,y1,z1],[x2,y1,z1],[x1,y2,z1],[x2,y2,z1],[0,0,1]);
		addPortalQuad([x2,y1,z2],[x1,y1,z2],[x2,y2,z2],[x1,y2,z2],[0,0,-1]);
		addPortalQuad([x1,y1,z2],[x1,y1,z1],[x1,y2,z2],[x1,y2,z1],[-1,0,0]);
		addPortalQuad([x2,y1,z1],[x2,y1,z2],[x2,y2,z1],[x2,y2,z2],[1,0,0]);
	};
	// Solid carved-looking jambs and a segmented curved arch ring.
	addPortalBox(portalCenterX - portalRadius - frameDepth, 0, portalZ,
		portalCenterX - portalRadius, pillarHeight, portalZ + frameDepth);
	addPortalBox(portalCenterX + portalRadius, 0, portalZ,
		portalCenterX + portalRadius + frameDepth, pillarHeight, portalZ + frameDepth);
	const archSegments = 20;
	const outerRadius = portalRadius + frameDepth;
	for (let i = 0; i < archSegments; i++) {
		const a0 = Math.PI * i / archSegments;
		const a1 = Math.PI * (i + 1) / archSegments;
		// A shallow Persian-style arch that stays below the gallery ceiling.
		const inner0 = [portalCenterX + Math.cos(a0) * portalRadius, pillarHeight + Math.sin(a0) * archRise, portalZ];
		const inner1 = [portalCenterX + Math.cos(a1) * portalRadius, pillarHeight + Math.sin(a1) * archRise, portalZ];
		const outer0 = [portalCenterX + Math.cos(a0) * outerRadius, pillarHeight + Math.sin(a0) * (archRise + frameDepth * 0.32), portalZ];
		const outer1 = [portalCenterX + Math.cos(a1) * outerRadius, pillarHeight + Math.sin(a1) * (archRise + frameDepth * 0.32), portalZ];
		addPortalQuad(inner0, inner1, outer0, outer1, [0,0,1]);
		addPortalQuad([inner0[0],inner0[1],portalZ+frameDepth],[inner1[0],inner1[1],portalZ+frameDepth],
			[outer0[0],outer0[1],portalZ+frameDepth],[outer1[0],outer1[1],portalZ+frameDepth],[0,0,-1]);
	}
	// Framed wooden signboard nested above the doors, within the arch and below the ceiling.
	const signLeft = portalCenterX - portalRadius * 0.70;
	const signRight = portalCenterX + portalRadius * 0.70;
	addPortalBox(signLeft - 0.12, 5.18, portalZ - 0.03, signRight + 0.12, 6.34, portalZ + frameDepth + 0.05);
	// Fine gold edging around the signboard.
	addPortalBox(signLeft - 0.12, 5.18, portalZ - 0.07, signRight + 0.12, 5.28, portalZ + frameDepth + 0.09);
	addPortalBox(signLeft - 0.12, 6.24, portalZ - 0.07, signRight + 0.12, 6.34, portalZ + frameDepth + 0.09);
	addPortalBox(signLeft - 0.12, 5.18, portalZ - 0.07, signLeft - 0.02, 6.34, portalZ + frameDepth + 0.09);
	addPortalBox(signRight + 0.02, 5.18, portalZ - 0.07, signRight + 0.12, 6.34, portalZ + frameDepth + 0.09);

	// Two open wooden door leaves, angled outward into the entrance space.
	const doorHeight = pillarHeight * 0.91;
	const hingeLeft = portalCenterX - portalRadius;
	const hingeRight = portalCenterX + portalRadius;
	const leafLength = portalRadius * 0.78;
	const leafAngle = 0.78;
	const makeDoorLeaf = (hingeX, sign) => {
		const endX = hingeX + sign * Math.cos(leafAngle) * leafLength;
		const endZ = portalZ - Math.sin(leafAngle) * leafLength;
		const thickness = 0.12;
		const p0 = [hingeX, 0, portalZ];
		const p1 = [endX, 0, endZ];
		const p2 = [hingeX, doorHeight, portalZ];
		const p3 = [endX, doorHeight, endZ];
		addPortalQuad(p0,p1,p2,p3,[0,0,1]);
		addPortalQuad([p0[0],p0[1],p0[2]+thickness],[p1[0],p1[1],p1[2]+thickness],
			[p2[0],p2[1],p2[2]+thickness],[p3[0],p3[1],p3[2]+thickness],[0,0,-1]);
	};
	// Keep the entrance open; the exhibition title above it is sufficient.
	// Decorative lintel band across the spring line gives the entrance a restrained Persian detail.
	addPortalBox(portalCenterX - portalRadius - frameDepth * 0.25, pillarHeight - 0.18, portalZ - 0.02,
		portalCenterX + portalRadius + frameDepth * 0.25, pillarHeight + 0.08, portalZ + frameDepth + 0.02);
	let elements = Array(position.length / 4)
		.fill()
		.flatMap((_, i) => [i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3]);
	console.timeEnd('gen mesh');
    console.log(placements.length + " available painting placements");
	return {
		placements,
		getAreaIndex,
		getGridSegments,
		getGridParts,
		position,
		normal,
		elements
	};
};
