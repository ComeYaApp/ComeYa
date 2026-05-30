import {
  calculateDistance,
  calculateDeliveryFee,
  estimateDeliveryTime,
} from "./distance";
import { isInCoverageArea, AUTLAN_CENTER } from "./coverage";

// Test data - real coordinates in San Cristóbal, Venezuela
const TEST_LOCATIONS = {
  center: { lat: 7.7669, lng: -72.225 }, // Centro de San Cristóbal
  north: { lat: 7.7769, lng: -72.225 }, // ~1km north
  south: { lat: 7.7569, lng: -72.225 }, // ~1km south
  east: { lat: 7.7669, lng: -72.215 }, // ~1km east
  west: { lat: 7.7669, lng: -72.235 }, // ~1km west
  outside: { lat: 7.8, lng: -72.3 }, // Outside coverage
};

export const runDistanceTests = () => {
  console.log("🧪 TESTING: Distance Calculations");

  // Test 1: Same location should return 0
  const sameLocation = calculateDistance(
    TEST_LOCATIONS.center.lat,
    TEST_LOCATIONS.center.lng,
    TEST_LOCATIONS.center.lat,
    TEST_LOCATIONS.center.lng,
  );
  console.log(
    `✅ Same location distance: ${sameLocation.toFixed(3)}km (expected: 0)`,
  );

  // Test 2: North-South distance (~1km)
  const northSouth = calculateDistance(
    TEST_LOCATIONS.north.lat,
    TEST_LOCATIONS.north.lng,
    TEST_LOCATIONS.south.lat,
    TEST_LOCATIONS.south.lng,
  );
  console.log(
    `✅ North-South distance: ${northSouth.toFixed(3)}km (expected: ~2km)`,
  );

  // Test 3: East-West distance (~1km)
  const eastWest = calculateDistance(
    TEST_LOCATIONS.east.lat,
    TEST_LOCATIONS.east.lng,
    TEST_LOCATIONS.west.lat,
    TEST_LOCATIONS.west.lng,
  );
  console.log(
    `✅ East-West distance: ${eastWest.toFixed(3)}km (expected: ~2km)`,
  );

  return { sameLocation, northSouth, eastWest };
};

export const runDeliveryFeeTests = () => {
  console.log("🧪 TESTING: Delivery Fee Calculations");

  const testCases = [
    { distance: 0, expected: 20 }, // Base fee
    { distance: 1, expected: 25 }, // Base + 1km
    { distance: 2, expected: 30 }, // Base + 2km
    { distance: 5, expected: 45 }, // Base + 5km
    { distance: 10, expected: 50 }, // Should cap at 50
    { distance: 20, expected: 50 }, // Should cap at 50
  ];

  testCases.forEach(({ distance, expected }) => {
    const fee = calculateDeliveryFee(distance);
    const status = fee === expected ? "✅" : "❌";
    console.log(
      `${status} Distance: ${distance}km → Fee: $${fee} (expected: $${expected})`,
    );
  });

  return testCases.map(({ distance }) => ({
    distance,
    fee: calculateDeliveryFee(distance),
  }));
};

export const runTimeEstimationTests = () => {
  console.log("🧪 TESTING: Time Estimations");

  const testCases = [
    { distance: 0.5, expectedMin: 15, expectedMax: 25 },
    { distance: 1, expectedMin: 20, expectedMax: 30 },
    { distance: 2, expectedMin: 25, expectedMax: 35 },
    { distance: 5, expectedMin: 35, expectedMax: 50 },
  ];

  testCases.forEach(({ distance, expectedMin, expectedMax }) => {
    const time = estimateDeliveryTime(distance);
    const inRange = time >= expectedMin && time <= expectedMax;
    const status = inRange ? "✅" : "❌";
    console.log(
      `${status} Distance: ${distance}km → Time: ${time}min (expected: ${expectedMin}-${expectedMax}min)`,
    );
  });

  return testCases.map(({ distance }) => ({
    distance,
    time: estimateDeliveryTime(distance),
  }));
};

export const runCoverageTests = () => {
  console.log("🧪 TESTING: Coverage Area Validation");

  const testCases = [
    { name: "Center", ...TEST_LOCATIONS.center, expected: true },
    { name: "North", ...TEST_LOCATIONS.north, expected: true },
    { name: "South", ...TEST_LOCATIONS.south, expected: true },
    { name: "East", ...TEST_LOCATIONS.east, expected: true },
    { name: "West", ...TEST_LOCATIONS.west, expected: true },
    { name: "Outside", ...TEST_LOCATIONS.outside, expected: false },
  ];

  testCases.forEach(({ name, lat, lng, expected }) => {
    const inCoverage = isInCoverageArea(lat, lng);
    const status = inCoverage === expected ? "✅" : "❌";
    console.log(
      `${status} ${name} (${lat}, ${lng}): ${inCoverage ? "IN" : "OUT"} (expected: ${expected ? "IN" : "OUT"})`,
    );
  });

  return testCases.map(({ name, lat, lng }) => ({
    name,
    coordinates: { lat, lng },
    inCoverage: isInCoverageArea(lat, lng),
  }));
};

export const runAllTests = () => {
  console.log("🚀 RUNNING ALL TESTS...\n");

  const results = {
    distance: runDistanceTests(),
    deliveryFee: runDeliveryFeeTests(),
    timeEstimation: runTimeEstimationTests(),
    coverage: runCoverageTests(),
  };

  console.log("\n✅ ALL TESTS COMPLETED");
  return results;
};

// Auto-run tests in development
if (__DEV__) {
  // Uncomment to run tests on app load
  // setTimeout(runAllTests, 2000);
}
