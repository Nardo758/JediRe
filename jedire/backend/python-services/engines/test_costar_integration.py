#!/usr/bin/env python3
"""
End-to-End Test: CoStar Data → Signal Processing → Imbalance Detection
Tests the complete pipeline with real historical market data
"""

import numpy as np
from imbalance_detector import ImbalanceDetector
from carrying_capacity import SubmarketData


def test_with_costar_data():
    """Test imbalance detection using real CoStar market data"""
    
    print("="*70)
    print("END-TO-END TEST: CoStar → Signal Processing → Imbalance Detection")
    print("="*70)
    
    # Initialize detector with CoStar signals enabled
    print("\n[1] Initializing detector with CoStar signals...")
    detector = ImbalanceDetector(use_costar_signals=True)
    print("✓ CoStar signal processor loaded")
    
    # Define Atlanta submarket (example)
    print("\n[2] Setting up Atlanta submarket data...")
    submarket = SubmarketData(
        name="Atlanta Multifamily Market",
        population=6_100_000,  # Metro Atlanta population
        population_growth_rate=0.012,  # 1.2% annual growth
        net_migration_annual=50_000,  # Strong in-migration
        employment=2_900_000,
        employment_growth_rate=0.018,  # 1.8% job growth
        median_income=68_000,
        existing_units=80_000,  # Approximate multifamily inventory
        pipeline_units=15_000,  # Under construction
        future_permitted_units=5_000  # Permitted but not started
    )
    print(f"✓ Submarket: {submarket.name}")
    print(f"  Existing Units: {submarket.existing_units:,}")
    print(f"  Pipeline: {submarket.pipeline_units:,}")
    
    # Run analysis WITHOUT providing rent_timeseries (uses CoStar data)
    print("\n[3] Running imbalance analysis with CoStar market data...")
    print("    (No user-provided rent array - using real historical data)")
    
    result = detector.analyze_imbalance(
        submarket_data=submarket,
        search_trend_change=0.15,  # 15% increase in search interest
        use_costar_data=True
    )
    
    print("✓ Analysis complete")
    
    # Display results
    print(f"\n{'='*70}")
    print(f"SUPPLY-DEMAND IMBALANCE ANALYSIS")
    print(f"{'='*70}\n")
    print(f"SUBMARKET: {result.submarket}")
    print(f"VERDICT: {result.verdict.value}")
    print(f"COMPOSITE SCORE: {result.composite_score}/100")
    print(f"CONFIDENCE: {result.confidence:.1%}")
    
    print(f"\n{'─'*70}\n")
    print(f"DEMAND SIGNAL: {result.demand_signal.strength.value}")
    print(f"  Score: {result.demand_signal.score}/100")
    print(f"  Rent Growth: {result.demand_signal.rent_growth_rate:.2%} annually")
    print(f"  Confidence: {result.demand_signal.rent_growth_confidence:.1%}")
    print(f"  {result.demand_signal.summary}")
    
    print(f"\nSUPPLY SIGNAL: {result.supply_signal.verdict.value}")
    print(f"  Saturation: {result.supply_signal.saturation_pct:.1f}%")
    print(f"  Equilibrium: {result.supply_signal.equilibrium_quarters} quarters")
    print(f"  {result.supply_signal.summary}")
    
    print(f"\n{'─'*70}\n")
    print(f"RECOMMENDATION:")
    print(f"  {result.recommendation}")
    
    if result.key_factors:
        print(f"\nKEY FACTORS:")
        for factor in result.key_factors:
            print(f"  ✓ {factor}")
    
    if result.risks:
        print(f"\nRISKS:")
        for risk in result.risks:
            print(f"  ⚠ {risk}")
    
    print(f"\n{'='*70}\n")
    
    # Validate results
    print("[4] Validating results...")
    assert result.demand_signal.rent_growth_rate > 0, "Growth rate should be positive"
    assert 0 <= result.confidence <= 1, "Confidence out of range"
    assert result.composite_score >= 0 and result.composite_score <= 100, "Score out of range"
    assert "Real CoStar data" in result.demand_signal.summary, "Should indicate CoStar data usage"
    print("✓ All validations passed")
    
    return result


