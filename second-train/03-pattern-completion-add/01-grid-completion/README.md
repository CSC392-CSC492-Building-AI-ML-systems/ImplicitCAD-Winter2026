Grid Completion Validation

Goal
- Validate whether a model correctly completes missing objects in grid-style tasks.

Input Files
- `initial-sdf`: SDF output from the incomplete input model.
- `expected-sdf`: SDF output from the correct completed model.
- `pred-sdf` (runtime): SDF output from the model prediction result.

Fields to Use from SDF
- `bbox`: Parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: Parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

Recommended Validation Order
1. `bbox` match:
- Compare `pred-sdf` bbox with `expected-sdf` bbox.
- Tolerance: absolute error <= `1e-6` per coordinate.
2. `expr` exact match (normalized whitespace):
- Normalize repeated spaces and line endings, then compare full `union [...]` string.
3. Grid-specific structure checks (fallback if exact expression comparison is too strict):
- Primitive count increase from `initial` to `pred` equals `initial->expected` increase.
- X/Y positions follow the same grid step as expected.
- Added primitive lies on the existing lattice (same z level and same spacing rule).

Pass Rule
- Pass if step 1 and step 2 are true.
- If step 2 is intentionally relaxed, require step 1 + all step 3 checks.
