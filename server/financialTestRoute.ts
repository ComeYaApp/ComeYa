// Financial System Test Route
import { Router } from "express";
import { FinancialSystemValidator } from "./financialSystemValidator";
import { FinancialSystemE2ETests } from "./financialSystemE2ETests";
import { FinancialSecurityAudit } from "./financialSecurityAudit";
import { financialService } from "./unifiedFinancialService";

const router = Router();

// Test financial system integrity
router.get("/test-financial-system", async (req, res) => {
  try {
    console.log("🔍 Testing Financial System Integration...");

    // Test 1: Commission consistency
    const consistencyTest =
      await FinancialSystemValidator.validateCommissionConsistency();
    console.log(
      "✅ Commission Consistency:",
      consistencyTest.success ? "PASS" : "FAIL",
    );
    if (!consistencyTest.success) {
      console.log("❌ Errors:", consistencyTest.errors);
    }

    // Test 2: Calculation accuracy
    const accuracyTest =
      await FinancialSystemValidator.testCalculationAccuracy();
    console.log(
      "✅ Calculation Accuracy:",
      accuracyTest.success ? "PASS" : "FAIL",
    );

    // Test 3: System integration
    const integrationTest =
      await FinancialSystemValidator.validateSystemIntegration();
    console.log(
      "✅ System Integration:",
      integrationTest.success ? "PASS" : "FAIL",
    );

    // Test 4: Get current rates
    const currentRates = await financialService.getCommissionRates();
    console.log("📊 Current Commission Rates:", {
      platform: `${(currentRates.platform * 100).toFixed(1)}%`,
      business: `${(currentRates.business * 100).toFixed(1)}%`,
      driver: `${(currentRates.driver * 100).toFixed(1)}%`,
    });

    const allTestsPassed =
      consistencyTest.success &&
      accuracyTest.success &&
      integrationTest.success;

    res.json({
      success: allTestsPassed,
      message: allTestsPassed
        ? "🎉 Financial system is fully integrated and secure!"
        : "⚠️ Financial system has issues",
      tests: {
        commissionConsistency: consistencyTest,
        calculationAccuracy: accuracyTest,
        systemIntegration: integrationTest,
      },
      currentRates: {
        platform: `${(currentRates.platform * 100).toFixed(1)}%`,
        business: `${(currentRates.business * 100).toFixed(1)}%`,
        driver: `${(currentRates.driver * 100).toFixed(1)}%`,
        total: `${((currentRates.platform + currentRates.business + currentRates.driver) * 100).toFixed(1)}%`,
      },
    });
  } catch (error: any) {
    console.error("❌ Financial system test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Run comprehensive E2E tests
router.get("/test-financial-e2e", async (req, res) => {
  try {
    console.log("🧪 Running Comprehensive Financial E2E Tests...");

    const e2eTests = new FinancialSystemE2ETests();
    const results = await e2eTests.runAllTests();

    console.log(`\n📊 E2E Test Results:`);
    console.log(`✅ Passed: ${results.passedTests}/${results.totalTests}`);
    console.log(`❌ Failed: ${results.failedTests}/${results.totalTests}`);
    console.log(
      `🎯 Success Rate: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`,
    );

    res.json({
      success: results.success,
      message: results.success
        ? "🎉 All financial system tests passed!"
        : `⚠️ ${results.failedTests} tests failed`,
      summary: {
        totalTests: results.totalTests,
        passedTests: results.passedTests,
        failedTests: results.failedTests,
        successRate: `${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`,
      },
      detailedResults: results.results,
    });
  } catch (error: any) {
    console.error("❌ E2E tests failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Run security audit
router.get("/security-audit", async (req, res) => {
  try {
    console.log("🔒 Running Financial Security Audit...");

    const auditResults = await FinancialSecurityAudit.runSecurityAudit();

    console.log(`\n📊 Security Audit Results:`);
    console.log(`💯 Security Score: ${auditResults.score}/100`);
    console.log(`⚠️ Vulnerabilities: ${auditResults.vulnerabilities.length}`);
    console.log(`📝 Recommendations: ${auditResults.recommendations.length}`);

    // Log critical vulnerabilities
    const critical = auditResults.vulnerabilities.filter(
      (v) => v.severity === "CRITICAL",
    );
    if (critical.length > 0) {
      console.log("\n🚨 CRITICAL VULNERABILITIES:");
      critical.forEach((v) => console.log(`  - ${v.description}`));
    }

    res.json({
      success: auditResults.success,
      message: auditResults.success
        ? "🔒 Financial system security audit passed!"
        : `⚠️ Security issues found - Score: ${auditResults.score}/100`,
      securityScore: auditResults.score,
      summary: {
        totalVulnerabilities: auditResults.vulnerabilities.length,
        critical: auditResults.vulnerabilities.filter(
          (v) => v.severity === "CRITICAL",
        ).length,
        high: auditResults.vulnerabilities.filter((v) => v.severity === "HIGH")
          .length,
        medium: auditResults.vulnerabilities.filter(
          (v) => v.severity === "MEDIUM",
        ).length,
        low: auditResults.vulnerabilities.filter((v) => v.severity === "LOW")
          .length,
        recommendations: auditResults.recommendations.length,
      },
      vulnerabilities: auditResults.vulnerabilities,
      recommendations: auditResults.recommendations,
    });
  } catch (error: any) {
    console.error("❌ Security audit failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test specific financial scenario
router.post("/test-financial-scenario", async (req, res) => {
  try {
    const { orderTotal, expectedPlatform, expectedBusiness, expectedDriver } =
      req.body;

    if (!orderTotal) {
      return res.status(400).json({ error: "orderTotal is required" });
    }

    const commissions = await financialService.calculateCommissions(orderTotal);
    const rates = await financialService.getCommissionRates();

    const results = {
      input: { orderTotal },
      calculated: commissions,
      rates: {
        platform: `${(rates.platform * 100).toFixed(1)}%`,
        business: `${(rates.business * 100).toFixed(1)}%`,
        driver: `${(rates.driver * 100).toFixed(1)}%`,
      },
      validation: {
        totalMatches: commissions.total === orderTotal,
        platformCorrect:
          !expectedPlatform || commissions.platform === expectedPlatform,
        businessCorrect:
          !expectedBusiness || commissions.business === expectedBusiness,
        driverCorrect: !expectedDriver || commissions.driver === expectedDriver,
      },
    };

    const allValid = Object.values(results.validation).every((v) => v === true);

    res.json({
      success: allValid,
      message: allValid ? "Scenario test passed" : "Scenario test failed",
      results,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Run all tests (comprehensive)
router.get("/test-all", async (req, res) => {
  try {
    console.log("🚀 Running ALL Financial System Tests...");

    // Run all test suites
    const [basicTests, e2eResults, securityAudit] = await Promise.all([
      (async () => {
        const consistency =
          await FinancialSystemValidator.validateCommissionConsistency();
        const accuracy =
          await FinancialSystemValidator.testCalculationAccuracy();
        const integration =
          await FinancialSystemValidator.validateSystemIntegration();
        return { consistency, accuracy, integration };
      })(),
      new FinancialSystemE2ETests().runAllTests(),
      FinancialSecurityAudit.runSecurityAudit(),
    ]);

    const overallSuccess =
      basicTests.consistency.success &&
      basicTests.accuracy.success &&
      basicTests.integration.success &&
      e2eResults.success &&
      securityAudit.success;

    const totalTests =
      3 +
      e2eResults.totalTests +
      (securityAudit.vulnerabilities.length === 0 ? 1 : 0);
    const passedTests =
      (basicTests.consistency.success ? 1 : 0) +
      (basicTests.accuracy.success ? 1 : 0) +
      (basicTests.integration.success ? 1 : 0) +
      e2eResults.passedTests +
      (securityAudit.success ? 1 : 0);

    console.log(`\n📊 COMPREHENSIVE TEST RESULTS:`);
    console.log(`✅ Overall Success: ${overallSuccess ? "PASS" : "FAIL"}`);
    console.log(
      `💯 Total Score: ${passedTests}/${totalTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`,
    );
    console.log(`🔒 Security Score: ${securityAudit.score}/100`);

    res.json({
      success: overallSuccess,
      message: overallSuccess
        ? "🎉 ALL financial system tests passed! System is production-ready."
        : "⚠️ Some tests failed. Review issues before production deployment.",
      overallScore: {
        totalTests,
        passedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`,
        securityScore: securityAudit.score,
      },
      results: {
        basicTests,
        e2eTests: e2eResults,
        securityAudit,
      },
    });
  } catch (error: any) {
    console.error("❌ Comprehensive tests failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
