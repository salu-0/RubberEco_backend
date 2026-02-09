# RubberEco Prediction Models Documentation

## Overview
This document explains the Machine Learning models used in the RubberEco project for predicting rubber prices and rainfall patterns. It is designed to provide technical context for interviews and project defense.

## 1. Core Model: SARIMA
**SARIMA** stands for **Seasonal AutoRegressive Integrated Moving Average**.
It is a statistical model specifically designed for time-series data that exhibits:
1.  **Trends** (e.g., general price increase/decrease over years).
2.  **Seasonality** (e.g., repeating patterns every year due to monsoons or harvest cycles).

### 2. Why SARIMA was Chosen?
We selected SARIMA over other models (like Linear Regression or simple LSTM) for three specific reasons:

1.  **Seasonality Handling**:
    *   **Rubber Prices**: Heavily depend on tapping seasons, which are interrupted by monsoons.
    *   **Rainfall**: Follows a strict annual monsoon cycle (June-September).
    *   SARIMA explicitly captures these repeating cycles using its seasonal order parameter (`s=12` for monthly data), making it far more accurate for this domain than standard regression.

2.  **Stationarity Adaptation**:
    *   Economic and climate data are often "non-stationary" (means and variances change over time).
    *   SARIMA uses "Differencing" (the `d` and `D` parameters) to transform non-stationary data into stationary data automatically, allowing valid statistical predictions.

3.  **Interpretability**:
    *   Unlike "black box" Deep Learning models, SARIMA's parameters are statistically interpretable. We can explain exactly *why* a prediction was made based on past lags and moving averages, which is crucial for agricultural trust.

---

## 3. The Models

### A. Price Prediction Model (`sarima_price_model.py`)
*   **Target**: Future Monthly Rubber Prices (₹/kg).
*   **Configuration**: `SARIMA(p, d, q)(P, D, Q, 12)`
*   **Data Source**: Monthly historical prices from Kottayam market.
*   **Key Feature**: Captures the annual price dip during peak production and price spikes during monsoon shortages.

### B. Rainfall Prediction Model (`sarima_rainfall_model.py`)
*   **Target**: Total Monsoon Rainfall (mm) for the JJAS period (June-Sept).
*   **Configuration**: `SARIMA` (Optimized for annual trends).
*   **Data Source**: 100+ years of historical rainfall data (`Kerala-Rainfall-Historical.csv`).
*   **Key Feature**: Classifies predicted rainfall into varying risk levels (Low, Normal, High) to alert farmers.

---

## 4. How the Models are Trained (The Pipeline)

The training process follows a rigorous standard pipeline implemented in the Python scripts:

### Step 1: Data Ingestion & Cleaning
*   **Price**: Loads `kerala_rubber_prices.csv`, converts dates to specific indices, and handles missing values.
*   **Rainfall**: Extracts the JJAS (June-Sept) columns to focus only on the critical monsoon season impacting rubber tapping.

### Step 2: Stationarity Testing (ADF Test)
*   The system runs the **Augmented Dickey-Fuller (ADF)** test.
*   It checks if the data's statistical properties are constant.
*   *Outcome*: If $p > 0.05$, the data is non-stationary, prompting the model to apply differencing.

### Step 3: Hyperparameter Tuning (Grid Search)
*   The model defines a grid of potential parameters:
    *   Trend (`p, d, q`)
    *   Seasonality (`P, D, Q`)
*   It iterates through combinations and selects the one with the lowest **AIC (Akaike Information Criterion)**.
*   *Why AIC?* It penalizes complex models to prevent overfitting, ensuring the model generalizes well to future years.

### Step 4: Model Fitting & Evaluation
*   The model is trained using the optimal parameters found in Step 3.
*   **Metrics Used**:
    *   **RMSE (Root Mean Square Error)**: Measures the average "distance" between predicted and actual values (e.g., error in Rupees).
    *   **MAPE (Mean Absolute Percentage Error)**: Shows accuracy as a percentage (e.g., "95% accurate").

