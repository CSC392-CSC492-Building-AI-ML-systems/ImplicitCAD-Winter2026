Symmetry Completion Validation

Goal
- Validate whether a model correctly adds the missing symmetric object(s).

Input Files
- `initial-sdf`: SDF output from the incomplete symmetric scene.
- `expected-sdf`: SDF output from the correct completed scene.
- `pred-sdf` (runtime): SDF output from the model prediction result.

Fields to Use from SDF
- `bbox`: Parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: Parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

Recommended Validation Order
1. `bbox` match:
- Compare `pred-sdf` bbox with `expected-sdf` bbox.
- Tolerance: absolute error <= `1e-6` per coordinate.
2. `expr` exact match (normalized whitespace).
3. Symmetry-specific structure checks (fallback):
- Primitive count increase from `initial` to `pred` matches `initial->expected`.
- Mirrored counterpart exists for the target axis/axes:
- `x=0`: mirrored point `(x,y,z)` -> `(-x,y,z)`
- `y=0`: mirrored point `(x,y,z)` -> `(x,-y,z)`
- four-quadrant: both axis constraints hold.
- Primitive type/radius/height matches the expected partner.

Pass Rule
- Pass if step 1 and step 2 are true.
- If exact expression is relaxed, require step 1 + all step 3 checks.
