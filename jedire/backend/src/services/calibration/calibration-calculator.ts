/**
 * Calibration Calculator Service
 * Calculates adjustment factors based on forecast accuracy
 */

import { ForecastValidation, CalibrationFactors, CalibrationData } from '../../models/calibration';

export class CalibrationCalculator {
  
  /**
   * Calculate calibration factors from validation data
   */
  calculateFactors(
    moduleId: string,
    validations: ForecastValidation[]
  ): CalibrationData {
    if (validations.length === 0) {
      throw new Error('No validation data provided');
    }

    switch (moduleId) {
      case 'financial':
        return this.calculateFinancialFactors(validations);
      case 'traffic':
        return this.calculateTrafficFactors(validations);
      case 'development':
        return this.calculateDevelopmentFactors(validations);
      default:
        return this.calculateGenericFactors(validations);
    }
  }

  /**
   * Calculate financial module calibration factors
   */
  private calculateFinancialFactors(validations: ForecastValidation[]): CalibrationData {
    const factors: CalibrationData = {};

    // Group by metric
    const noiValidations = validations.filter(v => v.forecast_metric.includes('noi'));
    const rentValidations = validations.filter(v => v.forecast_metric.includes('rent'));
    const occupancyValidations = validations.filter(v => v.forecast_metric.includes('occupancy'));
    const expenseValidations = validations.filter(v => v.forecast_metric.includes('expense'));

    // Calculate NOI factor
    if (noiValidations.length > 0) {
      const avgError = this.averageErrorPercentage(noiValidations);
      // If avg error is -2.5%, that means actual was 2.5% lower than forecast
      // So we need to apply 0.975x to future forecasts
      factors.noi_factor = 1 + (avgError / 100);
    }

    // Calculate rent factor
    if (rentValidations.length > 0) {
      const avgError = this.averageErrorPercentage(rentValidations);
      factors.rent_factor = 1 + (avgError / 100);
    }

    // Calculate occupancy bias (in percentage points, not factor)
    if (occupancyValidations.length > 0) {
      const avgError = this.averageErrorPercentage(occupancyValidations);
      factors.occupancy_bias = avgError; // e.g., -1.5 means forecasts are 1.5% too high
    }

    // Calculate expense bias
    if (expenseValidations.length > 0) {
      const avgError = this.averageErrorPercentage(expenseValidations);
      factors.expense_bias = avgError;
    }

    return factors;
  }

  /**
   * Calculate traffic module calibration factors
   */
  private calculateTrafficFactors(validations: ForecastValidation[]): CalibrationData {
    const factors: CalibrationData = {};

    // Overall traffic factor
    const avgError = this.averageErrorPercentage(validations);
    factors.traffic_factor = 1 + (avgError / 100);

    // Property type specific adjustments
    const propertyTypeAdjustments: Record<string, number> = {};
    
    // Group by property type (if available in deal_context)
    const byPropertyType = new Map<string, ForecastValidation[]>();
    validations.forEach(v => {
      if (v.deal_context?.property_type) {
        const type = v.deal_context.property_type;
        if (!byPropertyType.has(type)) {
          byPropertyType.set(type, []);
        }
        byPropertyType.get(type)!.push(v);
      }
    });

    byPropertyType.forEach((vals, type) => {
      if (vals.length >= 2) { // Need at least 2 examples
        const avgError = this.averageErrorPercentage(vals);
        propertyTypeAdjustments[type] = 1 + (avgError / 100);
      }
    });

    if (Object.keys(propertyTypeAdjustments).length > 0) {
      factors.property_type_adjustments = propertyTypeAdjustments;
    }

    return factors;
  }

  /**
   * Calculate development module calibration factors
   */
  private calculateDevelopmentFactors(validations: ForecastValidation[]): CalibrationData {
    const factors: CalibrationData = {};

    // Cost overrun factor
    const costValidations = validations.filter(v => v.forecast_metric.includes('cost'));
    if (costValidations.length > 0) {
      const avgError = this.averageErrorPercentage(costValidations);
      factors.cost_overrun_factor = 1 + (avgError / 100);
    }

    // Timeline factor (in percentage)
    const timelineValidations = validations.filter(v => v.forecast_metric.includes('timeline') || v.forecast_metric.includes('months'));
    if (timelineValidations.length > 0) {
      const avgError = this.averageErrorPercentage(timelineValidations);
      factors.timeline_factor = 1 + (avgError / 100);
    }

    return factors;
  }

  /**
   * Generic factor calculation
   */
  private calculateGenericFactors(validations: ForecastValidation[]): CalibrationData {
    const avgError = this.averageErrorPercentage(validations);
    return {
      general_factor: 1 + (avgError / 100)
    };
  }

