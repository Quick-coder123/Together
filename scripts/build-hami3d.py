"""Builds img/hami3d.bin from assets/hami3d-source.glb (Hunyuan3D mesh).
Aligns the body along +X (head forward), feet on y=0, and packs int16 positions + uint16 indices.
Format: uint32 nv, nf | float32 min[3], scale[3] | int16 pos[nv*3] (pad to 4) | uint16 idx[nf*3]
"""
import numpy as np, trimesh, struct, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'assets/hami3d-source.glb'
s = trimesh.load(src); g = list(s.geometry.values())[0]
g.merge_vertices()
v = g.vertices.astype(np.float64); f = g.faces
fm, bm = np.array([0.553, 0.402]), np.array([0.009, -0.056])  # mid of front / back feet (x,z) in the source
d = fm - bm; a = np.arctan2(d[1], d[0]); c, sn = np.cos(a), np.sin(a)
x = v[:, 0] * c + v[:, 2] * sn; z = -v[:, 0] * sn + v[:, 2] * c
ctr = (fm + bm) / 2
v = np.c_[x - (ctr[0] * c + ctr[1] * sn), v[:, 1] - v[:, 1].min(), z - (-ctr[0] * sn + ctr[1] * c)]
mn = v.min(0); sc = (v.max(0) - mn) / 65535
q = np.round((v - mn) / sc - 32768).astype(np.int16)
out = struct.pack('<II', len(v), len(f)) + struct.pack('<6f', *mn, *sc) + q.tobytes()
if len(out) % 4: out += b'\0' * (4 - len(out) % 4)
out += f.astype(np.uint16).tobytes()
open('img/hami3d.bin', 'wb').write(out)
print(len(v), len(f), len(out), 'bytes')
