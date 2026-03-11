union() {
  for (ix = [0:3]) {
    for (iy = [0:3]) {
      if (!(ix == 3 && iy == 2)) {
        translate([ix * 4, iy * 4, 0]) cube(size=[2,2,2], center=false);
      }
    }
  }
}

