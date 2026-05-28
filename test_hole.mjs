// Standalone test: verify Three.js Shape + hole produces correct geometry
// Run: node --experimental-vm-modules test_hole.js
// Or: npx vite --host --port 5177 (browser will show the real 3D)

import * as THREE from 'three';

function makeBlackGasket() {
  const outerPts = [
    [0, 24.3], [4.7, 21.6], [5.4, 17.6], [8.1, 13.5], [12.2, 10.8],
    [17.6, 8.1], [21.6, 4.1], [23.0, 0], [21.6, -4.1], [17.6, -8.1],
    [12.2, -10.8], [8.1, -13.5], [5.4, -17.6], [4.7, -21.6], [0, -24.3],
    [-4.7, -21.6], [-5.4, -17.6], [-8.1, -13.5], [-12.2, -10.8],
    [-17.6, -8.1], [-21.6, -4.1], [-23.0, 0], [-21.6, 4.1], [-17.6, 8.1],
    [-12.2, 10.8], [-8.1, 13.5], [-5.4, 17.6], [-4.7, 21.6],
  ];
  const curve = new THREE.CatmullRomCurve3(
    outerPts.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'catmullrom', 0.4
  );
  const sampled = curve.getPoints(80);

  // Outer: counterclockwise = solid
  const outer = new THREE.Shape();
  outer.moveTo(sampled[0].x, sampled[0].y);
  for (let i = 1; i < sampled.length; i++) outer.lineTo(sampled[i].x, sampled[i].y);
  outer.closePath();

  // Square center hole: clockwise = hole (cutout)
  const sq = 13;
  const sqHole = new THREE.Path();
  sqHole.moveTo(sq, -sq);
  sqHole.lineTo(sq, sq);
  sqHole.lineTo(-sq, sq);
  sqHole.lineTo(-sq, -sq);
  sqHole.closePath();
  outer.holes.push(sqHole);

  const geo = new THREE.ExtrudeGeometry(outer, { depth: 1.5, bevelEnabled: false });

  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  const totalVerts = posAttr.count;
  const totalTris = idxAttr ? idxAttr.count / 3 : totalVerts / 3;

  console.log('=== Geometry Stats ===');
  console.log('Total vertices:', totalVerts);
  console.log('Total triangles:', totalTris);

  // Count unique vertex positions (rough estimate of hole existence)
  const unique = new Set();
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
    unique.add(key);
  }
  console.log('Unique vertex positions:', unique.size);

  // Check for vertices INSIDE the square hole area (x,y near 0)
  const insideHole = [];
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i);
    if (Math.abs(x) < 10 && Math.abs(y) < 10) {
      insideHole.push([x.toFixed(2), y.toFixed(2), posAttr.getZ(i).toFixed(2)]);
    }
  }
  console.log('Vertices inside square hole area (|x|<10, |y|<10):', insideHole.length);
  if (insideHole.length > 0) {
    console.log('  Sample:', insideHole.slice(0, 5));
  }

  // Expected: hole should produce vertices with z = -T/2 or +T/2 only (flat faces)
  // If hole works, there should be NO vertices inside the hole boundary
  // (the hole is empty space, not filled with geometry)
  if (insideHole.length > 0) {
    console.log('  WARNING: Hole area has vertices — may indicate hole failed');
  } else {
    console.log('  OK: No vertices in hole area — hole is likely correct');
  }

  // Check bounding box
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  console.log('Bounding box:', {
    min: [bb.min.x.toFixed(2), bb.min.y.toFixed(2), bb.min.z.toFixed(2)],
    max: [bb.max.x.toFixed(2), bb.max.y.toFixed(2), bb.max.z.toFixed(2)],
  });

  return geo;
}

makeBlackGasket();