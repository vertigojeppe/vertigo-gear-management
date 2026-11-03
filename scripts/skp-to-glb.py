"""SketchUp (.skp) to GLB for plan documents (src/lib/skp-convert.ts).

    python3 skp-to-glb.py <in.skp> <out.glb>

Uses OpenSKP (MIT, no SketchUp needed; pinned in skp-requirements.txt).
Component instances stay instances, so repeated parts are stored once.
Exits non-zero when the file cannot be read.
"""

import json
import struct
import sys


def to_metres(path: str) -> None:
    """OpenSKP writes millimetres, glTF means metres: hang the scene under one node scaled 1/1000."""
    with open(path, "rb") as f:
        data = f.read()
    magic, version, _ = struct.unpack_from("<III", data, 0)
    json_len, json_type = struct.unpack_from("<II", data, 12)
    assert magic == 0x46546C67 and json_type == 0x4E4F534A, "not a GLB"
    gltf = json.loads(data[20 : 20 + json_len])
    rest = data[20 + json_len :]  # the binary chunk, header included
    nodes = gltf.setdefault("nodes", [])
    for scene in gltf.get("scenes", []):
        nodes.append({"name": "metres", "scale": [0.001, 0.001, 0.001], "children": scene.get("nodes", [])})
        scene["nodes"] = [len(nodes) - 1]
    chunk = json.dumps(gltf, separators=(",", ":")).encode()
    chunk += b" " * (-len(chunk) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", magic, version, 12 + 8 + len(chunk) + len(rest)))
        f.write(struct.pack("<II", len(chunk), json_type))
        f.write(chunk)
        f.write(rest)


def main() -> None:
    from openskp import SkpFile
    from openskp.export import instanced_glb

    src, out = sys.argv[1], sys.argv[2]
    skp = SkpFile.open(src)
    skp.parse()
    instanced_glb.export(skp, out, textures=True)
    to_metres(out)


if __name__ == "__main__":
    main()
