# Second Cylinder Stacked Same Axis Test

## Description
This test validates the model's ability to stack cylinders with perfect axial alignment, testing same-primitive positioning and axis continuity.

## Task
- Start with a base cylinder at origin [0,0,0] with height 4 and radius 2
- Add a second cylinder with height 3 and radius 1.5, positioned directly above with same axis
- The second cylinder should be at position [0,0,4] (starting where the first cylinder ends)
- Both cylinders share the same central axis (x=0, y=0)

## Key Learning Points
- Same-primitive stacking (cylinder on cylinder)
- Axial alignment concepts
- Understanding cylindrical coordinate systems
- Continuity in vertical stacking
- Different radii creating a tapered effect

## Expected Result
Two cylinders stacked vertically with perfect axis alignment, creating a tapered tower with the smaller cylinder on top.
