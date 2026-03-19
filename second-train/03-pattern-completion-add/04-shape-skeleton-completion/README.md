Shape Skeleton Completion Validation

Goal
- Judge whether the output correctly restores the missing structural element.

Read From SDF
- `bbox`: parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

What Should Change
- Primitive count should increase from `initial-sdf` to `pred-sdf` by the same amount as `initial-sdf` to `expected-sdf`.
- The missing structural role should be restored:
- frame beam
- cross arm
- barcode bar
- corner sphere
- Final bbox may stay the same or change, depending on whether the missing part is interior or on the outer boundary.

What Should Stay Unchanged
- Existing layout rule should stay the same.
- Primitive family should stay consistent with the task.
- Thickness, bar spacing, arm direction, or corner pattern should stay consistent with the existing structure.

How To Judge Correct
1. Compare `pred-sdf` bbox with `expected-sdf` bbox.
2. Compare normalized `expr` in `pred-sdf` with normalized `expr` in `expected-sdf`.
3. If exact `expr` match is too strict, check:
- same primitive count delta as expected
- restored part has the correct role, position, orientation, and dimensions

Correct
- `bbox` matches expected, and
- `expr` matches expected, or the fallback checks all pass.

Wrong
- wrong beam/arm/bar/corner location
- wrong dimensions or orientation
- wrong primitive count delta
