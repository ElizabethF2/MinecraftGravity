#!/usr/bin/env python3

# Reformats and delints icon.svg

import sys, os, subprocess, shutil, re

def delint(path):
  if not (xmllint := shutil.which('xmllint')):
    raise Exception('Please install xmllint and/or libxml2')

  svg = subprocess.check_output((xmllint, '--format', path))

  svg = svg.decode()
  svg = re.sub(r'(?s) *<defs.+?</defs>\s*\n', '', svg)
  svg = re.sub(r'<defs.+?/>', '', svg)
  svg = re.sub(r'shape-inside\:url.+?;', '', svg)

  r, e = os.path.splitext(path)
  with open(r + '_delinted' + e, 'x') as f:
    f.write(svg)

def main():
  try:
    path = sys.argv[1]
  except IndexError:
    path = 'icon.svg'
  delint(path)

if __name__ == '__main__':
  main()
