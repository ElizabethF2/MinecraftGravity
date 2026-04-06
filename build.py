#!/usr/bin/env python3

# Builds the mcpack files for the mod

import subprocess, zipfile, shutil, io

INCLUDE = [
  'scripts/main.js',
  'manifest.json',
]

def make(files, ico, fname):
  buf = io.BytesIO()
  compress_type = zipfile.ZIP_DEFLATED
  kwargs = {
    'compress_type': compress_type,
    'compresslevel': 9,
  }

  with zipfile.ZipFile(buf, 'a', compress_type, allowZip64 = False) as zf:
    for i, data in files.items():
      zf.writestr(zipfile.ZipInfo(i), data, **kwargs)
    zf.writestr(zipfile.ZipInfo('pack_icon.png'), ico, **kwargs)

  with open(fname, 'xb') as f:
    f.write(buf.getvalue())

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

  make(files, ico, 'Gravity.mcpack')

  with open('manifest_stable.json', 'rb') as f:
    files['manifest.json'] = f.read()
  make(files, ico, 'Gravity_stable.mcpack')

if __name__ == '__main__':
  main()
