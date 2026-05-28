// Standalone test of _makeBlackGasket geometry
import * as THREE from 'three';

function makeBlackGasket() {
  const T = 1.5;

  // Rectangular frame with 4 lobes matching the photo
  // Outer path (counterclockwise = solid): start bottom-left, go counterclockwise
  // ┌─────────────────────┐
  // │                     │
  // │     ┌───────┐      │  ← center square hole (clockwise = hole)
  // │     │       │      │
  // │     └───────┘      │
  // │                     │
  // └─────────────────────┘

  const outer = new THREE.Shape();

  // Start at bottom-left corner, go counterclockwise
  const W = 22, H = 24, L = 10;
  outer.moveTo(-W, -H);
  outer.lineTo(-W, -H + L);
  outer.lineTo(-W - L, -H + L);
  outer.lineTo(-W - L, -H);
  // bottom-left lobe done

  outer.lineTo(W + L, -H);
  // bottom edge

  outer.lineTo(W + L, -H + L);
  outer.lineTo(W, -H + L);
  outer.lineTo(W, -H);
  // bottom-right lobe done

  outer.lineTo(W, H - L);
  // right edge

  outer.lineTo(W + L, H - L);
  outer.lineTo(W + L, H);
  outer.lineTo(W, H);
  // top-right lobe done

  outer.lineTo(-W, H);
  // top edge

  outer.lineTo(-W, H - L);
  outer.lineTo(-W - L, H - L);
  outer.lineTo(-W - L, H);
  outer.lineTo(-W - L, H - L);
  // top-left lobe done

  outer.lineTo(-W - L, H - L);
  outer.lineTo(-W, H - L);
  outer.lineTo(-W, -H + L);
  // left edge back to start

  outer.lineTo(-W, -H);
  outer.closePath();

  // Center square hole: clockwise = hole (cutout)
  const sq = 13;
  const hole = new THREE.Path();
  hole.moveTo(-sq, -sq);
  hole.lineTo(-sq, sq);
  hole.lineTo(sq, sq);
  hole.lineTo(sq, -sq);
  hole.closePath();
  outer.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(outer, { depth: T, bevelEnabled: false });
  geo.translate(0, 0, -T / 2);

  // Verify geometry
  const pos = geo.getAttribute('position');
  const inside = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (Math.abs(x) < 10 && Math.abs(y) < 10) inside.push([x.toFixed(1), y.toFixed(1)]);
  }
  console.log('Vertices inside hole area:', inside.length, inside.length === 0 ? '← HOLE WORKS' : '← STILL SOLID');

  // Simple render test via bounding box
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  console.log('BB:', {
    x: [bb.min.x.toFixed(1), bb.max.x.toFixed(1)],
    y: [bb.min.y.toFixed(1), bb.max.y.toFixed(1)],
    z: [bb.min.z.toFixed(1), bb.max.z.toFixed(1)]
  });

  // Dump vertex positions
  console.log('\nFirst 20 vertex positions (x, y, z):');
  for (let i = 0; i < Math.min(20, pos.count); i++) {
    console.log(`  [${i}] ${pos.getX(i).toFixed(2)}, ${pos.getY(i).toFixed(2)}, ${pos.getZ(i).toFixed(2)}`);
  }
}

makeBlackGasket();