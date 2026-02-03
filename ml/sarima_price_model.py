"""
SARIMA Rubber Price Forecasting Model for Kerala, India
========================================================
This module implements a SARIMA model for rubber price prediction
using historical market data from Kottayam and other Kerala markets.

Model: SARIMA(p, d, q)(P, D, Q, s)
- s: Seasonal period (12 for monthly data)

Author: RubberEco ML Team
"""

import os
import json
import warnings
from datetime import datetime
from pathlib import Path

import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller
from sklearn.metrics import mean_squared_error, mean_absolute_error
import joblib

# Suppress convergence warnings during model fitting
warnings.filterwarnings('ignore')

# Project paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data'
MODEL_DIR = BASE_DIR / 'ml' / 'trained_models'
OUTPUT_DIR = BASE_DIR / 'ml' / 'forecasts'

# Ensure directories exist
MODEL_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# Rubber grades
RUBBER_GRADES = ['RSS-4', 'RSS-3', 'RSS-5', 'ISNR-20', 'Latex']

# Kerala rubber markets
KERALA_MARKETS = [
    'Kottayam', 'Changanacherry', 'Manimala', 'Thrissur',
    'Kozhikode', 'Palakkad', 'Ernakulam'
]


class RubberPriceSARIMA:
    """
    SARIMA model for Kerala rubber price forecasting.
    
    This model captures:
    - Seasonal price patterns (monsoon effects on tapping)
    - Market cycles and trends
    - Global rubber price influences
    """
    
    def __init__(self, market: str = "Kottayam", grade: str = "RSS-4"):
        self.market = market
        self.grade = grade
        self.model = None
        self.fitted_model = None
        self.order = None
        self.seasonal_order = None
        self.training_data = None
        self.model_metadata = {}
        
    def load_historical_data(self, csv_path: str = None) -> pd.DataFrame:
        """
        Load historical price data from kerala_rubber_prices.csv
        """
        if csv_path is None:
            csv_path = DATA_DIR / 'kerala_rubber_prices.csv'
        
        print(f"📁 Loading price data from: {csv_path}")
        
        df = pd.read_csv(csv_path)
        
        # Filter by grade if specified
        if self.grade and 'GRADE' in df.columns:
            df = df[df['GRADE'] == self.grade]
        
        print(f"✅ Loaded {len(df)} months of data ({df['YEAR'].min()}-{df['YEAR'].max()})")
        return df
    
    def prepare_price_data(self, df: pd.DataFrame) -> pd.Series:
        """
        Prepare monthly price data for SARIMA modeling.
        """
        # Create a proper date column
        df['DATE'] = pd.to_datetime(df['DATE'])
        df = df.sort_values('DATE')
        
        # Set date as index
        price_data = df[['DATE', 'PRICE_PER_KG', 'YEAR', 'MONTH']].copy()
        price_data.set_index('DATE', inplace=True)
        
        # Remove any NaN values
        price_data = price_data.dropna()
        
        self.training_data = price_data
        
        print(f"📊 Price data prepared:")
        print(f"   - Period: {price_data.index.min().strftime('%Y-%m')} to {price_data.index.max().strftime('%Y-%m')}")
        print(f"   - Mean price: ₹{price_data['PRICE_PER_KG'].mean():.2f}/kg")
        print(f"   - Std deviation: ₹{price_data['PRICE_PER_KG'].std():.2f}")
        print(f"   - Min: ₹{price_data['PRICE_PER_KG'].min():.2f}, Max: ₹{price_data['PRICE_PER_KG'].max():.2f}")
        
        return price_data['PRICE_PER_KG']
    
    def test_stationarity(self, series: pd.Series) -> dict:
        """
        Perform Augmented Dickey-Fuller test for stationarity.
        """
        result = adfuller(series.dropna())
        
        stationarity_result = {
            'adf_statistic': result[0],
            'p_value': result[1],
            'critical_values': result[4],
            'is_stationary': result[1] < 0.05
        }
        
        print(f"\n📈 Stationarity Test (ADF):")
        print(f"   - ADF Statistic: {result[0]:.4f}")
        print(f"   - p-value: {result[1]:.4f}")
        print(f"   - Stationary: {'Yes ✓' if result[1] < 0.05 else 'No ✗ (differencing needed)'}")
        
        return stationarity_result
    
    def find_optimal_parameters(self, series: pd.Series) -> tuple:
        """
        Find optimal SARIMA parameters using grid search with AIC criterion.
        
        For monthly price data, we use:
        - Seasonal period s=12 (monthly seasonality)
        """
        print("\n🔍 Finding optimal SARIMA parameters...")
        
        best_aic = float('inf')
        best_order = (1, 1, 1)
        best_seasonal = (1, 1, 1, 12)
        
        tested = 0
        
        # Grid search for parameters
        for p in range(0, 3):
            for d in range(0, 2):
                for q in range(0, 3):
                    for P in range(0, 2):
                        for D in range(0, 2):
                            for Q in range(0, 2):
                                try:
                                    model = SARIMAX(
                                        series,
                                        order=(p, d, q),
                                        seasonal_order=(P, D, Q, 12),
                                        enforce_stationarity=False,
                                        enforce_invertibility=False
                                    )
                                    results = model.fit(disp=False, maxiter=200)
                                    
                                    if results.aic < best_aic:
                                        best_aic = results.aic
                                        best_order = (p, d, q)
                                        best_seasonal = (P, D, Q, 12)
                                        
                                    tested += 1
                                    
                                except Exception:
                                    continue
        
        print(f"   - Tested {tested} parameter combinations")
        print(f"   - Best order: SARIMA{best_order}x{best_seasonal[:3]}")
        print(f"   - Best AIC: {best_aic:.2f}")
        
        self.order = best_order
        self.seasonal_order = best_seasonal
        
        return best_order, best_seasonal
    
    def train(self, series: pd.Series, order: tuple = None, seasonal_order: tuple = None) -> dict:
        """
        Train the SARIMA model on historical price data.
        """
        print("\n🚂 Training SARIMA price model...")
        
        if order is None:
            if self.order is None:
                self.find_optimal_parameters(series)
            order = self.order
        
        if seasonal_order is None:
            seasonal_order = self.seasonal_order or (1, 1, 1, 12)
        
        # Fit the model
        self.model = SARIMAX(
            series,
            order=order,
            seasonal_order=seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False
        )
        
        self.fitted_model = self.model.fit(disp=False, maxiter=500)
        
        # Calculate training metrics
        predictions = self.fitted_model.fittedvalues
        
        # Handle alignment issues
        common_idx = series.index.intersection(predictions.index)
        actual = series.loc[common_idx]
        pred = predictions.loc[common_idx]
        
        mse = mean_squared_error(actual, pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(actual, pred)
        mape = np.mean(np.abs((actual - pred) / actual)) * 100
        
        # Store metadata
        self.model_metadata = {
            'market': self.market,
            'grade': self.grade,
            'model_type': 'SARIMA',
            'order': order,
            'seasonal_order': seasonal_order,
            'aic': self.fitted_model.aic,
            'bic': self.fitted_model.bic,
            'training_period': f"{series.index.min().strftime('%Y-%m')} to {series.index.max().strftime('%Y-%m')}",
            'n_observations': len(series),
            'metrics': {
                'mse': mse,
                'rmse': rmse,
                'mae': mae,
                'mape': mape
            },
            'trained_at': datetime.now().isoformat()
        }
        
        print(f"\n✅ Model trained successfully!")
        print(f"   - Order: SARIMA{order}x{seasonal_order[:3]}")
        print(f"   - AIC: {self.fitted_model.aic:.2f}")
        print(f"\n📊 Training Metrics:")
        print(f"   - RMSE: ₹{rmse:.2f}")
        print(f"   - MAE: ₹{mae:.2f}")
        print(f"   - MAPE: {mape:.2f}%")
        
        return self.model_metadata
    
    def forecast(self, steps: int = 12, confidence_level: float = 0.95) -> pd.DataFrame:
        """
        Generate price forecasts for future months.
        
        Parameters:
        -----------
        steps : int
            Number of months to forecast
        confidence_level : float
            Confidence level for prediction intervals
        
        Returns:
        --------
        pd.DataFrame : Forecasts with confidence intervals
        """
        if self.fitted_model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        print(f"\n🔮 Generating {steps}-month price forecast...")
        
        # Get forecast
        forecast_result = self.fitted_model.get_forecast(steps=steps)
        forecast_mean = forecast_result.predicted_mean
        confidence_int = forecast_result.conf_int(alpha=1 - confidence_level)
        
        # Create forecast dataframe
        last_date = self.training_data.index.max()
        forecast_dates = pd.date_range(
            start=last_date + pd.DateOffset(months=1),
            periods=steps,
            freq='MS'
        )
        
        forecast_df = pd.DataFrame({
            'date': forecast_dates,
            'year': [d.year for d in forecast_dates],
            'month': [d.month for d in forecast_dates],
            'market': self.market,
            'grade': self.grade,
            'predicted_price': forecast_mean.values,
            'lower_ci': confidence_int.iloc[:, 0].values,
            'upper_ci': confidence_int.iloc[:, 1].values,
            'model': f'SARIMA{self.order}x{self.seasonal_order[:3]}',
            'is_forecast': True
        })
        
        # Calculate price trend
        historical_avg = self.training_data['PRICE_PER_KG'].mean()
        recent_avg = self.training_data['PRICE_PER_KG'].tail(6).mean()
        
        def classify_trend(price, prev_price=None):
            if prev_price is None:
                prev_price = recent_avg
            change_pct = ((price - prev_price) / prev_price) * 100
            if change_pct > 2:
                return 'Rising'
            elif change_pct < -2:
                return 'Falling'
            return 'Stable'
        
        # Classify trends
        trends = []
        prev_price = recent_avg
        for price in forecast_df['predicted_price']:
            trend = classify_trend(price, prev_price)
            trends.append(trend)
            prev_price = price
        
        forecast_df['trend'] = trends
        
        # Calculate percent change from recent average
        forecast_df['percent_change'] = ((forecast_df['predicted_price'] - recent_avg) / recent_avg * 100).round(2)
        
        print(f"\n📅 Price Forecast Results:")
        print(f"   Recent Average: ₹{recent_avg:.2f}/kg")
        print("-" * 70)
        
        for _, row in forecast_df.iterrows():
            trend_emoji = {'Rising': '📈', 'Stable': '➡️', 'Falling': '📉'}[row['trend']]
            print(f"   {row['date'].strftime('%Y-%m')}: ₹{row['predicted_price']:.2f}/kg "
                  f"[₹{row['lower_ci']:.2f} - ₹{row['upper_ci']:.2f}] "
                  f"{trend_emoji} {row['trend']} ({row['percent_change']:+.1f}%)")
        
        return forecast_df
    
    def save_model(self, filename: str = 'kerala_price_sarima_model.joblib'):
        """Save the trained model to disk."""
        if self.fitted_model is None:
            raise ValueError("No trained model to save.")
        
        model_path = MODEL_DIR / filename
        
        model_data = {
            'fitted_model': self.fitted_model,
            'order': self.order,
            'seasonal_order': self.seasonal_order,
            'metadata': self.model_metadata,
            'training_data': self.training_data
        }
        
        joblib.dump(model_data, model_path)
        print(f"\n💾 Model saved to: {model_path}")
        
        # Also save metadata as JSON
        metadata_path = MODEL_DIR / 'price_model_metadata.json'
        with open(metadata_path, 'w') as f:
            metadata_json = self.model_metadata.copy()
            metadata_json['order'] = list(metadata_json['order'])
            metadata_json['seasonal_order'] = list(metadata_json['seasonal_order'])
            json.dump(metadata_json, f, indent=2)
        
        print(f"📄 Metadata saved to: {metadata_path}")
        
        return model_path
    
    def load_model(self, filename: str = 'kerala_price_sarima_model.joblib'):
        """Load a trained model from disk."""
        model_path = MODEL_DIR / filename
        
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        model_data = joblib.load(model_path)
        
        self.fitted_model = model_data['fitted_model']
        self.order = model_data['order']
        self.seasonal_order = model_data['seasonal_order']
        self.model_metadata = model_data['metadata']
        self.training_data = model_data['training_data']
        
        print(f"✅ Model loaded from: {model_path}")
        return self
    
    def export_forecasts_for_mongodb(self, forecast_df: pd.DataFrame, 
                                      filename: str = 'price_forecasts.json'):
        """
        Export forecasts in a format ready for MongoDB import.
        """
        output_path = OUTPUT_DIR / filename
        
        # Include historical data + forecasts
        historical_records = []
        for idx, row in self.training_data.iterrows():
            historical_records.append({
                'date': idx.isoformat(),
                'year': int(row['YEAR']),
                'month': int(row['MONTH']),
                'market': self.market,
                'grade': self.grade,
                'predictedPrice': round(row['PRICE_PER_KG'], 2),
                'model': f'SARIMA{self.order}x{self.seasonal_order[:3]}',
                'isForecast': False
            })
        
        # Add forecasts
        forecast_records = []
        for _, row in forecast_df.iterrows():
            forecast_records.append({
                'date': row['date'].isoformat(),
                'year': int(row['year']),
                'month': int(row['month']),
                'market': self.market,
                'grade': self.grade,
                'predictedPrice': round(row['predicted_price'], 2),
                'lowerCI': round(row['lower_ci'], 2),
                'upperCI': round(row['upper_ci'], 2),
                'trend': row['trend'],
                'percentChange': row['percent_change'],
                'model': f'SARIMA{self.order}x{self.seasonal_order[:3]}',
                'isForecast': True
            })
        
        all_records = historical_records + forecast_records
        
        with open(output_path, 'w') as f:
            json.dump(all_records, f, indent=2)
        
        print(f"\n📤 Exported {len(all_records)} records to: {output_path}")
        print(f"   - Historical: {len(historical_records)}")
        print(f"   - Forecasts: {len(forecast_records)}")
        
        return output_path


def main():
    """
    Main training pipeline for Kerala rubber price SARIMA model.
    """
    print("=" * 70)
    print("💰 KERALA RUBBER PRICE SARIMA MODEL TRAINING")
    print("=" * 70)
    print(f"   Market: Kottayam")
    print(f"   Grade: RSS-4")
    print(f"   Training Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # Initialize model
    model = RubberPriceSARIMA(market="Kottayam", grade="RSS-4")
    
    # Load and prepare data
    df = model.load_historical_data()
    series = model.prepare_price_data(df)
    
    # Test stationarity
    model.test_stationarity(series)
    
    # Use predetermined good parameters to avoid long search
    # These are typical values for price time series
    order = (1, 1, 1)
    seasonal_order = (1, 1, 1, 12)
    
    # Train model
    model.train(series, order=order, seasonal_order=seasonal_order)
    
    # Generate forecasts (next 24 months)
    forecast_df = model.forecast(steps=24)
    
    # Save model and exports
    model.save_model()
    model.export_forecasts_for_mongodb(forecast_df)
    
    print("\n" + "=" * 70)
    print("✅ TRAINING COMPLETE!")
    print("=" * 70)
    print(f"\nFiles generated:")
    print(f"   📦 Model: backend/ml/trained_models/kerala_price_sarima_model.joblib")
    print(f"   📄 Metadata: backend/ml/trained_models/price_model_metadata.json")
    print(f"   📊 Forecasts: backend/ml/forecasts/price_forecasts.json")
    print("\nNext steps:")
    print("   1. Run: node scripts/importPriceForecasts.js")
    print("   2. Forecasts will be loaded into MongoDB")
    print("=" * 70)
    
    return model, forecast_df


if __name__ == '__main__':
    main()

