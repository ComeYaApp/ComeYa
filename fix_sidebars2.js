const fs = require("fs");

const files = [
  "client/screens/AddBankAccountScreen.web.tsx",
  "client/screens/AddressesScreen.web.tsx",
  "client/screens/AdminPaymentAccountsScreen.web.tsx",
  "client/screens/BecomeDriverScreen.web.tsx",
  "client/screens/BusinessCategoriesScreen.web.tsx",
  "client/screens/BusinessHoursScreen.web.tsx",
  "client/screens/BusinessManageScreen.web.tsx",
  "client/screens/DeliveryEarningsScreen.web.tsx",
  "client/screens/LegalScreen.web.tsx",
  "client/screens/PaymentWalletSetupScreen.web.tsx",
  "client/screens/PrivacyScreen.web.tsx",
  "client/screens/ReportIssueScreen.web.tsx",
  "client/screens/TermsScreen.web.tsx",
  "client/screens/EditProfileScreen.web.tsx",
];

files.forEach((f) => {
  let src = fs.readFileSync(f, "utf8");
  const orig = src;

  // Quitar {!isMobile && que precede al <View del sidebar (en la misma linea)
  src = src.replace(/\{!isMobile && (<View )/g, "$1");

  // Quitar ) } que cierra el condicional si quedó como linea sola
  // Patron: \n      )}\n  ->  quitar esa linea
  src = src.replace(/\n(\s+)\)\}\n(\n\s+\{\/\* Main)/g, "\n$2");
  src = src.replace(/\n(\s+)\)\}\n(\n\s+<ScrollView)/g, "\n$2");
  src = src.replace(/\n(\s+)\)\}\n(\n\s+<View style=\{s\.main)/g, "\n$2");

  if (src !== orig) {
    fs.writeFileSync(f, src, "utf8");
    process.stdout.write("FIXED: " + f + "\n");
  } else {
    process.stdout.write("NO CHANGE: " + f + "\n");
  }
});

process.stdout.write("Done.\n");
