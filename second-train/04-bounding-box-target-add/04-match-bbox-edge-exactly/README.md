BBox Edge Match Validation

Check `sdf`
- `bbox`: compare with `expected-sdf`
- `expr`: compare with `expected-sdf` for exact placement

Check `admesh`
- `Size` (`Min/Max X/Y/Z`): two target bbox sides should hit the expected values
- `Volume`: should increase
- `Number of facets`: usually increases

Judge correct
- The correct pair of bbox sides changed
- Both target edge coordinates are matched exactly
- The remaining axis should not expand unexpectedly
