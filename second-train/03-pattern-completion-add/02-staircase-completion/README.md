Staircase Completion Validation

Check `sdf`
- `bbox`: compare with `expected-sdf`
- `expr`: compare with `expected-sdf` for exact step layout

Check `admesh`
- `Volume`: should increase from `initial-admesh` to `expected-admesh`
- `Number of facets`: usually increases
- `Number of parts`: usually stays the same unless the missing step is disjoint
- `Size` (`Min/Max X/Y/Z`): should match the final expected bbox

Judge correct
- Step progression must stay consistent
- Missing step or platform block must be added at the expected level
- bbox should change only if the missing step was outside the initial envelope
