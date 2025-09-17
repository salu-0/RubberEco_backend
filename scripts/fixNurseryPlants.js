require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const NurseryPlant = require('../models/NurseryPlant');

async function main() {
  try {
    await connectDB();
    const defaultPrice = Number(process.env.NURSERY_DEFAULT_PRICE || 25);
    const defaultMinQty = Number(process.env.NURSERY_DEFAULT_MIN_QTY || 1);

    const queryMissingPrice = {
      $or: [
        { unitPrice: { $exists: false } },
        { unitPrice: null },
        { unitPrice: { $lte: 0 } }
      ]
    };

    const priceResult = await NurseryPlant.updateMany(queryMissingPrice, { $set: { unitPrice: defaultPrice } });

    const queryMissingMin = {
      $or: [
        { minOrderQty: { $exists: false } },
        { minOrderQty: null },
        { minOrderQty: { $lte: 0 } }
      ]
    };
    const minResult = await NurseryPlant.updateMany(queryMissingMin, { $set: { minOrderQty: defaultMinQty } });

    console.log('Updated unitPrice for docs:', priceResult.modifiedCount ?? priceResult.nModified);
    console.log('Updated minOrderQty for docs:', minResult.modifiedCount ?? minResult.nModified);
  } catch (err) {
    console.error('Fix script error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();


