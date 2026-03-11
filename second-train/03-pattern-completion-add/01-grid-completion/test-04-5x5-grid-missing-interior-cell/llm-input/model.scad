union() {
  for (ix = [0:4]) {
    for (iy = [0:4]) {
      if (!(ix == 3 && iy == 3)) {
        translate([ix * 4, iy * 4, 0]) cube(size=[2,2,2], center=false);
      }
    }
  }
}

