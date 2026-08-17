// Reemplaza restos de pesos mexicanos por euros
const fs = require("fs");
const path = require("path");

const targets = [
  "client/components/UniversalWallet.tsx",
  "client/components/WalletSection.tsx",
  "client/screens/WithdrawalScreen.tsx",
  "client/screens/LoyaltyProgramScreen.tsx",
  "client/screens/LoyaltyScreen.tsx",
  "client/screens/BecomeDriverScreen.tsx",
];

for (const p of targets) {
  let src = fs.readFileSync(p, "utf8");
  const orig = src;
  src = src.replace(/"MXN"/g, '"EUR"');
  src = src.replace(/ MXN/g, " €");
  src = src.replace(/\$10 pesos/g, "10 €");
  src = src.replace(/\$\{?MINIMUM_WITHDRAWAL\}? MXN/g, "${MINIMUM_WITHDRAWAL} €");
  src = src.replace(/\$300 MXN al día/g, "300 € al día");
  src = src.replace(/\$50 Cashback/g, "50 € de cashback");
  if (src !== orig) {
    fs.writeFileSync(p, src);
    console.log("actualizado:", p);
  }
}
