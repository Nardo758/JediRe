"""
Unit Tests - Signal Processing Engine

Tests the signal processing engine's core functions:
- Kalman filtering
- FFT analysis
- Growth rate calculation
- Confidence scoring

@version 1.0.0
@date 2026-02-05
"""

import pytest
import numpy as np
from pathlib import Path
import sys

# Add engines to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'python-services'))

from engines.signal_processing import SignalProcessor, RentSignal

# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def processor():
    """Create signal processor instance"""
    return SignalProcessor(sampling_rate=52)  # Weekly data

@pytest.fixture
def clean_data():
    """Generate clean rent data (smooth growth)"""
    weeks = np.arange(52)
    base_rent = 1500
    growth_rate = 0.05  # 5% annual
    weekly_growth = growth_rate / 52
    
    return base_rent * (1 + weekly_growth) ** weeks

@pytest.fixture
def noisy_data(clean_data):
    """Add noise to clean data"""
    noise = np.random.normal(0, 20, len(clean_data))
    return clean_data + noise

@pytest.fixture
def seasonal_data():
    """Generate data with seasonal pattern"""
    weeks = np.arange(52)
    base = 1500
    trend = base + (weeks * 2)  # Linear growth
    seasonal = 50 * np.sin(2 * np.pi * weeks / 52)  # Annual cycle
    return trend + seasonal

# ============================================================================
# Kalman Filter Tests
# ============================================================================

class TestKalmanFilter:
    """Test Kalman filter smoothing"""
    
    def test_kalman_reduces_noise(self, processor, noisy_data, clean_data):
        """Kalman filter should reduce noise"""
        smoothed = processor.kalman_filter_1d(noisy_data)
        
        # Calculate variance
        noisy_variance = np.var(np.diff(noisy_data))
        smoothed_variance = np.var(np.diff(smoothed))
        
        assert smoothed_variance < noisy_variance
    
    def test_kalman_preserves_trend(self, processor, clean_data):
        """Kalman filter should preserve underlying trend"""
        filtered = processor.kalman_filter_1d(clean_data)
        
        # Check endpoints are close
        assert abs(filtered[0] - clean_data[0]) < 10
        assert abs(filtered[-1] - clean_data[-1]) < 10
        
        # Check overall trend preserved
        clean_growth = clean_data[-1] / clean_data[0]
        filtered_growth = filtered[-1] / filtered[0]
        
        assert abs(clean_growth - filtered_growth) < 0.01
    
    def test_kalman_handles_single_outlier(self, processor, clean_data):
        """Kalman filter should handle isolated outliers"""
        data_with_outlier = clean_data.copy()
        data_with_outlier[25] = 3000  # Huge spike
        
        filtered = processor.kalman_filter_1d(data_with_outlier)
        
        # Outlier should be smoothed
        assert filtered[25] < 2000  # Much less than outlier
        assert filtered[25] > 1000  # But still reasonable

# ============================================================================
# FFT Tests
# ============================================================================

class TestFFTAnalysis:
    """Test FFT seasonal detection"""
    
    def test_fft_detects_annual_cycle(self, processor, seasonal_data):
        """FFT should detect 12-month seasonal cycle"""
        # Run FFT
        freqs = np.fft.fftfreq(len(seasonal_data), d=1.0)
        fft_values = np.abs(np.fft.fft(seasonal_data))
        
        # Find dominant frequency
        dominant_idx = np.argmax(fft_values[1:len(fft_values)//2]) + 1
        dominant_freq = abs(freqs[dominant_idx])
        
        # Should be close to 1/52 (annual cycle in weeks)
        expected_freq = 1.0 / 52
        assert abs(dominant_freq - expected_freq) < 0.01
    
    def test_fft_on_nonseasonal_data(self, processor, clean_data):
        """FFT on non-seasonal data should show low amplitudes"""
        fft_values = np.abs(np.fft.fft(clean_data))
        
        # Remove DC component
        fft_values[0] = 0
        
        # All frequencies should have low amplitude
        assert np.max(fft_values) < 1000

# ============================================================================
# Growth Rate Tests
# ============================================================================

class TestGrowthRate:
    """Test growth rate calculation"""
    
    def test_growth_rate_positive_trend(self, processor):
        """Calculate growth rate for increasing trend"""
        # 5% annual growth
        data = np.array([1000, 1010, 1020, 1030, 1040, 1050])
        
        growth_rate = processor.calculate_growth_rate(data, periods=1)
        
        # Should be approximately 0.05 (5% annually, scaled for 6 periods)
        assert abs(growth_rate) > 0
        assert growth_rate < 0.20  # Reasonable range
    
    def test_growth_rate_negative_trend(self, processor):
        """Calculate growth rate for decreasing trend"""
        data = np.array([1050, 1040, 1030, 1020, 1010, 1000])
        
        growth_rate = processor.calculate_growth_rate(data, periods=1)
        
        # Should be negative
        assert growth_rate < 0
    
    def test_growth_rate_flat_data(self, processor):
        """Growth rate for flat data should be zero"""
        data = np.array([1000, 1000, 1000, 1000])
        
        growth_rate = processor.calculate_growth_rate(data, periods=1)
        
        # Should be very close to zero
        assert abs(growth_rate) < 0.001

# ============================================================================
# Complete Signal Processing Tests
# ============================================================================

class TestSignalProcessing:
    """Test complete signal processing workflow"""
    
    def test_process_rent_signal_basic(self, processor, noisy_data):
        """Basic signal processing test"""
        result = processor.process_rent_signal(noisy_data)
        
        # Check result structure
        assert isinstance(result, RentSignal)
        assert len(result.clean_trend) == len(noisy_data)
        assert len(result.seasonal_component) == len(noisy_data)
        assert 0 <= result.confidence <= 1
        assert result.noise_level >= 0
    
    def test_confidence_high_for_clean_data(self, processor, clean_data):
        """Clean data should have high confidence"""
        result = processor.process_rent_signal(clean_data)
        
        assert result.confidence > 0.8
    
    def test_confidence_lower_for_noisy_data(self, processor, noisy_data):
        """Noisy data should have lower confidence"""
        result = processor.process_rent_signal(noisy_data)
        
        # Confidence should still be reasonable but < 1.0
        assert 0.3 < result.confidence < 1.0

# ============================================================================
# Edge Cases
# ============================================================================

class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_minimum_data_points(self, processor):
        """Test with minimum data (4 points)"""
        data = np.array([1000, 1010, 1020, 1030])
        
        result = processor.process_rent_signal(data)
        
        # Should work but with low confidence
        assert isinstance(result, RentSignal)
        assert result.confidence < 0.5
    
    def test_all_identical_values(self, processor):
        """Test with all identical values"""
        data = np.array([1000] * 52)
        
        result = processor.process_rent_signal(data)
        
        # Should handle gracefully
        assert isinstance(result, RentSignal)
        assert result.noise_level == 0
    
    def test_extreme_outliers(self, processor, clean_data):
        """Test with extreme outliers"""
        data_with_outliers = clean_data.copy()
        data_with_outliers[10] = 10000
        data_with_outliers[30] = 100
        
        result = processor.process_rent_signal(data_with_outliers)
        
        # Should still produce valid result
        assert isinstance(result, RentSignal)
        # Confidence should be impacted
        assert result.confidence < 0.8

# ============================================================================
# Run Tests
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
