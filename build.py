#!/usr/bin/env python3

# Builds the mcpack file for the mod

import subprocess, zipfile, shutil, io

INCLUDE = [
  'scripts/main.js',
  'manifest.json',
]

def main():
  files = {}
  for i in INCLUDE:
    with open(i, 'rb') as f:
      files[i] = f.read()

  if not (magick := shutil.which('magick')):
    raise Exception('Please install ImageMagick')

  ico = subprocess.check_output((
    magick, '-background', 'none', 'icon.svg', 'png:-',
  ))

  buf = io.BytesIO()
  kwargs = {
    'compress_type': zipfile.ZIP_DEFLATED,
    'compresslevel': 9,
  }
  with zipfile.ZipFile(
      buf, 'a', kwargs['compress_type'], allowZip64 = False
    ) as zf:
    for i in INCLUDE:
      zf.writestr(zipfile.ZipInfo(i), files[i], **kwargs)
    zf.writestr(zipfile.ZipInfo('pack_icon.png'), ico, **kwargs)

  with open('Gravity.mcpack', 'xb') as f:
    f.write(buf.getvalue())

if __name__ == '__main__':
  main()
