"""
Launch the SARIMA direction evaluation script from the backend folder.

Usage (from D:\\RubberEco\\backend):
  python run_price_model_eval.py
  python run_price_model_eval.py --max-windows 25
  python run_price_model_eval.py --csv ..\\ml\\sample_prices.csv --price-col price
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "ml" / "evaluate_sarima_direction_metrics.py"

if not SCRIPT.is_file():
    print(f"Expected script at: {SCRIPT}", file=sys.stderr)
    sys.exit(1)

sys.exit(subprocess.call([sys.executable, str(SCRIPT)] + sys.argv[1:]))
