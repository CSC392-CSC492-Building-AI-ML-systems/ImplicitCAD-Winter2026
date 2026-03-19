union() {
  for (ix = [0:3]) {
    for (iy = [0:2]) {
      if (!(ix == 1 && iy == 1)) {
        translate([31.2 + ix * 2.6, 18.8 + iy * 3.4, 2.5]) cube(size=[1.25,1.75,1.0], center=false);
      }
    }
  }
}
