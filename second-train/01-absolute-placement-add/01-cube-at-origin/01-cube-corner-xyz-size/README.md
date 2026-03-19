# Cube Corner XYZ Size Test

## Description
This test validates corner-based absolute placement for cubes.

## Task
- Keep the existing geometry unchanged
- Add a cube with size `[4,5,6]`
- Place the cube with corner origin at absolute coordinate `[0,0,0]`
- Use corner semantics (`center=false`)

## Key Learning Points
- Direct corner-based placement for `cube(size=..., center=false)`
- Absolute coordinate interpretation on all three axes
- Clean additive modeling in a `union()` scene

## Expected Result
The output contains the original object plus one new cube exactly at corner `[0,0,0]` with size `[4,5,6]`.