### Step 5: Forecasting & Export
*   The model generates forecasts for the next 12-24 months/years.
*   **Confidence Intervals**: It calculates Upper and Lower bounds (95% confidence) to show best/worst-case scenarios.
*   **Export**: Results are saved as JSON files to be imported into the MongoDB database for the web frontend.

---

## 5. Technical Stack
*   **Language**: Python 3.x
*   **Library**: `statsmodels` (for SARIMA implementation)
*   **Data Handling**: `pandas`, `numpy`
*   **Evaluation**: `scikit-learn` (for error metrics)
*   **Persistence**: `joblib` (for saving trained models for reuse)

---

# II. Frontend Technical Concepts (React.js)

Since the project also has a React frontend (`RubberEco/src`), here are the key concepts used in files like `Markets.jsx`.

## 1. What is a Hook?
A **Hook** is a special function in React (starting with `use`) that lets you "hook into" React features like state and lifecycle methods without writing a class component.
*   **Why use it?**: It makes code cleaner, reusable, and easier to test.
*   **Common Hooks used**: `useState` (for data), `useEffect` (for side effects like API calls).

## 2. What is `useState`?
`useState` is a hook that lets a component "remember" things. It declares a state variable that preserves values between renders.

**Example from your code (`Markets.jsx`):**
```javascript
// Syntax: const [variable, setFunction] = useState(initialValue);
const [location, setLocation] = useState('');
const [loading, setLoading] = useState(false);
```
*   `location`: The variable holding the current value.
*   `setLocation`: The function to update that value (which triggers a re-render of the page).
*   **Usage**: When a user types in the search bar, `setLocation` updates the text instantly.

## 3. What are Props?
**Props** (short for Properties) are how you pass data **down** from a parent component to a child component. They are read-only (immutable) by the child.

**Example from your code (`Markets.jsx`):**
```javascript
// Child Component receiving 'onMarketClick' as a prop
const MarketFinder = ({ onMarketClick }) => { ... }
```
*   Here, `MarketFinder` receives a function `onMarketClick` from its parent.
*   When a user clicks a market card, `MarketFinder` calls this prop to tell the parent "Hey, this market was clicked!".

## 4. `useEffect` (Another Key Hook)
You use this for "side effects" - things that happen *after* the component renders, like fetching data or loading external scripts.

**Example (`Markets.jsx`):**
```javascript
useEffect(() => {
    // This code runs only once when the component mounts (loads)
    const loadGoogleMaps = () => { ... };
    loadGoogleMaps();
}, []); // Empty array [] means "run only once"
```
*   **Real-world analogy**: "When the dashboard first opens (mounts), go fetch the Google Maps script immediately."

---

# III. Code Deep Dive: Rainfall Model Logic

Here is a technical breakdown of exactly what happens inside `sarima_rainfall_model.py`.

## 1. The Class Structure (`KeralaRainfallSARIMA`)
The code is organized into a class to keep the data and model together.
*   **`__init__`**: Sets up the target region (Kerala) and lists the districts that will be included in the metadata.

## 2. Data Preparation (`prepare_monsoon_data`)
The model doesn't just use raw data; it specifically extracts the **JJAS (June, July, August, September)** period.
*   **Why?**: These 4 months constitute the Southwest Monsoon, which is the most critical rainfall period for rubber plantations.
*   **Action**: It sums up the rainfall for these months to create a single "Annual Monsoon Total" for each year.
*   **Indexing**: It converts the "Year" column into a proper Datetime index, which is required for any time-series analysis in Python.

## 3. Stationarity Test (`test_stationarity`)
Before training, the code checks if the rainfall pattern is "Stationary" (i.e., does the average rainfall stay roughly the same over 100 years, or is it drastically changing?).
*   **Tool**: Uses the **Augmented Dickey-Fuller (ADF)** test.
*   **Code**: `adfuller(series.dropna())`
*   **Logic**: If the "p-value" is less than 0.05, the data is stable. If not, the model knows it needs to use "differencing" (calculating the change from year to year rather than absolute values) to make accurate predictions.

