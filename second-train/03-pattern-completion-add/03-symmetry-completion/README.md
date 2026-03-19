Symmetry Completion Validation

Goal
- Judge whether the output correctly adds the missing symmetric object.

Read From SDF
- `bbox`: parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

What Should Change
- Primitive count should increase from `initial-sdf` to `pred-sdf` by the same amount as `initial-sdf` to `expected-sdf`.
- The missing mirrored object should be added.
- Final bbox may expand if the missing symmetric partner was outside the current bbox.

What Should Stay Unchanged
- Primitive type and size parameters should match the existing symmetric set.
- Existing symmetry rule should stay the same:
- `x=0`: mirror `x`
- `y=0`: mirror `y`
- four-quadrant: mirror both axes

How To Judge Correct
1. Compare `pred-sdf` bbox with `expected-sdf` bbox.
2. Compare normalized `expr` in `pred-sdf` with normalized `expr` in `expected-sdf`.
3. If exact `expr` match is too strict, check:
- same primitive count delta as expected
- mirrored counterpart exists at the correct coordinate
- primitive type and dimensions match the partner object

Correct
- `bbox` matches expected, and
- `expr` matches expected, or the fallback checks all pass.

Wrong
- symmetric partner missing or mirrored across the wrong axis
- wrong primitive type, radius, or height
- wrong primitive count delta
