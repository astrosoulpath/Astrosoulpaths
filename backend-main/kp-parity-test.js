const { calculateKpHouseCusps } = require("./dist/module/kundli/engine/kp-engine.util.js");

const utc = new Date("1995-01-10T05:00:00.000Z");
const result = calculateKpHouseCusps(utc, 25.5941, 85.1376);

const golden = [
  350.8724, 23.4057, 52.7333, 78.27625,
  103.7458, 135.66955, 170.8724, 203.4057,
  232.7333, 258.27625, 283.7458, 315.66955
];

function angleError(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

console.log("HOUSE | LOCAL | GOLDEN | ERROR");

let maxError = 0;

result.siderealCusps.forEach((value, i) => {
  const error = angleError(value, golden[i]);
  maxError = Math.max(maxError, error);

  console.log(
    String(i + 1).padStart(2),
    value.toFixed(6),
    golden[i].toFixed(6),
    error.toFixed(6)
  );
});

console.log("");
console.log("LOCAL ASC =", result.siderealAscendant.toFixed(6));
console.log("LOCAL MC  =", result.siderealMidheaven.toFixed(6));
console.log("MAX ERROR =", maxError.toFixed(6), "degrees");