## 4. The "Brain": Finding Best Parameters (`find_optimal_parameters`)
This is the most computationally intensive part. The model doesn't know the best settings beforehand, so it tries them all.
*   **Grid Search**: It uses nested loops to test different combinations of `(p, d, q)`:
    *   `p` (AutoRegressive): Does last year's rain affect this year's?
    *   `d` (Integrated): Do we need to subtract trends?
    *   `q` (Moving Average): Do random shocks (like El Niño) smooth out over time?
*   **Selection**: For every combination, it fits a model and calculates the **AIC score** (Line 190). It tracks the "Best AIC" (lowest score) effectively choosing the most accurate yet simplest model.

## 5. Training (`train` method)
Once the best parameters are found, this method builds the final model.
*   **Library**: It uses `statsmodels.tsa.statespace.sarimax.SARIMAX`.
*   **Configuration**:
    ```python
    model = SARIMAX(series, order=order, seasonal_order=..., enforce_stationarity=False)
    ```
    *   `enforce_stationarity=False`: This is a "power user" setting. It tells the library, "Don't crash if the data looks unstable; try to fit the model anyway." This makes the pipeline robust for real-world automated training.
*   **Evaluation**: Immediately after training, it "predicts" the past to see how well it learned (Line 247). It calculates the **RMSE** (Root Mean Square Error) to tell you, on average, how many millimeters off the prediction is.

## 6. Forecasting & Risk (`forecast`)
*   **Future Prediction**: It predicts the next 5 years (default) using `get_forecast()`.
*   **Risk Classification**:
    *   It calculates the historical average rainfall.
    *   If a predicted year is significantly lower ( ` < Avg - 0.5 * StdDev`), it flags it as **'Low'** risk (drought risk).
    *   If it's much higher, it flags it as **'High'** (flood risk).
    *   This is the business logic that translates "numbers" into "actionable advice" for the farmer.

## 7. Deployment (`export_forecasts_for_mongodb`)
Instead of just printing results, the code formats the data into a JSON structure.
*   It combines real historical data with the new future forecasts.
*   It saves this file to `backend/ml/forecasts/rainfall_forecasts.json`.
*   This specific format is designed to be read by the frontend graph components (charts) you see in the web app.

---

# IV. Key API Architecture

The backend follows a **RESTful API** design, built with Express.js. Below are the primary endpoints used in the application, categorized by module.

### 1. Authentication (`/api/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/register` | Register a new farmer or general user. |
| **POST** | `/register-broker` | Register a new broker (with ID proof upload). |
| **POST** | `/login` | Authenticate user & receive JWT token. |
| **GET** | `/check-user` | Check if an email already exists. |

### 2. User Management (`/api/users`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/all` | Get list of all users (Admin only). |
| **GET** | `/:id` | Get profile details of a specific user. |
| **PUT** | `/:id` | Update user profile information. |

### 3. Marketplace & Bidding (`/api/tree-lots` & `/api/bids`)
This is the core trading engine where farmers list lots and brokers place bids.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/tree-lots` | List active tree lots with filters (price, location). |
| **POST** | `/api/tree-lots` | (Farmer) Create a new tree lot listing. |
| **POST** | `/api/bids` | (Broker) Place a bid on a specific lot. |
| **GET** | `/api/bids/my-bids` | (Broker) View history of placed bids & status (Won/Lost). |
| **GET** | `/api/bids/history` | (Broker) Detailed bid history with filtering. |

### 4. Nursery E-commerce (`/api/nursery`)
Handles the purchase of rubber saplings.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/plants` | List all available rubber saplings. |
| **GET** | `/centers` | List all physical nursery centers. |
| **POST** | `/bookings` | Create a booking for saplings. |
| **POST** | `/bookings/:id/create-advance-order` | Initialize Razorpay order for advance payment. |
| **POST** | `/bookings/:id/verify-advance` | Verify Razorpay payment signature & confirm booking. |

