Staircase Completion Validation

Goal
- Validate whether a model correctly completes missing step/platform objects.

Input Files
- `initial-sdf`: SDF output from the incomplete staircase model.
- `expected-sdf`: SDF output from the correct completed staircase.
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
3. Stair-specific structure checks (fallback):
- Primitive count increase from `initial` to `pred` matches `initial->expected`.
- Step progression rule is preserved (same x step and z step pattern as expected).
- For two-level tasks, missing block appears on the correct level (correct z band).

Pass Rule
- Pass if step 1 and step 2 are true.
- If exact expression is relaxed, require step 1 + all step 3 checks.
