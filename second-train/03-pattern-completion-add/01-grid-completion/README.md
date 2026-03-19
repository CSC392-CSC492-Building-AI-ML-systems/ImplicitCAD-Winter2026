Grid Completion Validation

Goal
- Judge whether the output correctly restores the missing grid object.

Read From SDF
- `bbox`: parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

What Should Change
- Primitive count should increase from `initial-sdf` to `pred-sdf` by the same amount as `initial-sdf` to `expected-sdf`.
- The added object should appear on the same grid lattice as the existing objects.
- In tasks where the missing object is on the outer boundary, the final bbox may expand to match `expected-sdf`.

What Should Stay Unchanged
- Primitive type should stay consistent with the task.
- Existing grid spacing rule should stay the same.
- If the missing object is interior, bbox should stay the same as `initial-sdf`.

How To Judge Correct
1. Compare `pred-sdf` bbox with `expected-sdf` bbox.
2. Compare normalized `expr` in `pred-sdf` with normalized `expr` in `expected-sdf`.
3. If exact `expr` match is too strict, check:
- same primitive count delta as expected
- same x/y step pattern as expected
- added object is at the missing lattice position

Correct
- `bbox` matches expected, and
- `expr` matches expected, or the fallback checks all pass.

Wrong
- bbox differs when it should not
- added object is off the lattice
- wrong primitive count delta
- wrong primitive type or wrong missing position