### 5. Machine Learning Services (`/api`)
Exposes the predictive models to the frontend.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/weather/next-month` | Get rainfall forecast (uses SARIMA Rainfall Model). |
| **GET** | `/price-forecast/current` | Get current rubber price & short-term trend. |
| **GET** | `/price-forecast/historical` | Get 5-year historical price data for charts. |

---

# V. External Services: Supabase

### 1. What is Supabase?
Supabase is an open-source alternative to request-handling, often described as a **Backend-as-a-Service (BaaS)**. Unlike MongoDB (which is a NoSQL document store), Supabase is built on top of **PostgreSQL**, a powerful relational database. It provides:
*   Auhentication & Authorization (Auth)
*   Database (Postgres)
*   File Storage
*   Realtime Subscriptions

### 2. Why is it used in RubberEco?
While the main application data (tree lots, bids, bookings) lives in **MongoDB**, we use **Supabase** specifically to enhance the **User Management System**.

*   **Role**: It serves as a secondary provider for **Admin User Management** (`/api/users/supabase`).
*   **Benefit**:
    1.  **Hybrid Connectivity**: It allows the Admin Dashboard to potentially unify users from different sources (Google Auth users vs. Custom Email users).
    2.  **Scalability**: Offloads some of the complex user-state management (like session persistence and role updates) to a dedicated service.
    3.  **Future-Proofing**: Provides a path to relational data features (SQL joins) if the project needs to migrate complex financial data from MongoDB in the future.

---

# VI. Tech Stack: Frontend Architecture

### 1. What is React?
**React** is a JavaScript library (developed by Meta/Facebook) for building user interfaces.
*   **Core Concept**: It breaks the UI down into small, reusable pieces called **Components** (e.g., `Navbar.jsx`, `MarketCard.jsx`).
*   **Declarative**: You describe *what* the UI should look like for a given "state" (data), and React automatically updates the screen when that data changes.

### 2. Why did we choose React for RubberEco?
*   **Component Reusability**: We can write a "Button" or "Card" once and use it everywhere. This speeds up development and keeps the design consistent.
*   **Virtual DOM**: React keeps a "virtual" copy of the screen in memory. When data changes (like a new Price Forecast arriving), it calculates the most efficient way to update the real screen. This makes the dashboard feel very fast and responsive.
*   **Rich Ecosystem**: RubberEco relies on complex libraries like **Recharts** (for the price graphs) and **Google Maps**. React has the best support for these integrations.

### 3. What is Vite?
**Vite** (French for "quick") is the **Build Tool** we use to run the React application.
*   **Role**: It takes all our code files (`.jsx`, `.css`, etc.) and bundles them so the browser can understand them.
*   **Why Vite instead of Create-React-App (CRA)?**:
    *   **Speed**: Vite is significantly faster. It starts the development server almost instantly.
    *   **HMR (Hot Module Replacement)**: When you save a file, the change appears in the browser *instantly* without reloading the whole page. This drastically improves the developer experience.



---

# VII. JWT Token Authentication System

## Overview
RubberEco uses **JWT (JSON Web Tokens)** for secure user authentication across the application. This section explains how tokens are generated, stored, and used.

---

## 1. JWT Token Generation (Backend)

### Location
**File:** `backend/utils/jwt.js`

### How Tokens Are Created
```javascript
const jwt = require('jsonwebtoken');

const generateToken = (user, role = null) => {
  const payload = { 
    id: user._id, 
    email: user.email,
    role: role || user.role  // User's role (farmer, admin, staff, broker, nursery_admin)
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    { expiresIn: process.env.JWT_EXPIRE || '1h' }
  );
};
```

### Token Payload Contains:
- `id`: User's MongoDB `_id`
- `email`: User's email address
- `role`: User's role in the system
- `exp`: Expiration timestamp (default: 1 hour)

### Environment Variables
- `JWT_SECRET`: Secret key for signing tokens (stored in `.env`)
- `JWT_EXPIRE`: Token expiration time (default: `'1h'`)

---

## 2. JWT Token Storage (Frontend)

### Storage Location
Tokens are stored in the **browser's localStorage**.

### Storage Keys

#### Regular Users (Farmers, Admins, Staff, Brokers)
**File:** `RubberEco/src/components/Auth/Login.jsx` (Line 198-199)

```javascript
localStorage.setItem('token', data.token);
localStorage.setItem('user', JSON.stringify(data.user));
```

**Keys:**
- `token`: JWT authentication token
- `user`: Stringified user object containing user details

#### Nursery Admin Users
**File:** `RubberEco/src/pages/NurseryAdminLogin.jsx` (Line 40-41)

```javascript
localStorage.setItem('nurseryAdminToken', data.token);
localStorage.setItem('nurseryAdminUser', JSON.stringify(data.user));
```

**Keys:**
- `nurseryAdminToken`: JWT token for nursery admins
- `nurseryAdminUser`: Stringified nursery admin user object

---

## 3. How Tokens Are Used

### API Requests
Tokens are sent in the `Authorization` header with every authenticated API request:

```javascript
const token = localStorage.getItem('token');

