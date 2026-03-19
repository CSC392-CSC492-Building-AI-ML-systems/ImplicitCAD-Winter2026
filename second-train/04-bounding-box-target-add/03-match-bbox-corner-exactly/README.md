BBox Corner Match Validation

Goal
- Judge whether the output adds an object whose min or max corner lands exactly on the target bbox corner condition.

Read From SDF
- `bbox`: parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

What Should Change
- The intended corner-driving object should be added.
- Primitive count should increase from `initial-sdf` to `pred-sdf`.
- The final bbox should match `expected-sdf`.

What Should Stay Unchanged
- Non-required bbox sides should stay equal to the initial scene when the prompt does not ask to change them.
- Existing objects should not move or resize.

How To Judge Correct
1. Compare `pred-sdf` bbox with `expected-sdf` bbox.
2. Check the required corner condition:
- for max-corner tasks, the new object max corner must hit the target
- for min-corner tasks, the new object min corner must hit the target
3. Compare normalized `expr` in `pred-sdf` with normalized `expr` in `expected-sdf`.

Correct
- final bbox matches expected
- the target corner condition is met exactly
- added object placement and size match expected

Wrong
- wrong min/max side touched
- target corner coordinates do not match
- extra bbox boundaries changed unexpectedly
