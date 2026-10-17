"""Oráculo de Dosel: mide el NDVI satelital de un predio y arma la evidencia que se publica en Hedera.

Este script solo MIDE (Sentinel-2 vía Planetary Computer) y escribe `oracle/evidence/<PREDIO>-<PERIODO>.json`.
Publicar esa evidencia en Hedera Consensus Service y firmar la verificación en el contrato GreenTon lo hace
`scripts/submit-verification.ts` (SDK de Hedera + ethers), porque es ahí donde vive la clave del oráculo.

Uso:
  python run.py measure <PREDIO> <periodo AAAAMM> <AAAA-MM-DD/AAAA-MM-DD>   # solo mide y guarda la evidencia
  python run.py verify  <PREDIO> <periodo AAAAMM> <AAAA-MM-DD/AAAA-MM-DD>   # mide y publica en Hedera (necesita .env)
"""
import json
import math
import os
import subprocess
import sys

from ndvi import mean_ndvi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
EVIDENCE_DIR = os.path.join(HERE, "evidence")

# Factor SIMPLIFICADO e ilustrativo (NO es una metodología certificada Verra/IPCC):
# toneladas CO2e/ha/año a vigor máximo, escaladas por el NDVI del predio.
TCO2E_PER_HA_YEAR = 5.5
NDVI_FLOOR, NDVI_CEIL = 0.4, 0.8


def hectares(bbox):
    lon0, lat0, lon1, lat1 = bbox
    mid = math.radians((lat0 + lat1) / 2)
    w = (lon1 - lon0) * 111.32 * math.cos(mid)
    h = (lat1 - lat0) * 110.57
    return round(w * h * 100)


def tco2e(ha, ndvi):
    f = min(max((ndvi - NDVI_FLOOR) / (NDVI_CEIL - NDVI_FLOOR), 0.0), 1.0)
    return int(round(ha * TCO2E_PER_HA_YEAR * f))


def load_parcels():
    return {p["id"]: p for p in json.load(open(os.path.join(HERE, "parcels.json")))}


def cmd_measure(pid, period, date_range):
    p = load_parcels()[pid]
    ha = hectares(p["bbox"])
    s = mean_ndvi(p["bbox"], date_range)
    ev = {"parcel": pid, "period": int(period), "ndvi": round(s["ndvi"], 3), "scene": s["scene"],
          "scene_date": s["date"], "cloud": s["cloud"], "hectares": ha,
          "tco2e_proposed": tco2e(ha, s["ndvi"]), "bbox": p["bbox"], "range": date_range}
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    path = os.path.join(EVIDENCE_DIR, f"{pid}-{period}.json")
    json.dump(ev, open(path, "w"), indent=2, ensure_ascii=False)
    print(f"{pid} periodo={period} ndvi={ev['ndvi']:.3f} escena={ev['scene']} -> {path}")
    return path


def cmd_verify(pid, period, date_range):
    path = cmd_measure(pid, period, date_range)
    subprocess.run(["npx", "hardhat", "run", "scripts/submit-verification.ts", "--network", "hedera_testnet"],
                   cwd=ROOT, check=True, env={**os.environ, "EVIDENCE_FILE": path})


if __name__ == "__main__":
    if len(sys.argv) != 5 or sys.argv[1] not in ("measure", "verify"):
        raise SystemExit(__doc__)
    {"measure": cmd_measure, "verify": cmd_verify}[sys.argv[1]](sys.argv[2], sys.argv[3], sys.argv[4])