fetch(`${API_BASE_URL}/api/endpoint`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Example from:** `RubberEco/src/pages/NurseryCenter.jsx` (Line 291)

### Token Retrieval
```javascript
// For regular users
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

// For nursery admins
const nurseryToken = localStorage.getItem('nurseryAdminToken');
const nurseryUser = JSON.parse(localStorage.getItem('nurseryAdminUser'));
```

---

## 4. Token Lifecycle

### Login Flow
```
User Login → Backend Validates Credentials → Generate JWT Token → 
Send Token to Frontend → Store in localStorage → Redirect to Dashboard
```

### Authenticated Requests
```
User Action → Retrieve Token from localStorage → 
Add to Authorization Header → Send Request → Backend Validates Token → 
Process Request → Return Response
```

### Logout Flow
```
User Logout → Remove Token from localStorage → 
Clear User Data → Redirect to Login Page
```

**Example Logout:**
```javascript
localStorage.removeItem('token');
localStorage.removeItem('user');
navigate('/login');
```

---

## 5. Security Considerations

### ✅ Best Practices Implemented
1. **HTTPS Only**: Tokens should only be transmitted over HTTPS in production
2. **Short Expiration**: Tokens expire after 1 hour (configurable)
3. **Role-Based Access**: Token payload includes user role for authorization

### ⚠️ Security Notes
1. **localStorage Vulnerability**: Tokens in localStorage are vulnerable to XSS attacks
2. **No Refresh Tokens**: Currently, users must re-login after token expiration
3. **Secret Key**: Ensure `JWT_SECRET` is strong and kept confidential

### 🔒 Recommendations
1. Consider implementing **httpOnly cookies** for enhanced security
2. Add **refresh token** mechanism for better user experience
3. Implement **token rotation** on sensitive operations
4. Add **CSRF protection** if using cookies

---

## 6. Token Expiration Handling

### Current Behavior
- Tokens expire after **1 hour** (default)
- Users must log in again after expiration
- No automatic refresh mechanism

### Future Improvements
- Implement refresh tokens
- Add automatic token renewal before expiration
- Show warning before token expires

---

## 7. Quick Reference Table

| User Type | Token Key | User Data Key |
|-----------|-----------|---------------|
| Regular Users | `token` | `user` |
| Nursery Admins | `nurseryAdminToken` | `nurseryAdminUser` |

---

## 8. Troubleshooting

### Token Not Working?
1. Check if token exists: `localStorage.getItem('token')`
2. Verify token hasn't expired
3. Ensure correct Authorization header format: `Bearer <token>`
4. Check backend JWT_SECRET matches

### User Logged Out Unexpectedly?
1. Token may have expired (1 hour default)
2. localStorage may have been cleared
3. Check browser console for errors

---

## 9. File References

### Backend Files
- `backend/utils/jwt.js` - Token generation utility
- `backend/config/passport.js` - Authentication configuration
- `backend/controllers/nurseryAdminController.js` - Nursery admin token generation

### Frontend Files
- `RubberEco/src/components/Auth/Login.jsx` - Regular user login & token storage
- `RubberEco/src/pages/NurseryAdminLogin.jsx` - Nursery admin login & token storage
- `RubberEco/src/pages/NurseryCenter.jsx` - Example of token usage in API calls

---

**Last Updated:** February 2026  
**Maintained By:** RubberEco Development Team
