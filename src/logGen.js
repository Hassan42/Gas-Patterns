const fs = require('fs');

const NUM_TRACES = 500; //500
const MAX_ITEMS = 10; //10
const BALANCE_SUFFICIENCY_CHANCE = 0.6;  //0.7

// Helpers
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(4);
const randBool = () => Math.random() < 0.2;
const randAddress = () => `${randInt(100, 999)} ${['Main St', 'Oak Ave', 'Pine Rd', 'Maple Blvd'][randInt(0, 3)]}`;
const randFundingAmount = () => randFloat(1, 1);

function calculateExpectedCost(stockLevels, itemPrices) {
  return stockLevels.reduce((sum, stock, i) => sum + stock * itemPrices[i], 0).toFixed(4);
}

function assignBalanceSufficiency() {
  return Math.random() < BALANCE_SUFFICIENCY_CHANCE;
}

// Special trace where one item is fixed per attempt
function generateSpecialTrace() {
  const NUM_ITEMS = 10;
  const ATTEMPTS = NUM_ITEMS;

  const stockLevels = Array.from({ length: NUM_ITEMS }, () => randInt(5, 15));
  const itemPrices = Array.from({ length: NUM_ITEMS }, () => +randFloat(0.0005, 0.003));
  const expectedCost = calculateExpectedCost(stockLevels, itemPrices);
  const balanceSufficient = assignBalanceSufficiency();

  const fixedQuantities = new Array(NUM_ITEMS).fill(null);
  const attempts = [];

  for (let a = 0; a < ATTEMPTS; a++) {
    const quantities = new Array(NUM_ITEMS);

    for (let i = 0; i < NUM_ITEMS; i++) {
      if (fixedQuantities[i] !== null) {
        quantities[i] = fixedQuantities[i];
      } else if (i === a) {
        const validQty = randInt(1, stockLevels[i]);
        fixedQuantities[i] = validQty;
        quantities[i] = validQty;
      } else {
        quantities[i] = stockLevels[i] + randInt(1, 10);
      }
    }

    attempts.push({
      attempt: a,
      itemIds: Array.from({ length: NUM_ITEMS }, (_, j) => j + 1),
      quantities
    });

    const isSuccess = quantities.every((qty, i) => qty <= stockLevels[i]);
    if (isSuccess) break;
  }

  return {
    trace_id: 'trace_1',
    domestic: randBool(),
    clearance: randBool(),
    deliveryAddress: randAddress(),
    stockLevels,
    itemPrices,
    expectedCost: +expectedCost,
    balanceSufficient,
    fundingAmount: randFundingAmount(),
    attempts
  };
}

// Random trace with gradual fixing and dynamic max attempts
function generateRandomTrace(index) {
  const numItems = randInt(3, MAX_ITEMS);
  const dynamicMaxAttempts = Math.ceil(numItems * randFloat(1.5, 2.5));

  const stockLevels = Array.from({ length: numItems }, () => randInt(5, 15));
  const itemPrices = Array.from({ length: numItems }, () => +randFloat(0.0005, 0.003));
  const expectedCost = calculateExpectedCost(stockLevels, itemPrices);
  const balanceSufficient = assignBalanceSufficiency();

  const fixedQuantities = new Array(numItems).fill(null);
  const attempts = [];

  for (let a = 0; a < dynamicMaxAttempts; a++) {
    const quantities = new Array(numItems);
    const fixProbability = a / dynamicMaxAttempts;

    for (let i = 0; i < numItems; i++) {
      if (fixedQuantities[i] !== null) {
        quantities[i] = fixedQuantities[i];
      } else if (Math.random() < fixProbability) {
        const validQty = randInt(1, stockLevels[i]);
        fixedQuantities[i] = validQty;
        quantities[i] = validQty;
      } else {
        quantities[i] = stockLevels[i] + randInt(1, 10);
      }
    }

    attempts.push({
      attempt: a,
      itemIds: Array.from({ length: numItems }, (_, j) => j + 1),
      quantities
    });

    const isSuccess = quantities.every((qty, i) => qty <= stockLevels[i]);
    if (isSuccess) break;
  }

  const lastAttempt = attempts[attempts.length - 1];
  const isLastSuccess = lastAttempt.quantities.every((qty, i) => qty <= stockLevels[i]);

  if (!isLastSuccess) {
    const validQuantities = stockLevels.map((stock, i) =>
      fixedQuantities[i] !== null ? fixedQuantities[i] : randInt(1, stock)
    );

    attempts.push({
      attempt: attempts.length,
      itemIds: Array.from({ length: numItems }, (_, j) => j + 1),
      quantities: validQuantities
    });
  }

  return {
    trace_id: `trace_${index}`,
    domestic: randBool(),
    clearance: randBool(),
    deliveryAddress: randAddress(),
    stockLevels,
    itemPrices,
    expectedCost: +expectedCost,
    balanceSufficient,
    fundingAmount: randFundingAmount(),
    attempts
  };
}

// Generate all traces
const traces = [generateSpecialTrace()];
for (let i = 2; i <= NUM_TRACES; i++) {
  traces.push(generateRandomTrace(i));
}

// Calculate statistics
const stats = {
  totalTraces: traces.length,
  totalAttempts: 0,
  totalItems: 0,
  maxAttempts: 0,
  minAttempts: Infinity,
  maxItems: 0,
  minItems: Infinity,
  successfulTraces: 0,
  successfulTraceIds: [],
  tracesWithSufficientBalance: 0,
  tracesWithInsufficientBalance: 0
};

traces.forEach(trace => {
  const attemptsCount = trace.attempts.length;
  const itemsCount = trace.stockLevels.length;
  const lastAttempt = trace.attempts[trace.attempts.length - 1];

  stats.totalAttempts += attemptsCount;
  stats.totalItems += itemsCount;
  stats.maxAttempts = Math.max(stats.maxAttempts, attemptsCount);
  stats.minAttempts = Math.min(stats.minAttempts, attemptsCount);
  stats.maxItems = Math.max(stats.maxItems, itemsCount);
  stats.minItems = Math.min(stats.minItems, itemsCount);

  const isSuccess = lastAttempt.quantities.every((qty, i) => qty <= trace.stockLevels[i]);
  if (isSuccess) {
    stats.successfulTraces++;
    stats.successfulTraceIds.push(trace.trace_id);
  }

  if (trace.balanceSufficient) {
    stats.tracesWithSufficientBalance++;
  } else {
    stats.tracesWithInsufficientBalance++;
  }
});

stats.averageAttemptsPerTrace = Number((stats.totalAttempts / stats.totalTraces).toFixed(2));
stats.averageItemsPerTrace = Number((stats.totalItems / stats.totalTraces).toFixed(2));
stats.successRate = Number(((stats.successfulTraces / stats.totalTraces) * 100).toFixed(2));

// Save
fs.writeFileSync('traces.json', JSON.stringify({ traces, statistics: stats }, null, 2));
console.log(`Saved ${NUM_TRACES} traces with statistics to traces.json`);