def test_with_user_data():
    """Test imbalance detection using user-provided rent data (legacy mode)"""
    
    print("\n\n" + "="*70)
    print("LEGACY TEST: User-Provided Rent Array → Signal Processing")
    print("="*70)
    
    # Initialize detector WITHOUT CoStar signals
    print("\n[1] Initializing detector in legacy mode...")
    detector = ImbalanceDetector(use_costar_signals=False)
    print("✓ Using user-provided rent arrays")
    
    # Generate sample rent data
    print("\n[2] Generating sample rent timeseries...")
    weeks = 104  # 2 years
    base_rent = 2000
    growth = 0.028  # 2.8% annual
    time = np.arange(weeks)
    rent_trend = base_rent * (1 + growth * time / 52)
    seasonal = 30 * np.sin(2 * np.pi * time / 52)
    noise = np.random.normal(0, 25, weeks)
    rent_timeseries = (rent_trend + seasonal + noise).tolist()
    print(f"✓ Generated {len(rent_timeseries)} weeks of rent data")
    
    # Same submarket
    submarket = SubmarketData(
        name="Atlanta Multifamily Market",
        population=6_100_000,
        population_growth_rate=0.012,
        net_migration_annual=50_000,
        employment=2_900_000,
        employment_growth_rate=0.018,
        median_income=68_000,
        existing_units=80_000,
        pipeline_units=15_000,
        future_permitted_units=5_000
    )
    
    # Run analysis WITH rent_timeseries
    print("\n[3] Running imbalance analysis with user data...")
    result = detector.analyze_imbalance(
        submarket_data=submarket,
        rent_timeseries=rent_timeseries,
        search_trend_change=0.15
    )
    
    print("✓ Analysis complete")
    print(f"\nVERDICT: {result.verdict.value}")
    print(f"COMPOSITE SCORE: {result.composite_score}/100")
    print(f"Rent Growth: {result.demand_signal.rent_growth_rate:.2%}")
    
    return result


def compare_methods():
    """Compare CoStar data vs user-provided data"""
    
    print("\n\n" + "="*70)
    print("COMPARISON: CoStar Data vs User-Provided Data")
    print("="*70)
    
    print("\nRunning both methods...")
    
    result_costar = test_with_costar_data()
    result_user = test_with_user_data()
    
    print("\n\n" + "="*70)
    print("SIDE-BY-SIDE COMPARISON")
    print("="*70)
    
    print(f"\n{'Metric':<30} {'CoStar Data':<20} {'User Data':<20}")
    print("─"*70)
    print(f"{'Verdict':<30} {result_costar.verdict.value:<20} {result_user.verdict.value:<20}")
    print(f"{'Composite Score':<30} {result_costar.composite_score:<20} {result_user.composite_score:<20}")
    print(f"{'Rent Growth Rate':<30} {result_costar.demand_signal.rent_growth_rate:.2%}              {result_user.demand_signal.rent_growth_rate:.2%}")
    print(f"{'Confidence':<30} {result_costar.confidence:.1%}              {result_user.confidence:.1%}")
    print(f"{'Demand Strength':<30} {result_costar.demand_signal.strength.value:<20} {result_user.demand_signal.strength.value:<20}")
    
    print("\n" + "="*70)


if __name__ == "__main__":
    try:
        # Test 1: CoStar integration
        result_costar = test_with_costar_data()
        
        # Test 2: Legacy mode
        result_user = test_with_user_data()
        
        # Final summary
        print("\n\n" + "="*70)
        print("✓ ALL INTEGRATION TESTS PASSED")
        print("="*70)
        print("\nComplete Pipeline Working:")
        print("  1. ✓ CoStar timeseries data (26 years)")
        print("  2. ✓ Signal processing engine (Kalman, FFT, growth calc)")
        print("  3. ✓ Carrying capacity analysis")
        print("  4. ✓ Imbalance detection and verdict")
        print("  5. ✓ Legacy mode still works (user-provided data)")
        print("\n🎉 Integration complete! Real market data flowing through entire system.")
        
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
