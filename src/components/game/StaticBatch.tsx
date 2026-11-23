import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * STATIC BATCHING
 *
 * After its children mount, merges every static mesh that shares a material
 * into a single mesh (transforms baked in), then hides the originals. A
 * location built from 200 small meshes renders in ~15 draw calls — essential
 * for phones.
 *
 * Subtrees whose transforms animate must opt out with `userData={{ noBatch: true }}`
 * (see <Dynamic>). Batching runs once on mount; remount with a new `key` to rebuild.
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  const merged = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = root.current;
    const out = merged.current;
    if (!group || !out) return;
    group.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean; renderOrder: number }>();
    const hidden: THREE.Mesh[] = [];

    const visit = (o: THREE.Object3D) => {
      if (o.userData.noBatch) return;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material) && o.visible) {
        const mat = mesh.material as THREE.Material;
        // Transparent materials are left alone so sorting stays correct.
        if (!mat.transparent) {
          const src = mesh.geometry;
          let g = src.index ? src.toNonIndexed() : src.clone();
          for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
          if (!g.attributes.normal) g.computeVertexNormals();
          g.morphAttributes = {};
          g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
          let b = buckets.get(mat);
          if (!b) buckets.set(mat, (b = { geos: [], cast: false, receive: false, renderOrder: mesh.renderOrder }));
          b.geos.push(g);
          b.cast ||= mesh.castShadow;
          b.receive ||= mesh.receiveShadow;
          hidden.push(mesh);
        }
      }
      for (const c of o.children) visit(c);
    };
    for (const c of group.children) visit(c);

    const created: THREE.Mesh[] = [];
    buckets.forEach((b, mat) => {
      if (b.geos.length < 2) {
        b.geos.forEach((g) => g.dispose());
        return; // a single mesh gains nothing from batching
      }
      const geo = mergeGeometries(b.geos, false);
      b.geos.forEach((g) => g.dispose());
      if (!geo) return;
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = b.cast;
      m.receiveShadow = b.receive;
      m.renderOrder = b.renderOrder;
      m.matrixAutoUpdate = false;
      out.add(m);
      created.push(m);
    });
    // Hide only meshes that were actually merged.
    const mergedMats = new Set(created.map((m) => m.material as THREE.Material));
    for (const h of hidden) if (mergedMats.has(h.material as THREE.Material)) h.visible = false;

    return () => {
      for (const m of created) {
        out.remove(m);
        m.geometry.dispose();
      }
      for (const h of hidden) h.visible = true;
    };
  }, []);

  return (
    <group>
      <group ref={root}>{children}</group>
      <group ref={merged} />
    </group>
  );
}

/** Marks a subtree as animated so StaticBatch leaves it alone. */
export function Dynamic({ children, ...props }: { children: ReactNode } & Omit<ThreeElements['group'], 'children'>) {
  return (
    <group {...props} userData={{ noBatch: true }}>
      {children}
    </group>
  );
}
