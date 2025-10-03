#!/usr/bin/env python3
import csv, json, sys, os, argparse

def main():
  ap = argparse.ArgumentParser(description='Convert artworks CSV to artworks.json for the site.')
  ap.add_argument('csv_path', help='Path to CSV (e.g., data/artworks.csv)')
  ap.add_argument('-o', '--out', default='data/artworks.json', help='Output JSON path')
  args = ap.parse_args()

  with open(args.csv_path, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = [ {k:(v.strip() if isinstance(v,str) else v) for k,v in r.items()} for r in reader ]

  os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
  with open(args.out, 'w', encoding='utf-8') as f:
    json.dump(rows, f, indent=2, ensure_ascii=False)
  print(f'Wrote {args.out} with {len(rows)} records.')

if __name__ == '__main__':
  import argparse
  main()
