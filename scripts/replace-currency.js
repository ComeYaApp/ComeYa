const fs = require('fs');
const path = require('path');

const files = [
  'client/screens/AdminDashboardScreen.tsx',
  'client/screens/BusinessAnalyticsScreen.tsx',
  'client/screens/BusinessDashboardScreen.tsx',
  'client/screens/BusinessFinancesScreen.tsx',
  'client/screens/CheckoutScreen.tsx',
  'client/screens/DriverAvailableOrdersScreen.tsx',
  'client/screens/DriverMyDeliveriesScreen.tsx',
  'client/screens/GiftCardsScreen.tsx',
  'client/screens/GroupOrderScreen.tsx',
  'client/screens/HomeScreen.tsx',
  'client/screens/ScheduledOrdersScreen.tsx',
  'client/screens/SubscriptionScreen.tsx',
  'client/screens/PagoMovilPaymentScreen.tsx',
];

for (const file of files) {
  const fullPath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(fullPath, 'utf8');
  const before = content;
  content = content.replace(/Bs\.\s*/g, '€');
  content = content.replace(/`Bs\b/g, '`€');
  if (content !== before) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('✅ Updated:', file);
  } else {
    console.log('⏭ No changes:', file);
  }
}
