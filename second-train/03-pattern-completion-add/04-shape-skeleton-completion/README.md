Shape Skeleton Completion Validation

Goal
- Validate whether a model correctly restores missing structural elements
  (frame beam, cross arm, barcode bar, corner sphere, etc.).

Input Files
- `initial-sdf`: SDF output from the incomplete skeleton shape.
- `expected-sdf`: SDF output from the correct completed skeleton.
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
3. Skeleton-specific structure checks (fallback):
- Primitive count increase from `initial` to `pred` matches `initial->expected`.
- Missing structural role is restored:
- frame: missing beam added with correct length/thickness/orientation
- cross: missing arm added on correct side and axis
- barcode: missing bar added at correct x index with correct height
- corner set: missing corner primitive added at correct corner coordinate

Pass Rule
- Pass if step 1 and step 2 are true.
- If exact expression is relaxed, require step 1 + all step 3 checks.
