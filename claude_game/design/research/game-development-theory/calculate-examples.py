"""Research calculations, not a game simulation or production test.

Inputs are an explicit 2026-10-05 snapshot of dropTable.js and leveling.js.
Run from any directory; writes calculations.json beside this script.
"""
import json
import math
from pathlib import Path

weights = {"normal": 58, "magic": 25, "rare": 12, "epic": 3, "set": 1.5, "unique": 0.5}
p = weights["unique"] / sum(weights.values())

def quantile(q):
    n = math.ceil(math.log1p(-q) / math.log1p(-p))
    assert 1 - (1-p)**n >= q
    assert 1 - (1-p)**(n-1) < q
    return n

target_level = 10
xp = sum(50 * level for level in range(1, target_level))
assert xp == 25 * target_level * (target_level - 1)
result = {
    "snapshot_date": "2026-10-05",
    "kind": "analytical examples, not gameplay measurements",
    "assumptions": [
        "Independent base grade rolls with constant probability; no pity or guaranteed rewards",
        "Level 1 with zero EXP; only 3 EXP per idle kill for the EXP example",
        "No conversion from roll or kill counts into elapsed play time",
    ],
    "grade_weights": weights,
    "unique_probability": p,
    "expected_rolls_to_first_unique": 1 / p,
    "rolls_for_50_percent": quantile(0.5),
    "rolls_for_90_percent": quantile(0.9),
    "rolls_for_95_percent": quantile(0.95),
    "probability_no_unique_after_200_rolls": (1-p)**200,
    "target_level": target_level,
    "exp_from_level_1_to_target": xp,
    "idle_kills_at_3_exp_only": math.ceil(xp / 3),
}
out = Path(__file__).with_name("calculations.json")
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
