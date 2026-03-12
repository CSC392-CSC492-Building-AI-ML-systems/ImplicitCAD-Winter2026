# Cylinder Touching Side of Target Cylinder in X Test

## Description
This test validates the model's ability to position cylinders adjacent to each other with tangential contact, testing cylindrical surface relationships.

## Task
- Start with a target cylinder at origin [0,0,0] with height 4 and radius 2
- Add a second cylinder positioned to touch the side of the target cylinder along the x-axis
- The new cylinder has height 4 and radius 1.5
- For tangential contact: distance between centers = sum of radii = 2 + 1.5 = 3.5
- The new cylinder should be at position [3.5,0,0]

## Key Learning Points
- Cylindrical surface tangency relationships
- Understanding radius-based positioning
- Lateral cylinder positioning along specific axes
- Tangent contact calculation: center_distance = radius1 + radius2
- Cross-cylindrical geometric relationships

## Expected Result
Two cylinders positioned side by side, touching along their curved surfaces, with their axes parallel and aligned in the x-direction.
