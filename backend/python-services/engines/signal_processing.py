"""
JEDI RE - Signal Processing Engine
Cleans noise from rent data and extracts true market signals
"""
import numpy as np
from scipy.signal import butter, filtfilt
from scipy.fft import fft, fftfreq
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class RentSignal:
    """Cleaned rent signal with confidence metrics"""
    clean_trend: np.ndarray
    confidence: float  # 0-1
    seasonal_component: np.ndarray
    noise_level: float


class SignalProcessor:
    """
    Applies digital signal processing to real estate data
    Removes noise, extracts trends, decomposes seasonality
    """
    
    def __init__(self, sampling_rate: int = 52):
        """
        Args:
            sampling_rate: Data points per year (52 for weekly, 12 for monthly)
        """
        self.sampling_rate = sampling_rate
    
    def kalman_filter_1d(self, data: np.ndarray, process_variance: float = 1e-5, 
                         measurement_variance: float = 0.1) -> np.ndarray:
        """
        1D Kalman filter for time series smoothing
        
        Args:
            data: Raw rent timeseries
            process_variance: How much we expect the true value to change
            measurement_variance: How noisy our measurements are
            
        Returns:
            Smoothed signal
        """
        n = len(data)
        
        # Initialize
        x_est = np.zeros(n)  # Estimated state
        p_est = np.zeros(n)  # Estimation error covariance
        
        # Initial guess
        x_est[0] = data[0]
        p_est[0] = 1.0
        
        for k in range(1, n):
            # Prediction
            x_pred = x_est[k-1]
            p_pred = p_est[k-1] + process_variance
            
            # Update
            kalman_gain = p_pred / (p_pred + measurement_variance)
            x_est[k] = x_pred + kalman_gain * (data[k] - x_pred)
            p_est[k] = (1 - kalman_gain) * p_pred
        
        return x_est
    
    def low_pass_filter(self, data: np.ndarray, cutoff_freq: float = 0.1) -> np.ndarray:
        """
        Butterworth low-pass filter to remove high-frequency noise
        
        Args:
            data: Raw timeseries
            cutoff_freq: Cutoff frequency (0-1, normalized by Nyquist)
            
        Returns:
            Filtered signal
        """
        # Skip filtering if dataset is too small
        if len(data) < 20:
            return data
        
        b, a = butter(N=4, Wn=cutoff_freq, btype='low')
        return filtfilt(b, a, data)
    
    def decompose_seasonal(self, data: np.ndarray, period: int = 52) -> Tuple[np.ndarray, np.ndarray]:
        """
        Decompose signal into trend + seasonal using FFT
        
        Args:
            data: Timeseries data
            period: Seasonal period (52 for annual seasonality in weekly data)
            
        Returns:
            (trend, seasonal_component)
        """
        n = len(data)
        
        # If not enough data for seasonal decomposition, return data as trend with no seasonal
        if n < period // 2:
            return data, np.zeros_like(data)
        
        # FFT decomposition
        fft_vals = fft(data)
        freqs = fftfreq(n, d=1.0)
        
        # Identify seasonal frequency
        seasonal_freq = 1.0 / period
        seasonal_idx = np.argmin(np.abs(freqs - seasonal_freq))
        
        # Extract seasonal component
        seasonal_fft = np.zeros_like(fft_vals)
        seasonal_fft[seasonal_idx] = fft_vals[seasonal_idx]
        seasonal_fft[-seasonal_idx] = fft_vals[-seasonal_idx]
        
        seasonal = np.fft.ifft(seasonal_fft).real
        trend = data - seasonal
        
        return trend, seasonal
    
    def calculate_confidence(self, original: np.ndarray, cleaned: np.ndarray) -> float:
        """
        Calculate confidence in the cleaned signal based on SNR
        
        Args:
            original: Original noisy data
            cleaned: Cleaned signal
            
        Returns:
            Confidence score (0-1)
        """
        noise = original - cleaned
        signal_power = np.mean(cleaned ** 2)
        noise_power = np.mean(noise ** 2)
        
        if noise_power == 0:
            return 1.0
        
        snr = signal_power / noise_power
        
        # Convert SNR to confidence (0-1 scale)
        # SNR > 10 = high confidence, SNR < 1 = low confidence
        confidence = min(1.0, np.log10(snr + 1) / 2.0)
        
        return confidence
    
    def process_rent_signal(self, rent_data: List[float]) -> RentSignal:
        """
        Full pipeline: clean noise, extract trend, decompose seasonality
        
        Args:
            rent_data: List of rent values (weekly or monthly)
            
        Returns:
            RentSignal with cleaned data and metadata
        """
        data = np.array(rent_data)
        
        # Step 1: Kalman filtering
        kalman_smoothed = self.kalman_filter_1d(data)
        
        # Step 2: Low-pass filtering
        low_pass_smoothed = self.low_pass_filter(kalman_smoothed)
        
        # Step 3: Seasonal decomposition
        trend, seasonal = self.decompose_seasonal(low_pass_smoothed)
        
        # Step 4: Calculate confidence
        confidence = self.calculate_confidence(data, low_pass_smoothed)
        
        # Calculate noise level
        noise_level = np.std(data - low_pass_smoothed)
        
        return RentSignal(
            clean_trend=trend,
            confidence=confidence,
            seasonal_component=seasonal,
            noise_level=noise_level
        )
    
    def calculate_growth_rate(self, trend: np.ndarray, periods: int = 52) -> float:
        """
        Calculate annualized growth rate from trend
        
        Args:
            trend: Cleaned trend data
            periods: Number of periods in a year (52 for weekly)
            
        Returns:
            Annualized growth rate (e.g., 0.028 = 2.8%)
        """
        if len(trend) < periods:
            # Not enough data for annual calculation
            periods = len(trend)
        
        start_value = np.mean(trend[:periods//4])  # Average first quarter
        end_value = np.mean(trend[-periods//4:])   # Average last quarter
        
        growth_rate = (end_value - start_value) / start_value
        
        return growth_rate


# Example usage
if __name__ == "__main__":
    # Simulate noisy rent data (weekly rents with trend + noise)
    weeks = 104  # 2 years of data
    time = np.arange(weeks)
    
    # True signal: $2000 base + $100/year growth + seasonal variation
    true_rent = 2000 + (time / 52) * 100 + 50 * np.sin(2 * np.pi * time / 52)
    
    # Add noise
    noise = np.random.normal(0, 30, weeks)
    noisy_rent = true_rent + noise
    
    # Process signal
    processor = SignalProcessor()
    result = processor.process_rent_signal(noisy_rent.tolist())
    
    print(f"Signal Confidence: {result.confidence:.2%}")
    print(f"Noise Level: ${result.noise_level:.2f}")
    
    growth_rate = processor.calculate_growth_rate(result.clean_trend)
    print(f"Annualized Growth Rate: {growth_rate:.2%}")
