const fs = require("fs");
const { calculateKpHouseCusps } =
  require("./dist/module/kundli/engine/kp-engine.util.js");

const saved = JSON.parse(
  fs.readFileSync("./kundli-step5-live-result.json", "utf8")
);

const kp = saved.report?.kp ?? saved.data?.kp;

const utc = new Date("1995-01-10T05:00:00.000Z");

const local = calculateKpHouseCusps(
  utc,
  25.5941,
  85.1376
);

function norm(x) {
  return ((x % 360) + 360) % 360;
}

function err(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

console.log("HOUSE | LOCAL CUSP | SAVED BHAVMADHYA GLOBAL | ERROR");

let maxError = 0;

kp.houses.forEach((h, i) => {
  /*
    bhavmadhya is stored as degree inside its zodiac sign.
    Determine the sign containing the midpoint by walking
    halfway through the saved house span.
  */

  const start = Number(h.global_start_degree);
  const length = Number(h.length);

  const midpointApprox = norm(start + length / 2);

  const signStart =
    Math.floor(midpointApprox / 30) * 30;

  const savedCusp =
    norm(signStart + Number(h.bhavmadhya));

  const localCusp =
    local.siderealCusps[i];

  const error =
    err(localCusp, savedCusp);

  maxError =
    Math.max(maxError, error);

  console.log(
    String(i + 1).padStart(2),
    localCusp.toFixed(6),
    savedCusp.toFixed(6),
    error.toFixed(6)
  );
});

console.log("");
console.log(
  "LOCAL ASC =",
  local.siderealAscendant.toFixed(6)
);

console.log(
  "SAVED ASC =",
  Number(kp.planets["0"].global_degree).toFixed(6)
);

console.log(
  "ASC ERROR =",
  err(
    local.siderealAscendant,
    Number(kp.planets["0"].global_degree)
  ).toFixed(6)
);

console.log(
  "MAX HOUSE ERROR =",
  maxError.toFixed(6),
  "degrees"
);
