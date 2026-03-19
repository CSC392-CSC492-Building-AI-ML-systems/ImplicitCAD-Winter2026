# Cube Centered XYZ Size Test

## Description
This test validates center-based absolute placement for cubes.

## Task
- Keep the existing geometry unchanged
- Add a cube with size `[4,6,2]`
- The cube center must be at absolute coordinate `[3,-2,5]`
- Since cube translation is corner-based when `center=false`, compute corner as:
- `corner = center - [size_x/2, size_y/2, size_z/2] = [1,-5,4]`

## Key Learning Points
- Center-to-corner conversion for cube placement
- Absolute coordinate calculations with mixed positive/negative axes
- Parameter reasoning before geometry emission

## Expected Result
The output contains the original object plus one new cube whose center is exactly `[3,-2,5]`.