  /**
   * Calculate confidence score based on sample size and consistency
   */
  calculateConfidence(validations: ForecastValidation[]): number {
    const sampleSize = validations.length;
    const stdDev = this.standardDeviation(validations.map(v => v.error_percentage));

    // Confidence based on sample size (0-50 points)
    let sampleConfidence = 0;
    if (sampleSize >= 10) {
      sampleConfidence = 50;
    } else if (sampleSize >= 5) {
      sampleConfidence = 40;
    } else if (sampleSize >= 3) {
      sampleConfidence = 30;
    } else if (sampleSize >= 2) {
      sampleConfidence = 20;
    } else {
      sampleConfidence = 10;
    }

    // Confidence based on consistency (0-50 points)
    let consistencyConfidence = 0;
    if (stdDev <= 5) {
      consistencyConfidence = 50; // Very consistent
    } else if (stdDev <= 10) {
      consistencyConfidence = 40;
    } else if (stdDev <= 15) {
      consistencyConfidence = 30;
    } else if (stdDev <= 20) {
      consistencyConfidence = 20;
    } else {
      consistencyConfidence = 10;
    }

    return Math.min(100, sampleConfidence + consistencyConfidence);
  }

  /**
   * Calculate Mean Absolute Error (MAE)
   */
  calculateMAE(validations: ForecastValidation[]): number {
    if (validations.length === 0) return 0;
    
    const sum = validations.reduce((acc, v) => 
      acc + Math.abs(v.error_percentage), 0
    );
    
    return sum / validations.length;
  }

  /**
   * Calculate Root Mean Square Error (RMSE)
   */
  calculateRMSE(validations: ForecastValidation[]): number {
    if (validations.length === 0) return 0;
    
    const sumSquares = validations.reduce((acc, v) => 
      acc + Math.pow(v.error_percentage, 2), 0
    );
    
    return Math.sqrt(sumSquares / validations.length);
  }

  /**
   * Determine if user is generally optimistic or pessimistic
   */
  determineBias(validations: ForecastValidation[]): 'optimistic' | 'pessimistic' | 'balanced' {
    const avgError = this.averageErrorPercentage(validations);
    
    if (avgError < -5) {
      return 'optimistic'; // Forecasts are too high
    } else if (avgError > 5) {
      return 'pessimistic'; // Forecasts are too low
    } else {
      return 'balanced';
    }
  }

  /**
   * Get recommended adjustment message
   */
  getAdjustmentRecommendation(factors: CalibrationData, moduleId: string): string {
    if (moduleId === 'financial' && factors.noi_factor) {
      const adjustment = ((factors.noi_factor - 1) * 100).toFixed(1);
      if (parseFloat(adjustment) < 0) {
        return `Your NOI forecasts tend to be ${Math.abs(parseFloat(adjustment))}% optimistic. Future forecasts will be adjusted down.`;
      } else if (parseFloat(adjustment) > 0) {
        return `Your NOI forecasts tend to be ${adjustment}% pessimistic. Future forecasts will be adjusted up.`;
      } else {
        return 'Your NOI forecasts are well-calibrated!';
      }
    }

    if (moduleId === 'traffic' && factors.traffic_factor) {
      const adjustment = ((factors.traffic_factor - 1) * 100).toFixed(1);
      if (parseFloat(adjustment) < 0) {
        return `Your properties generate ${Math.abs(parseFloat(adjustment))}% less traffic than forecast. Future forecasts will be adjusted down.`;
      } else if (parseFloat(adjustment) > 0) {
        return `Your properties generate ${adjustment}% more traffic than forecast. Future forecasts will be adjusted up.`;
      } else {
        return 'Your traffic forecasts are well-calibrated!';
      }
    }

    return 'Calibration complete.';
  }

  // Statistical helper methods

  private averageErrorPercentage(validations: ForecastValidation[]): number {
    if (validations.length === 0) return 0;
    
    const sum = validations.reduce((acc, v) => acc + v.error_percentage, 0);
    return sum / validations.length;
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Filter outliers using IQR method
   */
  filterOutliers(validations: ForecastValidation[]): ForecastValidation[] {
    if (validations.length < 4) return validations; // Need enough data

    const errors = validations.map(v => v.error_percentage).sort((a, b) => a - b);
    const q1 = errors[Math.floor(errors.length * 0.25)];
    const q3 = errors[Math.floor(errors.length * 0.75)];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - (1.5 * iqr);
    const upperBound = q3 + (1.5 * iqr);

    return validations.filter(v => 
      v.error_percentage >= lowerBound && v.error_percentage <= upperBound
    );
  }

  /**
   * Check if recalibration is needed
   */
  needsRecalibration(
    lastCalibration: Date,
    newValidationsCount: number
  ): boolean {
    // Recalibrate if:
    // 1. Haven't calibrated in 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (lastCalibration < threeMonthsAgo) {
      return true;
    }

    // 2. Have 5+ new validations since last calibration
    if (newValidationsCount >= 5) {
      return true;
    }

    return false;
  }
}

export const calibrationCalculator = new CalibrationCalculator();
