Staircase Completion Validation

Goal
- Judge whether the output correctly restores the missing staircase step or platform block.

Read From SDF
- `bbox`: parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

What Should Change
- Primitive count should increase from `initial-sdf` to `pred-sdf` by the same amount as `initial-sdf` to `expected-sdf`.
- The missing step/block should restore the staircase progression.
- Final bbox may change if the missing step was on the outside of the staircase envelope.

What Should Stay Unchanged
- Primitive type should stay consistent with the task.
- Existing x progression and z progression rule should stay the same.
- For two-level tasks, the level structure should stay the same except for the missing block being restored.

How To Judge Correct
1. Compare `pred-sdf` bbox with `expected-sdf` bbox.
2. Compare normalized `expr` in `pred-sdf` with normalized `expr` in `expected-sdf`.
3. If exact `expr` match is too strict, check:
- same primitive count delta as expected
- same x step and z step pattern as expected
- restored object is on the correct level and step index

Correct
- `bbox` matches expected, and
- `expr` matches expected, or the fallback checks all pass.

Wrong
- bbox differs unexpectedly
- missing step restored at the wrong x or z
- wrong level in two-level tasks
- wrong primitive count delta
