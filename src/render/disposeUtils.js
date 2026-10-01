const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap', 'displacementMap'];

function disposeMaterial(mat) {
  if (!mat) return;
  if (Array.isArray(mat)) { for (const m of mat) disposeMaterial(m); return; }
  for (const k of TEX_KEYS) {
    const t = mat[k];
    // 战役一#8：跳过共享纹理（TextureFactory 缓存实例），dispose 后其他角色仍引用
    if (t && typeof t.dispose === 'function' && !t._shared) t.dispose();
  }
  if (typeof mat.dispose === 'function') mat.dispose();
}

export function deepDispose(root) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse(o => {
    if (o.geometry && typeof o.geometry.dispose === 'function') o.geometry.dispose();
    if (o.material) disposeMaterial(o.material);
  });
}
