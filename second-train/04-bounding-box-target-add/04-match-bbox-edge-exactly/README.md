BBox Edge Match Validation

Goal
- Judge whether the output adds an object that makes the final bbox hit a target edge condition, meaning two bbox planes are matched exactly at the same time.

Read From SDF
- `bbox`: parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

What Should Change
- Two target bbox boundaries should move to the required values together.
- Primitive count should increase from `initial-sdf` to `pred-sdf`.

What Should Stay Unchanged
- The third axis should stay within the intended non-expanding range.
- Other non-target bbox boundaries should stay equal to the initial scene when required.
- Existing objects should not move or resize.

How To Judge Correct
1. Compare `pred-sdf` bbox with `expected-sdf` bbox.
2. Check that both target bbox planes are hit exactly.
3. Check that the remaining axis does not expand unexpectedly.
4. Compare normalized `expr` in `pred-sdf` with normalized `expr` in `expected-sdf`.

Correct
- final bbox matches expected
- both target bbox sides are hit exactly
- non-target bbox sides stay correct

Wrong
- only one target side is matched
- wrong pair of bbox planes changed
- third axis expands unexpectedly
