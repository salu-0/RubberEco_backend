"""
Seminar chart: actual vs rolling one-step-ahead SARIMA predictions,
with actual-price segments color-coded by market trend (Rising / Falling / Stable).

Run from repo root or backend:
    python ml/plot_sarima_seminar.py

Output: backend/ml/trained_models/sarima_seminar_actual_vs_predicted.png
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.collections import LineCollection
from matplotlib.lines import Line2D

# Allow `python ml/plot_sarima_seminar.py` from backend/
ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from sarima_price_model import MODEL_DIR, RubberPriceSARIMA  # noqa: E402

TREND_COLORS = {
    "Rising": "#16a34a",
    "Falling": "#dc2626",
    "Stable": "#64748b",
}


def build_colored_segments(dates, values, trends):
    """Line segments between consecutive points; segment i uses trends[i+1]."""
    x = mdates.date2num(pd.to_datetime(dates))
    pts = np.column_stack([x, values])
    if len(pts) < 2:
        return [], []
    segs = np.stack([pts[:-1], pts[1:]], axis=1)
    # Color by regime entered at the end of each segment
    colors = [TREND_COLORS[trends[i + 1]] for i in range(len(segs))]
    return segs, colors


def main():
    order = (1, 1, 1)
    seasonal_order = (1, 1, 1, 12)
    min_train = 36

    model = RubberPriceSARIMA(market="Kottayam", grade="RSS-4")
    df = model.load_historical_data()
    series = model.prepare_price_data(df)
    y = series.sort_index().astype(float).dropna()

    bt = model.evaluate_out_of_sample_rolling(
        series,
        order=order,
        seasonal_order=seasonal_order,
        min_train_months=min_train,
        include_plot_data=True,
        verbose=False,
    )

    if "error" in bt:
        print(bt["error"])
        sys.exit(1)

    plot_dates = bt["plot_dates"]
    actual = np.array(bt["plot_actual"], dtype=float)
    predicted = np.array(bt["plot_predicted"], dtype=float)
    trends = bt["plot_trends"]

    # Full history (context before backtest window)
    first_bt = pd.to_datetime(plot_dates[0])
    warm_mask = y.index < first_bt
    warm_dates = y.index[warm_mask]
    warm_y = y.values[warm_mask]

    fig, ax = plt.subplots(figsize=(12, 6.2), dpi=120)
    fig.patch.set_facecolor("#fafafa")
    ax.set_facecolor("#fafafa")

    if len(warm_dates) > 0:
        ax.plot(
            warm_dates,
            warm_y,
            color="#cbd5e1",
            linewidth=2,
            solid_capstyle="round",
            label="Actual (warm-up, not scored)",
            zorder=1,
        )

    segs, colors = build_colored_segments(plot_dates, actual, trends)
    if len(segs) > 0:
        lc = LineCollection(
            segs,
            colors=colors,
            linewidths=3,
            capstyle="round",
            joinstyle="round",
            zorder=3,
        )
        ax.add_collection(lc)

    ax.plot(
        plot_dates,
        predicted,
        color="#1e3a8a",
        linewidth=2,
        linestyle="--",
        alpha=0.9,
        label="Predicted (1-step ahead, out-of-sample)",
        zorder=2,
        dash_capstyle="round",
    )

    legend_lines = [
        Line2D([0], [0], color=TREND_COLORS["Rising"], lw=3, label="Actual trend: Rising (> +2% MoM)"),
        Line2D([0], [0], color=TREND_COLORS["Falling"], lw=3, label="Actual trend: Falling (< −2% MoM)"),
        Line2D([0], [0], color=TREND_COLORS["Stable"], lw=3, label="Actual trend: Stable (within ±2%)"),
        Line2D(
            [0],
            [0],
            color="#1e3a8a",
            lw=2,
            linestyle="--",
            label="Predicted (SARIMA 1-step)",
        ),
    ]
    if len(warm_dates) > 0:
        legend_lines.insert(
            0,
            Line2D([0], [0], color="#cbd5e1", lw=2, label="Actual (warm-up)"),
        )

    ax.legend(handles=legend_lines, loc="upper left", framealpha=0.95, fontsize=9)

    ax.set_title(
        "Kerala rubber price — actual vs SARIMA one-step forecast (Kottayam, RSS-4)\n"
        "Trend colors = month-over-month change in actual market price",
        fontsize=12,
        fontweight="bold",
        pad=12,
    )
    ax.set_xlabel("Month", fontsize=10)
    ax.set_ylabel("Price (₹/kg)", fontsize=10)

    stats = (
        f"Out-of-sample (n={bt['n_test']} months)\n"
        f"MAPE: {bt['mape']:.2f}%   |   MAE: ₹{bt['mae']:.2f}/kg   |   RMSE: ₹{bt['rmse']:.2f}/kg\n"
        f"SARIMA{order} × seasonal{seasonal_order}   |   min. history: {min_train} months"
    )
    ax.text(
        0.02,
        0.02,
        stats,
        transform=ax.transAxes,
        fontsize=9,
        verticalalignment="bottom",
        bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor="#e2e8f0", alpha=0.95),
    )

    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=6))
    fig.autofmt_xdate(rotation=35)
    ax.grid(True, alpha=0.35, linestyle="-", linewidth=0.5)
    ax.set_xlim(y.index.min(), pd.to_datetime(plot_dates[-1]) + pd.Timedelta(days=20))
    ymin = min(float(y.min()), float(actual.min()), float(predicted.min()))
    ymax = max(float(y.max()), float(actual.max()), float(predicted.max()))
    pad = (ymax - ymin) * 0.08
    ax.set_ylim(ymin - pad, ymax + pad)

    out = MODEL_DIR / "sarima_seminar_actual_vs_predicted.png"
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(out, dpi=160, bbox_inches="tight", facecolor=fig.patch.get_facecolor())
    plt.close(fig)
    print(f"Saved seminar figure: {out}")


if __name__ == "__main__":
    main()
