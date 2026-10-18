type ThreeMod = typeof import("three");

export function disposeObject(obj: {
  traverse: (
    fn: (node: {
      geometry?: { dispose: () => void };
      material?: { dispose: () => void } | Array<{ dispose: () => void }>;
    }) => void,
  ) => void;
}): void {
  obj.traverse((node) => {
    node.geometry?.dispose();
    const mat = node.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

export function loadThree(): Promise<ThreeMod> {
  return import("three");
}

export function hologramMaterials(THREE: ThreeMod, color: number) {
  const fill = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const edge = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
  });
  return { fill, edge };
}

export function ghostMaterials(THREE: ThreeMod, color: number) {
  const fill = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const edge = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.88,
  });
  return { fill, edge };
}

export function frameObject(
  THREE: ThreeMod,
  camera: InstanceType<ThreeMod["PerspectiveCamera"]>,
  obj: { updateMatrixWorld?: (force: boolean) => void },
  lift = 0.72,
) {
  obj.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z, 0.55);
  camera.position.set(center.x + max * 1.1, center.y + max * lift, center.z + max * 1.2);
  camera.lookAt(center.x, center.y * 0.88, center.z);
  camera.updateProjectionMatrix();
}
