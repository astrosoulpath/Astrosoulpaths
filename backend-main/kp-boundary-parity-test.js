const fs = require("fs");
const { calculateKpHouseCusps } =
  require("./dist/module/kundli/engine/kp-engine.util.js");

const saved = JSON.parse(
  fs.readFileSync("./kundli-step5-live-result.json", "utf8")
);

const kp = saved.report?.kp ?? saved.data?.kp;

const local = calculateKpHouseCusps(
  new Date("1995-01-10T05:00:00.000Z"),
  25.5941,
  85.1376
);

function norm(x) {
  return ((x % 360) + 360) % 360;
}

function error(a, b) {
  let d = Math.abs(norm(a) - norm(b));
  if (d > 180) d = 360 - d;
  return d;
}

console.log(
  "HOUSE | LOCAL CUSP | VENDOR START | ERROR"
);

let maxError = 0;

for (let i = 0; i < 12; i++) {
  const localCusp = local.siderealCusps[i];
  const vendorStart =
    Number(kp.houses[i].global_start_degree);

  const e = error(localCusp, vendorStart);
  maxError = Math.max(maxError, e);

  console.log(
    String(i + 1).padStart(2),
    localCusp.toFixed(6),
    vendorStart.toFixed(6),
    e.toFixed(6)
  );
}

console.log("");
console.log(
  "MAX BOUNDARY ERROR =",
  maxError.toFixed(6),
  "degrees"
);

console.log(
  "LOCAL ASC =",
  local.siderealAscendant.toFixed(6)
);

console.log(
  "VENDOR ASC =",
  Number(kp.planets["0"].global_degree).toFixed(6)
);

console.log(
  "ASC ERROR =",
  error(
    local.siderealAscendant,
    Number(kp.planets["0"].global_degree)
  ).toFixed(6),
  "degrees"
);
