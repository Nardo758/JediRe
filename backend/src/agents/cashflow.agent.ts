import { logger } from '../utils/logger';
import type { DealFinancialContext } from '../services/deal-financial-context.service';

export class CashFlowAgent {
  async execute(inputData: any, userId: string): Promise<any> {
    logger.info('Cash flow agent executing...', { dealId: inputData.dealId });

    try {
      const finCtx: DealFinancialContext | undefined = inputData.financialContext;

      const purchasePrice = inputData.purchasePrice
        || finCtx?.assumptions?.purchasePrice
        || 0;

      const monthlyRent = inputData.monthlyRent
        || (finCtx?.leases?.totalMonthlyIncome ? finCtx.leases.totalMonthlyIncome : undefined)
        || (finCtx?.assumptions?.rentPerUnit && finCtx?.assumptions?.totalUnits
          ? finCtx.assumptions.rentPerUnit * finCtx.assumptions.totalUnits
          : undefined)
        || 0;

      const vacancy = inputData.vacancy
        ?? finCtx?.assumptions?.vacancyRate
        ?? 0.05;

      const interestRate = inputData.interestRate
        ?? (finCtx?.debt?.weightedAvgRate ? finCtx.debt.weightedAvgRate : undefined)
        ?? (finCtx?.assumptions?.interestRate ? finCtx.assumptions.interestRate * 100 : undefined)
        ?? 7.0;

      const downPaymentPercent = inputData.downPaymentPercent
        ?? (finCtx?.assumptions?.ltc ? (1 - finCtx.assumptions.ltc) * 100 : undefined)
        ?? 20;

      const loanTermYears = inputData.loanTermYears || 30;
      const propertyTaxRate = inputData.propertyTaxRate || 1.2;
      const insurance = inputData.insurance || 1200;
      const maintenance = inputData.maintenance || 1000;

      if (!purchasePrice || !monthlyRent) {
        return {
          status: 'incomplete',
          message: 'Missing required data. Please provide purchase price and rent, or upload a P&L and rent roll.',
          missingFields: [
            ...(!purchasePrice ? ['purchasePrice'] : []),
            ...(!monthlyRent ? ['monthlyRent (or upload a rent roll)'] : []),
          ],
          dataSourcesUsed: this.getDataSources(finCtx),
        };
      }

      const downPayment = purchasePrice * (downPaymentPercent / 100);
      const loanAmount = purchasePrice - downPayment;
      const monthlyRate = interestRate / 100 / 12;
      const numPayments = loanTermYears * 12;

      const monthlyMortgage =
        monthlyRate > 0
          ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
            (Math.pow(1 + monthlyRate, numPayments) - 1)
          : loanAmount / numPayments;

      const monthlyPropertyTax = (purchasePrice * (propertyTaxRate / 100)) / 12;
      const monthlyInsurance = insurance / 12;
      const monthlyMaintenance = maintenance / 12;

      const totalMonthlyExpenses =
        monthlyMortgage + monthlyPropertyTax + monthlyInsurance + monthlyMaintenance;

      const adjustedMonthlyRent = monthlyRent * (1 - vacancy);
      const monthlyCashFlow = adjustedMonthlyRent - totalMonthlyExpenses;
      const annualCashFlow = monthlyCashFlow * 12;

      const totalInvestment = downPayment;
      const cashOnCashReturn = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;

      const annualNOI = finCtx?.trailingTwelveNOI || (adjustedMonthlyRent * 12 - (monthlyPropertyTax + monthlyInsurance + monthlyMaintenance) * 12);
      const actualCapRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;

      const annualDebtService = monthlyMortgage * 12;
      const dscr = annualDebtService > 0 ? annualNOI / annualDebtService : 0;

      const result: any = {
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
        capRate: actualCapRate,
        dscr,
        annualNOI,
        opportunityScore: this.calculateOpportunityScore(cashOnCashReturn, monthlyCashFlow, dscr),
        dataSourcesUsed: this.getDataSources(finCtx),
        status: 'success',
      };

      if (finCtx?.trailingTwelveNOI !== null && finCtx?.trailingTwelveNOI !== undefined) {
        result.trailingTwelveActuals = {
          noi: finCtx.trailingTwelveNOI,
          revenue: finCtx.trailingTwelveRevenue,
          expenses: finCtx.trailingTwelveExpenses,
          monthsOfData: finCtx.recentActuals.length,
          avgOccupancy: finCtx.avgOccupancy,
        };
      }

      if (finCtx?.debt && finCtx.debt.items.length > 0) {
        result.existingDebt = {
          totalBalance: finCtx.debt.totalBalance,
          weightedAvgRate: finCtx.debt.weightedAvgRate,
          monthlyService: finCtx.debt.totalMonthlyService,
          nearestMaturity: finCtx.debt.nearestMaturity,
          loanCount: finCtx.debt.items.length,
        };
      }

      if (finCtx?.leases) {
        result.rentRollSummary = {
          occupiedUnits: finCtx.leases.totalUnitsLeased,
          vacantUnits: finCtx.leases.totalUnitsVacant,
          avgRent: finCtx.leases.avgRent,
          totalMonthlyIncome: finCtx.leases.totalMonthlyIncome,
          upcomingExpirations: finCtx.leases.upcomingExpirations,
        };
      }

      return result;
    } catch (error: any) {
      logger.error('Cash flow agent execution failed:', error);
      throw error;
    }
  }

  private getDataSources(finCtx?: DealFinancialContext | null): string[] {
    if (!finCtx) return ['user_input'];
    const sources: string[] = [];
    if (finCtx.dataSources.hasUploadedPnL) sources.push('uploaded_pnl');
    if (finCtx.dataSources.hasUploadedRentRoll) sources.push('uploaded_rent_roll');
    if (finCtx.dataSources.hasUploadedBalanceSheet) sources.push('uploaded_balance_sheet');
    if (finCtx.dataSources.hasUploadedDebt) sources.push('uploaded_debt_schedule');
    if (finCtx.dataSources.hasManualAssumptions) sources.push('manual_assumptions');
    if (sources.length === 0) sources.push('deal_assumptions');
    return sources;
  }

  private calculateOpportunityScore(cashOnCashReturn: number, monthlyCashFlow: number, dscr: number): number {
    let score = 50;

    if (monthlyCashFlow > 0) score += 15;
    if (monthlyCashFlow > 500) score += 5;
    if (monthlyCashFlow > 2000) score += 5;

    if (cashOnCashReturn > 8) score += 10;
    if (cashOnCashReturn > 12) score += 5;
    if (cashOnCashReturn > 15) score += 5;

    if (dscr > 1.25) score += 5;
    if (dscr > 1.5) score += 5;

    if (monthlyCashFlow < 0) score -= 20;
    if (dscr > 0 && dscr < 1.0) score -= 15;

    return Math.min(100, Math.max(0, score));
  }
}
