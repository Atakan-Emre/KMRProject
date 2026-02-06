#!/usr/bin/env python3
"""
Full system integrity check:
- Optional pipeline run (Excel -> JSON generation)
- data.xlsx vs JSON value matching checks
- JSON schema/consistency checks
- Frontend lint/build checks
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import FRONTEND_PUBLIC  # noqa: E402
from backend.io_excel import extract_meta, load_excel, wide_to_long_kmr, wide_to_long_lab  # noqa: E402
from backend.run_all import run_pipeline  # noqa: E402
from backend.time_mapping import KMR_TIME_MAP, LAB_TIME_MAP, UNIFIED_TIME_MAP  # noqa: E402


REQUIRED_JSON_FILES = [
    "reference_band.json",
    "cohort_trajectory.json",
    "cohort_trajectory_lab.json",
    "data_summary.json",
    "patient_features.json",
    "channel_overview.json",
]

RISK_LEVELS = {"Normal", "Dikkat", "Kritik", "Çok Kritik"}


@dataclass
class Issue:
    level: str  # error | warning
    message: str


class Checker:
    def __init__(self) -> None:
        self.issues: List[Issue] = []
        self.passed_checks = 0

    def ok(self) -> None:
        self.passed_checks += 1

    def error(self, message: str) -> None:
        self.issues.append(Issue(level="error", message=message))

    def warning(self, message: str) -> None:
        self.issues.append(Issue(level="warning", message=message))

    def check(self, condition: bool, on_fail: str, *, warning: bool = False) -> None:
        if condition:
            self.ok()
            return
        if warning:
            self.warning(on_fail)
        else:
            self.error(on_fail)

    @property
    def errors(self) -> List[Issue]:
        return [i for i in self.issues if i.level == "error"]

    @property
    def warnings(self) -> List[Issue]:
        return [i for i in self.issues if i.level == "warning"]


def run_cmd(cmd: List[str], cwd: Path, checker: Checker, label: str) -> None:
    print(f"\n[RUN] {label}: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    print(result.stdout)
    checker.check(result.returncode == 0, f"{label} failed with exit code {result.returncode}")


def load_json_file(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def is_close_or_none(a: Any, b: Any, tol: float) -> bool:
    if a is None and b is None:
        return True
    if (a is None) != (b is None):
        return False
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


def validate_no_nonfinite(obj: Any, checker: Checker, where: str) -> None:
    def walk(node: Any, path: str) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{path}.{k}")
            return
        if isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]")
            return
        if isinstance(node, float):
            if not math.isfinite(node):
                checker.error(f"{where}: non-finite float at {path}")
            return
        if isinstance(node, str):
            if node.strip().lower() in {"nan", "inf", "-inf", "infinity", "-infinity"}:
                checker.error(f"{where}: invalid numeric string at {path}: {node!r}")
            return

    walk(obj, "$")
    checker.ok()


def build_excel_maps(df: pd.DataFrame) -> Tuple[Dict[Tuple[str, str], float], Dict[Tuple[str, str], float], Dict[Tuple[str, str], float]]:
    kmr_long = wide_to_long_kmr(df)
    lab_long = wide_to_long_lab(df)

    kmr_map: Dict[Tuple[str, str], float] = {}
    kre_map: Dict[Tuple[str, str], float] = {}
    gfr_map: Dict[Tuple[str, str], float] = {}

    for _, r in kmr_long.iterrows():
        kmr_map[(str(r["patient_code"]), str(r["time_key"]))] = round(float(r["kmr"]), 4)

    for _, r in lab_long.iterrows():
        patient = str(r["patient_code"])
        time_key = str(r["time_key"])
        if pd.notna(r["kre"]):
            kre_map[(patient, time_key)] = round(float(r["kre"]), 2)
        if pd.notna(r["gfr"]):
            gfr_map[(patient, time_key)] = round(float(r["gfr"]), 1)

    return kmr_map, kre_map, gfr_map


def main() -> int:
    parser = argparse.ArgumentParser(description="Full integrity check for backend JSON outputs and frontend build.")
    parser.add_argument("--skip-pipeline", action="store_true", help="Skip backend run_all pipeline execution.")
    parser.add_argument("--skip-frontend", action="store_true", help="Skip frontend lint/build checks.")
    args = parser.parse_args()

    checker = Checker()
    start = time.time()

    print("=" * 70)
    print("KMR Full System Check")
    print("=" * 70)

    if not args.skip_pipeline:
        print("\n[STEP] Running backend pipeline...")
        try:
            run_pipeline()
            checker.ok()
        except Exception as exc:  # noqa: BLE001
            checker.error(f"Pipeline execution failed: {exc}")
    else:
        print("\n[STEP] Skipping backend pipeline (--skip-pipeline).")

    print("\n[STEP] Reading Excel and generated JSON artifacts...")
    excel_df = load_excel()
    meta_df = extract_meta(excel_df).copy()
    meta_df["patient_code"] = meta_df["patient_code"].astype(str)
    meta_df["improved_proxy"] = meta_df["patient_code"].map(
        {
            str(row["patient_code"]): any(
                pd.notna(row.get(col))
                for col in ["Month_9", "Month_10", "Month_11", "Month_12"]
                if col in excel_df.columns
            )
            for _, row in excel_df.iterrows()
        }
    )

    kmr_map, kre_map, gfr_map = build_excel_maps(excel_df)
    patients_from_excel = set(meta_df["patient_code"].tolist())

    for filename in REQUIRED_JSON_FILES:
        path = FRONTEND_PUBLIC / filename
        checker.check(path.exists(), f"Missing JSON file: {path}")

    patients_dir = FRONTEND_PUBLIC / "patients"
    checker.check(patients_dir.exists(), f"Missing patients directory: {patients_dir}")

    if checker.errors:
        print("\n[FAIL FAST] Required output files are missing.")
        return 1

    reference_band = load_json_file(FRONTEND_PUBLIC / "reference_band.json")
    cohort_trajectory = load_json_file(FRONTEND_PUBLIC / "cohort_trajectory.json")
    cohort_trajectory_lab = load_json_file(FRONTEND_PUBLIC / "cohort_trajectory_lab.json")
    data_summary = load_json_file(FRONTEND_PUBLIC / "data_summary.json")
    patient_features = load_json_file(FRONTEND_PUBLIC / "patient_features.json")
    channel_overview = load_json_file(FRONTEND_PUBLIC / "channel_overview.json")

    validate_no_nonfinite(reference_band, checker, "reference_band.json")
    validate_no_nonfinite(cohort_trajectory, checker, "cohort_trajectory.json")
    validate_no_nonfinite(cohort_trajectory_lab, checker, "cohort_trajectory_lab.json")
    validate_no_nonfinite(data_summary, checker, "data_summary.json")
    validate_no_nonfinite(patient_features, checker, "patient_features.json")
    validate_no_nonfinite(channel_overview, checker, "channel_overview.json")

    features = patient_features.get("patients", [])
    checker.check(isinstance(features, list), "patient_features.json: 'patients' must be a list")
    feature_map: Dict[str, Dict[str, Any]] = {}
    for item in features:
        code = str(item.get("patient_code"))
        if code in feature_map:
            checker.error(f"Duplicate patient in patient_features.json: {code}")
        feature_map[code] = item

    checker.check(
        len(feature_map) == len(patients_from_excel),
        f"patient_features count mismatch (json={len(feature_map)} excel={len(patients_from_excel)})",
    )

    required_timeline_keys = {
        "time_key",
        "time_order",
        "pseudo_time_days",
        "kmr",
        "kre",
        "gfr",
        "risk_score",
        "risk_level",
        "kmr_anomaly_flag",
        "kre_anomaly_flag",
        "gfr_anomaly_flag",
        "risk_components",
    }

    anomaly_patients = 0
    computed_risk_distribution = {"Normal": 0, "Dikkat": 0, "Kritik": 0, "Çok Kritik": 0}
    improved_count = 0

    for patient_code in sorted(patients_from_excel):
        patient_file = patients_dir / f"{patient_code}.json"
        checker.check(patient_file.exists(), f"Missing patient JSON: {patient_file.name}")
        if not patient_file.exists():
            continue

        patient_json = load_json_file(patient_file)
        validate_no_nonfinite(patient_json, checker, f"patients/{patient_file.name}")

        meta = patient_json.get("meta", {})
        timeline = patient_json.get("timeline", [])
        last_status = patient_json.get("last_status", {})
        feature = feature_map.get(patient_code)

        checker.check(meta.get("patient_code") == patient_code, f"{patient_code}: meta.patient_code mismatch")
        checker.check(isinstance(timeline, list), f"{patient_code}: timeline is not a list")
        checker.check(feature is not None, f"{patient_code}: missing from patient_features.json")

        if meta.get("improved_proxy") is True:
            improved_count += 1

        time_orders = []
        has_any_anomaly = False
        kmr_anomaly = False
        kre_anomaly = False
        gfr_anomaly = False

        for idx, point in enumerate(timeline):
            missing = required_timeline_keys - set(point.keys())
            checker.check(not missing, f"{patient_code}: timeline[{idx}] missing keys: {sorted(missing)}")

            tk = point.get("time_key")
            to = point.get("time_order")
            if tk in UNIFIED_TIME_MAP:
                checker.check(to == UNIFIED_TIME_MAP[tk]["order"], f"{patient_code} {tk}: time_order mismatch")
            else:
                checker.error(f"{patient_code}: unknown time_key in timeline: {tk}")

            time_orders.append(to)

            expected_kmr = kmr_map.get((patient_code, tk))
            expected_kre = kre_map.get((patient_code, tk))
            expected_gfr = gfr_map.get((patient_code, tk))

            checker.check(
                is_close_or_none(point.get("kmr"), expected_kmr, 1e-4),
                f"{patient_code} {tk}: KMR mismatch (json={point.get('kmr')} excel={expected_kmr})",
            )
            checker.check(
                is_close_or_none(point.get("kre"), expected_kre, 1e-2),
                f"{patient_code} {tk}: KRE mismatch (json={point.get('kre')} excel={expected_kre})",
            )
            checker.check(
                is_close_or_none(point.get("gfr"), expected_gfr, 1e-1),
                f"{patient_code} {tk}: GFR mismatch (json={point.get('gfr')} excel={expected_gfr})",
            )

            risk_score = point.get("risk_score")
            checker.check(isinstance(risk_score, (int, float)), f"{patient_code} {tk}: risk_score invalid type")
            if isinstance(risk_score, (int, float)):
                checker.check(0 <= float(risk_score) <= 100, f"{patient_code} {tk}: risk_score out of range [0,100]")
            checker.check(point.get("risk_level") in RISK_LEVELS, f"{patient_code} {tk}: invalid risk_level")

            if point.get("kmr_anomaly_flag"):
                kmr_anomaly = True
                has_any_anomaly = True
            if point.get("kre_anomaly_flag"):
                kre_anomaly = True
                has_any_anomaly = True
            if point.get("gfr_anomaly_flag"):
                gfr_anomaly = True
                has_any_anomaly = True

        sorted_orders = sorted(x for x in time_orders if isinstance(x, int))
        checker.check(time_orders == sorted_orders, f"{patient_code}: timeline not sorted by time_order")
        checker.check(len(sorted_orders) == len(set(sorted_orders)), f"{patient_code}: duplicate time_order in timeline")

        if has_any_anomaly:
            anomaly_patients += 1

        # last_status checks
        def last_non_null(field: str) -> Tuple[Any, Any]:
            for p in reversed(timeline):
                if p.get(field) is not None:
                    return p.get("time_order"), p.get(field)
            return None, None

        kmr_order, kmr_last = last_non_null("kmr")
        kre_order, kre_last = last_non_null("kre")
        gfr_order, gfr_last = last_non_null("gfr")

        checker.check(last_status.get("last_kmr_order") == kmr_order, f"{patient_code}: last_kmr_order mismatch")
        checker.check(last_status.get("last_kre_order") == kre_order, f"{patient_code}: last_kre_order mismatch")
        checker.check(last_status.get("last_gfr_order") == gfr_order, f"{patient_code}: last_gfr_order mismatch")
        checker.check(is_close_or_none(last_status.get("kmr_last"), kmr_last, 1e-4), f"{patient_code}: kmr_last mismatch")
        checker.check(is_close_or_none(last_status.get("kre_last"), kre_last, 1e-2), f"{patient_code}: kre_last mismatch")
        checker.check(is_close_or_none(last_status.get("gfr_last"), gfr_last, 1e-1), f"{patient_code}: gfr_last mismatch")

        # patient_features cross-check
        if feature:
            checker.check(feature.get("n_kmr_points") == meta.get("n_kmr_points"), f"{patient_code}: n_kmr_points mismatch")
            checker.check(feature.get("n_kre_points") == meta.get("n_kre_points"), f"{patient_code}: n_kre_points mismatch")
            checker.check(feature.get("n_gfr_points") == meta.get("n_gfr_points"), f"{patient_code}: n_gfr_points mismatch")
            checker.check(is_close_or_none(feature.get("last_kmr"), last_status.get("kmr_last"), 1e-4), f"{patient_code}: feature.last_kmr mismatch")
            checker.check(is_close_or_none(feature.get("last_kre"), last_status.get("kre_last"), 1e-2), f"{patient_code}: feature.last_kre mismatch")
            checker.check(is_close_or_none(feature.get("last_gfr"), last_status.get("gfr_last"), 1e-1), f"{patient_code}: feature.last_gfr mismatch")
            checker.check(feature.get("last_kmr_time_order") == last_status.get("last_kmr_order"), f"{patient_code}: feature.last_kmr_time_order mismatch")
            checker.check(feature.get("last_kre_time_order") == last_status.get("last_kre_order"), f"{patient_code}: feature.last_kre_time_order mismatch")
            checker.check(feature.get("last_gfr_time_order") == last_status.get("last_gfr_order"), f"{patient_code}: feature.last_gfr_time_order mismatch")

            checker.check(bool(feature.get("has_anomaly")) == has_any_anomaly, f"{patient_code}: feature.has_anomaly mismatch")
            checker.check(bool(feature.get("kmr_has_anomaly")) == kmr_anomaly, f"{patient_code}: feature.kmr_has_anomaly mismatch")
            checker.check(bool(feature.get("kre_has_anomaly")) == kre_anomaly, f"{patient_code}: feature.kre_has_anomaly mismatch")
            checker.check(bool(feature.get("gfr_has_anomaly")) == gfr_anomaly, f"{patient_code}: feature.gfr_has_anomaly mismatch")

            level = feature.get("risk_level")
            if level in computed_risk_distribution:
                computed_risk_distribution[level] += 1

    # Summary checks
    summary_totals = data_summary.get("totals", {})
    checker.check(summary_totals.get("n_patients") == len(patients_from_excel), "data_summary.totals.n_patients mismatch")
    checker.check(summary_totals.get("improved_proxy_count") == improved_count, "data_summary.totals.improved_proxy_count mismatch")
    checker.check(summary_totals.get("patients_with_anomalies") == anomaly_patients, "data_summary.totals.patients_with_anomalies mismatch")

    summary_risk_distribution = data_summary.get("risk_distribution", {})
    for level in RISK_LEVELS:
        checker.check(
            int(summary_risk_distribution.get(level, -1)) == computed_risk_distribution[level],
            f"data_summary.risk_distribution.{level} mismatch",
        )

    # Channel overview checks
    kmr_long = wide_to_long_kmr(excel_df)
    lab_long = wide_to_long_lab(excel_df)
    cov = channel_overview.get("coverage", {})
    checker.check(cov.get("kmr", {}).get("n_measurements") == len(kmr_long), "channel_overview kmr n_measurements mismatch")
    checker.check(cov.get("kre", {}).get("n_measurements") == int(lab_long["kre"].notna().sum()), "channel_overview kre n_measurements mismatch")
    checker.check(cov.get("gfr", {}).get("n_measurements") == int(lab_long["gfr"].notna().sum()), "channel_overview gfr n_measurements mismatch")

    # Reference band sanity checks
    bands = reference_band.get("bands", {})
    for key in ("kmr", "kre", "gfr"):
        band_list = bands.get(key, [])
        checker.check(isinstance(band_list, list), f"reference_band.bands.{key} is not a list")
        orders = [b.get("time_order") for b in band_list if isinstance(b, dict)]
        checker.check(orders == sorted(orders), f"reference_band.bands.{key} not sorted by time_order")

    # Cohort json basic schema checks
    for name, payload in (
        ("cohort_trajectory.json", cohort_trajectory),
        ("cohort_trajectory_lab.json", cohort_trajectory_lab),
    ):
        checker.check(isinstance(payload.get("metadata"), dict), f"{name}: metadata missing/invalid")
        checker.check(isinstance(payload.get("trajectory"), list), f"{name}: trajectory missing/invalid")
        checker.check(isinstance(payload.get("summary"), dict), f"{name}: summary missing/invalid")

    # Frontend checks
    if not args.skip_frontend:
        run_cmd(["npm", "run", "lint"], PROJECT_ROOT / "frontend", checker, "Frontend lint")
        run_cmd(["npm", "run", "build:next"], PROJECT_ROOT / "frontend", checker, "Frontend build")
    else:
        print("\n[STEP] Skipping frontend checks (--skip-frontend).")

    elapsed = time.time() - start
    print("\n" + "=" * 70)
    print("CHECK SUMMARY")
    print("=" * 70)
    print(f"Passed checks : {checker.passed_checks}")
    print(f"Warnings      : {len(checker.warnings)}")
    print(f"Errors        : {len(checker.errors)}")
    print(f"Duration      : {elapsed:.1f}s")

    if checker.warnings:
        print("\nWarnings:")
        for w in checker.warnings:
            print(f"- {w.message}")

    if checker.errors:
        print("\nErrors:")
        for e in checker.errors:
            print(f"- {e.message}")
        return 1

    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
