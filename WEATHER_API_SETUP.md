# Weather API Setup Guide

## Overview
RubberEco now integrates **OpenWeatherMap API** to provide live weather data for Kerala districts, showing real-time conditions like "Sunny", "Rainy", "Cloudy" with temperature, humidity, and 5-day forecasts.

## Setting Up OpenWeatherMap API

### Step 1: Get Your API Key

1. Go to [OpenWeatherMap](https://openweathermap.org/)
2. Click **Sign Up** (top right) and create a free account
3. After signing up, go to **API Keys** section in your account dashboard
4. Copy your API key (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### Step 2: Add API Key to Your `.env` File

Open your `backend/.env` file and add this line:

```env
OPENWEATHER_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with the actual API key you copied.

**Example:**
```env
OPENWEATHER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 3: Restart Your Backend Server

After adding the API key, restart your backend server:

```bash
cd backend
npm run dev
```

## API Endpoints

### 1. Get Current Weather
```
GET /api/weather/current?district=Kottayam
```

**Response:**
```json
{
  "district": "Kottayam",
  "timestamp": "2026-02-08T10:30:00.000Z",
  "current": {
    "temperature": 28,
    "feelsLike": 30,
    "humidity": 75,
    "weather": "Partly Cloudy",
    "weatherIcon": "02d",
    "windSpeed": 3.5,
    "rainProbability": 20
  }
}
```

### 2. Get 5-Day Weather Forecast
```
GET /api/weather/forecast?district=Kottayam&days=5
```

**Response:**
```json
{
  "district": "Kottayam",
  "forecast": [
    {
      "date": "2026-02-08",
      "dayOfWeek": "Saturday",
      "temperature": {
        "max": 32,
        "min": 24,
        "avg": 28
      },
      "weather": "Partly Cloudy",
      "weatherIcon": "02d",
      "rainProbability": 20,
      "rainfall": 0
    }
    // ... 4 more days
  ]
}
```

### 3. Get Available Districts
```
GET /api/weather/districts
```

Returns list of all 14 Kerala districts with coordinates.

## Free Tier Limits

OpenWeatherMap's **free tier** includes:
- ✅ 1,000 API calls per day
- ✅ Current weather data
- ✅ 5-day / 3-hour forecast
- ✅ Weather icons and descriptions

This is more than enough for your project!

## Supported Kerala Districts

All 14 Kerala districts are supported:
- Thiruvananthapuram
- Kollam
- Pathanamthitta
- Alappuzha
- Kottayam
- Idukki
- Ernakulam
- Thrissur
- Palakkad
- Malappuram
- Kozhikode
- Wayanad
- Kannur
- Kasaragod

## Weather Descriptions

The API provides user-friendly weather descriptions:
- **Sunny** - Clear skies
- **Partly Cloudy** - Some clouds
- **Cloudy** - Overcast
- **Rainy** - Rain showers
- **Light Rain** - Drizzle
- **Thunderstorm** - Thunder and lightning
- **Misty/Foggy** - Poor visibility

## Troubleshooting

### "Weather API not configured" error
- Make sure you've added `OPENWEATHER_API_KEY` to your `.env` file
- Restart your backend server after adding the key

### "Invalid API key" error
- Double-check your API key is copied correctly
- Wait a few minutes - new API keys take 10-15 minutes to activate

### Weather data not updating
- Weather data is cached for 10 minutes to avoid excessive API calls
- This is normal and helps stay within the free tier limits

## Why This is Better Than Rainfall Prediction

**Before:** Building a custom rainfall prediction model
- ❌ Less accurate than professional weather services
- ❌ Requires extensive historical data
- ❌ Model training complexity
- ❌ Not real-time

**After:** Integrating OpenWeatherMap API
- ✅ Real-time, accurate data from professional meteorologists
- ✅ Shows actual current conditions
- ✅ 5-day forecast with hourly details
- ✅ User-friendly format (Sunny, Rainy, etc.)
- ✅ Just like weather apps on phones!

---

**Need Help?** Check the [OpenWeatherMap API Documentation](https://openweathermap.org/api)


