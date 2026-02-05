{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.python311Full
    pkgs.python311Packages.pip
    pkgs.python311Packages.virtualenv
    pkgs.gdal
    pkgs.proj
    pkgs.geos
    pkgs.gcc
    pkgs.postgresql
  ];
  
  env = {
    PYTHON_LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
      pkgs.stdenv.cc.cc.lib
      pkgs.zlib
      pkgs.glib
      pkgs.xorg.libX11
    ];
  };
}
