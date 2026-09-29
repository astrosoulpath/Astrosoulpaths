const { calculateKpHouseCusps } =
  require("./dist/module/kundli/engine/kp-engine.util.js");

const r = calculateKpHouseCusps(
  new Date("1995-01-10T05:00:00.000Z"),
  25.5941,
  85.1376
);

console.log("===== CURRENT KP CUSPS =====");

for (let i = 0; i < 12; i++) {
  console.log(
    `H${String(i + 1).padStart(2, "0")}`,
    "TROPICAL=",
    r.tropicalCusps[i].toFixed(9),
    "SIDEREAL=",
    r.siderealCusps[i].toFixed(9)
  );
}

console.log("");
console.log(
  "ASC SIDEREAL =",
  r.siderealAscendant.toFixed(9)
);

console.log(
  "MC SIDEREAL  =",
  r.siderealMidheaven.toFixed(9)
);
