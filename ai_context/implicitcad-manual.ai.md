# ImplicitCAD ExtOpenSCAD Quick Reference for LLMs

Purpose
This document is optimized as reference context for code generation. It focuses on the modules and calling forms that this project expects the model to use.

Hard rules
1 Generate ImplicitCAD ExtOpenSCAD code, not pure OpenSCAD
2 Prefer named parameters, avoid positional parameters
3 Output only the new object code fragment unless the task explicitly asks for a full file
4 Angles for geometric transforms and sweep parameters are degrees
5 Trig functions sin cos tan take radians
6 Avoid using rotate as much as possible

Output contract for shape completion tasks
1 Do not modify existing objects
2 Only add the missing object as a single module call or a small wrapper plus module call
3 Keep transforms minimal and explicit
4 Prefer center false unless the problem statement asks for centering

Canonical module forms
## 3D primitives
### sphere
Signature
```scad
sphere(r=R);
sphere(d=D);
```
Canonical form
```scad
sphere(r=R);
```
Common mistakes
1 Do not confuse r and d

### cube
Signature
```scad
cube(size=N, center=false);
cube(size=[x,y,z], center=false);
```
Canonical form
```scad
cube(size=[x,y,z], center=false);
```
Common mistakes
1 Do not assume only cube([x,y,z])

### cylinder
Signature
```scad
cylinder(r=R, h=H, center=false);
cylinder(r1=R1, r2=R2, h=H, center=false);
cylinder(d=D, h=H, center=false);
cylinder(d1=D1, d2=D2, h=H, center=false);
```
Canonical form
```scad
cylinder(r=R, h=H, center=false);
```
Common mistakes
1 r1 and r2 indicate a frustum, a tapered cylinder
2 Prefer named parameters

### cone
Signature
```scad
cone(r=R, h=H, center=false);
cone(r1=R1, r2=R2, h=H, center=false);
```
Canonical form
```scad
cone(r1=R1, r2=R2, h=H, center=false);
```

### torus
Signature
```scad
torus(R=R, r=r);
```

### ellipsoid
Signature
```scad
ellipsoid(rx=Rx, ry=Ry, rz=Rz);
```

## 2D primitives
### square
Signature
```scad
square(size=N, center=false);
square(size=[x,y], center=false);
```

### circle
Signature
```scad
circle(r=R);
circle(d=D);
```

### polygon
Signature
```scad
polygon(points=[[x1,y1],[x2,y2],...]);
polygon(points=..., paths=[[0,1,2,...]]);
```

## CSG operations
### union
```scad
union() { ... }
```
### intersection
```scad
intersection() { ... }
```
### difference
```scad
difference() { ... }
```

## Transforms
### translate
```scad
translate([dx,dy,dz]) { ... }
```
### rotate
```scad
rotate([ax,ay,az]) { ... }     // degrees
rotate(a=A, v=[x,y,z]) { ... } // degrees
```
### scale
```scad
scale([sx,sy,sz]) { ... }
```
### mirror
```scad
mirror([nx,ny,nz]) { ... }
```
### multmatrix
```scad
multmatrix([[...],[...],[...],[...]]) { ... } // 4x4
```

## Extrusions
### linear_extrude
```scad
linear_extrude(height=H) { ... }
linear_extrude(height=H, twist=T) { ... }
linear_extrude(height=H, translate=[dx,dy]) { ... }
```
Notes
1 height can be a number or a function height(x,y) in this dialect
2 twist can be a number or a function twist(z)
3 translate can be a vector or a function translate(z)

### rotate_extrude
```scad
rotate_extrude(angle=A) { ... } // degrees
```

## ImplicitCAD specific utility
### shell
```scad
shell(r=R) { ... }
```
### projection
```scad
projection(cut=false) { ... }
```
### pack
```scad
pack(spacing=S) { ... }
```
### color
```scad
color([r,g,b,a]) { ... }
```
### echo
```scad
echo(value);
```

Not supported in this project
1 OpenSCAD polyhedron import surface text
2 Any module that is not listed above unless explicitly allowed by the reference document

Version note
This reference is aligned with the primitive module definitions in Graphics Implicit ExtOpenScad Primitives hs as of 2026-03-02.
