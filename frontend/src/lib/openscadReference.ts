export interface RefItem {
  id: string
  name: string
  syntax: string
  desc: string
  implicitcadOnly?: boolean
  template: string
  params?: { name: string; desc: string }[]
}

export interface RefCategory {
  id: string
  title: string
  items: RefItem[]
}

export const REFERENCE_DATA: RefCategory[] = [
  {
    id: '3d',
    title: '3D Primitives',
    items: [
      { id: 'cube', name: 'cube', syntax: 'cube([x,y,z], center, r)', desc: 'Creates a 3D box. Can have rounded edges (r).', template: 'cube([10, 20, 30], center=true, r=2);\n', implicitcadOnly: true },
      { id: 'sphere', name: 'sphere', syntax: 'sphere(r=N) or sphere(d=N)', desc: 'Creates a 3D sphere.', template: 'sphere(r=15);\n' },
      { id: 'cylinder', name: 'cylinder', syntax: 'cylinder(r, h, center)', desc: 'Creates a cylinder. Use r1, r2 for a cone.', template: 'cylinder(h=20, r=5, center=true);\n' },
      { id: 'torus', name: 'torus', syntax: 'torus(r1, r2)', desc: 'Creates a torus (donut). r1 is major radius, r2 is minor radius.', template: 'torus(r1=20, r2=5);\n', implicitcadOnly: true },
      { id: 'ellipsoid', name: 'ellipsoid', syntax: 'ellipsoid(a, b, c)', desc: 'Creates an ellipsoid with radii a, b, c.', template: 'ellipsoid(a=10, b=15, c=20);\n', implicitcadOnly: true },
    ],
  },
  {
    id: 'csg',
    title: 'CSG Operations',
    items: [
      { id: 'union', name: 'union', syntax: 'union(r=N) { ... }', desc: 'Combines objects. Can smoothly blend interfaces with r.', template: 'union(r=5) {\n    sphere(10);\n    translate([15,0,0]) sphere(10);\n}\n', implicitcadOnly: true },
      { id: 'difference', name: 'difference', syntax: 'difference(r=N) { ... }', desc: 'Subtracts subsequent objects from the first. Can smooth cuts with r.', template: 'difference(r=2) {\n    cube([20,20,20], center=true);\n    sphere(r=13);\n}\n', implicitcadOnly: true },
      { id: 'intersection', name: 'intersection', syntax: 'intersection(r=N) { ... }', desc: 'Keeps only overlapping volume. Can smooth with r.', template: 'intersection(r=1) {\n    sphere(r=15);\n    cube([20,20,20], center=true);\n}\n', implicitcadOnly: true },
    ],
  },
  {
    id: 'transforms',
    title: 'Transforms',
    items: [
      { id: 'translate', name: 'translate', syntax: 'translate([x,y,z])', desc: 'Moves objects.', template: 'translate([10, 0, 0])\n    sphere(5);\n' },
      { id: 'rotate', name: 'rotate', syntax: 'rotate([x,y,z])', desc: 'Rotates objects around axes in degrees.', template: 'rotate([90, 0, 0])\n    cylinder(h=20, r=5);\n' },
      { id: 'scale', name: 'scale', syntax: 'scale([x,y,z])', desc: 'Scales objects.', template: 'scale([2, 1, 1])\n    sphere(5);\n' },
    ],
  },
]

/** Flat lookup by function name */
export const REFERENCE_MAP = new Map<string, RefItem>(
  REFERENCE_DATA.flatMap((cat) => cat.items).map((item) => [item.name, item])
)

/** All builtin function names from the Monarch language definition */
export const ALL_BUILTINS: string[] = [
  'cube', 'sphere', 'cylinder', 'polyhedron', 'circle', 'square', 'polygon',
  'union', 'difference', 'intersection', 'hull', 'minkowski',
  'translate', 'rotate', 'scale', 'mirror', 'multmatrix',
  'linear_extrude', 'rotate_extrude', 'surface', 'projection',
  'color', 'offset', 'resize',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'abs', 'ceil', 'floor', 'round', 'min', 'max', 'pow', 'sqrt', 'exp', 'log', 'ln',
  'len', 'str', 'chr', 'ord', 'concat', 'lookup', 'search',
  'echo', 'render', 'children',
  'torus', 'ellipsoid', 'cone',
]

export const KEYWORDS: string[] = [
  'module', 'function', 'if', 'else', 'for', 'let', 'each', 'true', 'false', 'undef',
]

export const SPECIAL_VARS: string[] = [
  '$fn', '$fs', '$fa', '$quality', '$t', '$vpr', '$vpt', '$vpd', '$children',
]
