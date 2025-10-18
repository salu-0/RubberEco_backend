# Land Offering Database Setup

## Collection Name: `land_offering`

### Overview
When a farmer creates a land offering for tenancy, the data is saved to the MongoDB collection named `land_offering`.

### Database Structure

**Collection**: `land_offering` (explicitly set in the model)

**Model**: `TenancyOffering` (backend/models/TenancyOffering.js)

**API Endpoint**: `/api/tenancy-offerings`

### How It Works

#### 1. Frontend Submission
File: `RubberEco/src/components/Farmer/LandLeaseOffering.jsx`

When farmer clicks "Create Offering":
```javascript
POST ${VITE_API_BASE_URL}/tenancy-offerings
Headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer {token}'
}
Body: {
  selectedLandId,
  minimumDuration,
  maximumDuration,
  tenancyRate,
  rateType,
  paymentTerms,
  securityDeposit,
  allowedActivities,
  restrictions,
  maintenanceResponsibility,
  infrastructureProvided,
  availableFrom,
  availableUntil,
  preferredTenantType,
  minimumExperience,
  renewalOption,
  terminationClause,
  additionalTerms,
  contactMethod,
  bestTimeToContact,
  showContactDetails
}
```

#### 2. Backend Processing
File: `backend/routes/tenancyOfferings.js`

Route: `POST /api/tenancy-offerings`

Process:
1. Validates all required fields
2. Verifies land ownership (must be farmer's own land)
3. Checks land status (must be verified by admin)
4. Generates unique offering ID (e.g., TO001, TO002, etc.)
5. Creates new document in `land_offering` collection
6. Updates land registration to mark `isAvailableForTenancy = true`
7. Sends notifications to admin, tappers, brokers, and workers

#### 3. Data Storage
File: `backend/models/TenancyOffering.js`

Collection: `land_offering`

Schema includes:
- **Identification**: offeringId (unique), landId, ownerId
- **Lease Terms**: minimumDuration, maximumDuration, unit
- **Financial**: tenancyRate, rateType, paymentTerms, securityDeposit
- **Activities**: allowedActivities, restrictions
- **Responsibilities**: maintenanceResponsibility, infrastructureProvided
- **Availability**: availableFrom, availableUntil, preferredTenantType
- **Contract**: renewalOption, terminationClause, additionalTerms
- **Contact**: contactMethod, bestTimeToContact, showContactDetails
- **Status**: status (available/under_negotiation/leased/expired/withdrawn)
- **Metrics**: views, inquiries, applications
- **Tenant Info**: currentTenant (if leased)

### Fetching Land Offerings

#### Get Farmer's Offerings
```javascript
GET /api/tenancy-offerings/my-offerings
Headers: { 'Authorization': 'Bearer {token}' }
```
Returns: All offerings created by the authenticated farmer

#### Get All Available Offerings
```javascript
GET /api/tenancy-offerings
```
Returns: All offerings with status 'available'

#### Get Offering by ID
```javascript
GET /api/tenancy-offerings/:id
```
Returns: Single offering details with land and owner information

### Database Query Examples

#### MongoDB Queries

**Find all available offerings:**
```javascript
db.land_offering.find({ status: 'available' })
```

**Find offerings by farmer:**
```javascript
db.land_offering.find({ ownerId: ObjectId('farmer_id') })
```

**Find offerings for specific land:**
```javascript
db.land_offering.find({ landId: ObjectId('land_id') })
```

**Find offerings with high tenancy rate:**
```javascript
db.land_offering.find({ tenancyRate: { $gte: 50000 } })
```

### Indexes

The collection has indexes on:
- `landId`
- `ownerId`
- `status`
- `availableFrom`
- `tenancyRate`
- `leaseDuration.minimumDuration`
- `featured` and `priority`
- `createdAt` (descending)

### Integration Points

1. **Land Registration**: When offering is created, the corresponding land in `landregistrations` collection gets:
   - `isAvailableForTenancy` set to `true`
   - `tenancyOfferings` array updated with offering ID

2. **User Registration**: Owner information linked via `ownerId` to `registers` collection

3. **Notifications**: Automatic notifications sent to:
   - Admin (email)
   - All tappers (in-app)
   - All brokers (in-app)
   - All workers (in-app)

### Status Flow

1. **available** → Initial state when created
2. **under_negotiation** → When someone applies/inquires
3. **leased** → When tenant is confirmed
4. **expired** → When availableUntil date passes
5. **withdrawn** → When farmer removes the offering

### API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/tenancy-offerings` | Create new offering | Yes (Farmer) |
| GET | `/api/tenancy-offerings` | Get all available offerings | No |
| GET | `/api/tenancy-offerings/my-offerings` | Get farmer's offerings | Yes (Farmer) |
| GET | `/api/tenancy-offerings/:id` | Get offering details | No |
| PUT | `/api/tenancy-offerings/:id` | Update offering | Yes (Owner) |
| DELETE | `/api/tenancy-offerings/:id` | Delete/withdraw offering | Yes (Owner) |
| POST | `/api/tenancy-offerings/:id/apply` | Apply for tenancy | Yes (Tapper/Worker) |
| PUT | `/api/tenancy-offerings/:id/status` | Update status | Yes (Admin/Owner) |

### Verification Steps

To verify data is being saved correctly:

1. **Check MongoDB directly:**
   ```bash
   mongosh
   use your_database_name
   db.land_offering.find().pretty()
   ```

2. **Check backend logs:**
   Look for: `🏞️ Creating new tenancy offering:`

3. **Check API response:**
   Response should include: `success: true` and `data` object with offering details

4. **Check frontend console:**
   Look for: `Tenancy offering created successfully!`

### Troubleshooting

**Issue**: Offering not saving
- Check if land is verified (`status: 'verified'`)
- Verify farmer owns the land
- Check all required fields are provided
- Ensure token is valid

**Issue**: Can't fetch offerings
- Verify route is registered in server.js
- Check database connection
- Confirm collection name is `land_offering`

**Issue**: Duplicate offerings
- Check `offeringId` uniqueness
- Verify land isn't already offered (`isAvailableForTenancy`)
