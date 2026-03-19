union() {
  for (ix = [0:2]) {
    for (iy = [0:3]) {
      if (!(ix == 2 && iy == 3)) {
        translate([18.5 + ix * 3.25, 26.25 + iy * 2.75, 1.25]) cube(size=[1.5,1.5,1.5], center=false);
      }
    }
  }
}
