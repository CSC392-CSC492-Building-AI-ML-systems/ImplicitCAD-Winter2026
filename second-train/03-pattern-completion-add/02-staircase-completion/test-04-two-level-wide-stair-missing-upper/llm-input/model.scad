union() {
  translate([0, 0, 0]) cube(size=[2,5,2], center=false);
  translate([3, 0, 0]) cube(size=[2,5,2], center=false);
  translate([6, 0, 0]) cube(size=[2,5,2], center=false);
  translate([9, 0, 0]) cube(size=[2,5,2], center=false);

  translate([3, 0, 2]) cube(size=[2,5,2], center=false);
  translate([9, 0, 2]) cube(size=[2,5,2], center=false);
}

