/**
 * Cash Flow Agent
 * Analyzes investment potential and ROI
 */

import { logger } from '../utils/logger';

export class CashFlowAgent {
  /**
   * Execute cash flow analysis task
   */
  async execute(inputData: any, userId: string): Promise<any> {
    logger.info('Cash flow agent executing...', { inputData });

    try {
      const {
        purchasePrice,
        downPaymentPercent = 20,
        interestRate = 7.0,
        loanTermYears = 30,
        monthlyRent,
        propertyTaxRate = 1.2,
        insurance = 1200,
        maintenance = 1000,
        vacancy = 0.05,
      } = inputData;

      // Calculate mortgage payment
      const downPayment = purchasePrice * (downPaymentPercent / 100);
      const loanAmount = purchasePrice - downPayment;
      const monthlyRate = interestRate / 100 / 12;
      const numPayments = loanTermYears * 12;

      const monthlyMortgage =
        (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1);

      // Calculate monthly expenses
      const monthlyPropertyTax = (purchasePrice * (propertyTaxRate / 100)) / 12;
      const monthlyInsurance = insurance / 12;
      const monthlyMaintenance = maintenance / 12;

      const totalMonthlyExpenses =
        monthlyMortgage + monthlyPropertyTax + monthlyInsurance + monthlyMaintenance;

      // Calculate cash flow
      const adjustedMonthlyRent = monthlyRent * (1 - vacancy);
      const monthlyCashFlow = adjustedMonthlyRent - totalMonthlyExpenses;
      const annualCashFlow = monthlyCashFlow * 12;

      // Calculate ROI
      const totalInvestment = downPayment;
      const cashOnCashReturn = (annualCashFlow / totalInvestment) * 100;

      return {
        purchasePrice,
        downPayment,
        loanAmount,
        monthlyMortgage,
        monthlyExpenses: {
          mortgage: monthlyMortgage,
          propertyTax: monthlyPropertyTax,
          insurance: monthlyInsurance,
          maintenance: monthlyMaintenance,
          total: totalMonthlyExpenses,
        },
        monthlyRent: adjustedMonthlyRent,
        monthlyCashFlow,
        annualCashFlow,
        cashOnCashReturn,
        opportunityScore: this.calculateOpportunityScore(cashOnCashReturn, monthlyCashFlow),
        status: 'success',
      };
    } catch (error: any) {
      logger.error('Cash flow agent execution failed:', error);
      throw error;
    }
  }

  private calculateOpportunityScore(cashOnCashReturn: number, monthlyCashFlow: number): number {
    let score = 50;

    // Positive cash flow is essential
    if (monthlyCashFlow > 0) score += 20;
    if (monthlyCashFlow > 500) score += 10;

    // Good cash-on-cash return
    if (cashOnCashReturn > 8) score += 15;
    if (cashOnCashReturn > 12) score += 5;

    return Math.min(100, Math.max(0, score));
  }
}
