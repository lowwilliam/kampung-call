# Raw Singapore asset intermediates

These five GLBs are intermediate build inputs, not production models.

`scripts/export-singapore-assets.mjs` exports the procedural Three.js models
from `src/singapore-assets/models.js` into this directory. Blender then imports,
cleans, reviews, and exports them through
`scripts/blender/refine-singapore-asset-pack.py`.

The production outputs are the matching `assets/<id>-v1.blend` and
`assets/<id>-v1.glb` files. The final GLBs are expected to differ from these raw
files. The game and collection must always reference the files under `assets/`,
never this directory.
