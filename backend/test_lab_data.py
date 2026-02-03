#!/usr/bin/env python3
"""Test LAB data loading"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.io_excel import load_all_data

meta, kmr, lab, improved, raw = load_all_data()

print("LAB DataFrame sample:")
print(lab.head(20))
print("\nB hasta LAB verisi:")
b_lab = lab[lab['patient_code'] == 'B']
print(b_lab)
print(f"\nB hasta LAB satır sayısı: {len(b_lab)}")
print(f"KRE null olmayan: {b_lab['kre'].notna().sum()}")
print(f"GFR null olmayan: {b_lab['gfr'].notna().sum()}")
print("\nB hasta LAB time_key'ler:")
print(b_lab[['time_key', 'kre', 'gfr']].to_string())
