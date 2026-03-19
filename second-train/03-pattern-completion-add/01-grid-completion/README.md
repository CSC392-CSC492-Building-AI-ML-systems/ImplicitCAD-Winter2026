Grid Completion Validation

Check `sdf`
- `bbox`: compare with `expected-sdf`
- `expr`: compare with `expected-sdf` if you want exact structure match

Check `admesh`
- `Volume`: should increase from `initial-admesh` to `expected-admesh`
- `Number of facets`: usually increases
- `Number of parts`: may stay the same or increase, depending on whether the missing object is connected
- `Size` (`Min/Max X/Y/Z`): should match the final expected bbox

Judge correct
- If the missing cell is interior: bbox should stay unchanged from `initial`
- If the missing cell is on the outside: bbox should expand to `expected`
- Grid spacing and missing position must match the expected case
