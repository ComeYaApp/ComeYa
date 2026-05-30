import React, { useState, useEffect } from "react";
import { AdminShell, AdminSection } from "@/components/admin/AdminShell.web";
import { FinanceTab } from "@/components/admin/tabs/FinanceTab.web";
import { PaymentProofsTab } from "@/components/admin/tabs/PaymentProofsTab.web";
import AdminPaymentAccountsPanel from "@/screens/AdminPaymentAccountsScreen.web";
import { GiftCardsAdminTab } from "../components/admin/tabs/GiftCardsAdminTab.web";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";

export default function AdminFinanceScreen() {
  const { showToast } = useToast();
  const [section, setSection] = useState<AdminSection>("finance_earnings");
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    apiRequest("GET", "/api/admin/dashboard/metrics")
      .then((r) => r.json())
      .then((m) => {
        if (m) setMetrics(m);
      })
      .catch(() => {});
  }, []);

  const renderContent = () => {
    switch (section) {
      case "finance_giftcards":
        return <GiftCardsAdminTab />;
      case "finance":
      case "finance_earnings":
        return <FinanceTab defaultTab="earnings" />;
      case "finance_payouts":
        return <FinanceTab defaultTab="payouts" />;
      case "finance_proofs":
        return <PaymentProofsTab />;
      case "finance_accounts":
        return <AdminPaymentAccountsPanel />;
      default:
        return <FinanceTab defaultTab="earnings" />;
    }
  };

  return (
    <AdminShell active={section} onChange={setSection} metrics={metrics}>
      {renderContent()}
    </AdminShell>
  );
}
