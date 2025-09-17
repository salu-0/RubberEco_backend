// Pool of rubber plant varieties - each center gets 2 different varieties
const RUBBER_VARIETIES_POOL = [
  {
    id: 'rrii-105',
    name: 'RRII 105',
    description: 'High-yielding clone with excellent latex production',
    characteristics: ['High yield', 'Disease resistant', 'Suitable for all regions']
  },
  {
    id: 'rrii-430',
    name: 'RRII 430',
    description: 'Premium quality clone with superior latex quality',
    characteristics: ['Premium quality', 'Latex quality', 'High market value']
  },
  {
    id: 'rrii-414',
    name: 'RRII 414',
    description: 'Drought-resistant variety with good latex yield',
    characteristics: ['Drought resistant', 'Good yield', 'Low maintenance']
  },
  {
    id: 'rrii-203',
    name: 'RRII 203',
    description: 'Early maturing clone with consistent production',
    characteristics: ['Early maturing', 'Consistent yield', 'Fast growth']
  },
  {
    id: 'gt-1',
    name: 'GT 1',
    description: 'Traditional variety with proven track record',
    characteristics: ['Traditional', 'Proven', 'Stable production']
  },
  {
    id: 'pb-217',
    name: 'PB 217',
    description: 'High-quality latex with excellent processing properties',
    characteristics: ['High quality', 'Excellent processing', 'Premium latex']
  }
];

// Get variety by ID
const getVarietyById = (id) => {
  return RUBBER_VARIETIES_POOL.find(variety => variety.id === id);
};

// Get all varieties
const getAllVarieties = () => {
  return RUBBER_VARIETIES_POOL;
};

// Get varieties for a specific center (2 varieties per center)
const getVarietiesForCenter = (centerId, totalCenters) => {
  const varietiesPerCenter = 2;
  const startIndex = (centerId % totalCenters) * varietiesPerCenter;
  const endIndex = startIndex + varietiesPerCenter;
  
  // Cycle through varieties if we have more centers than variety combinations
  const cycleLength = Math.ceil(RUBBER_VARIETIES_POOL.length / varietiesPerCenter);
  const actualStartIndex = (centerId % cycleLength) * varietiesPerCenter;
  const actualEndIndex = Math.min(actualStartIndex + varietiesPerCenter, RUBBER_VARIETIES_POOL.length);
  
  return RUBBER_VARIETIES_POOL.slice(actualStartIndex, actualEndIndex);
};

// Validate variety
const isValidVariety = (varietyName) => {
  return RUBBER_VARIETIES_POOL.some(variety => 
    variety.name.toLowerCase() === varietyName.toLowerCase() ||
    variety.id.toLowerCase() === varietyName.toLowerCase()
  );
};

// Check if variety is available for center
const isVarietyAvailableForCenter = (varietyName, centerId, totalCenters) => {
  const centerVarieties = getVarietiesForCenter(centerId, totalCenters);
  return centerVarieties.some(variety => 
    variety.name.toLowerCase() === varietyName.toLowerCase() ||
    variety.id.toLowerCase() === varietyName.toLowerCase()
  );
};

module.exports = {
  RUBBER_VARIETIES_POOL,
  getVarietyById,
  getAllVarieties,
  isValidVariety,
  getVarietiesForCenter,
  isVarietyAvailableForCenter
};
