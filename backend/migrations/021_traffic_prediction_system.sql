-- ============================================================
-- JEDI RE Traffic Prediction System
-- Property-Level Foot Traffic Predictions with Validation
-- 
-- Integrates with Market Research Engine V2
-- Converts market-level demand to property-level traffic
-- ============================================================

-- ===== TRAFFIC PREDICTIONS TABLE =====
CREATE TABLE IF NOT EXISTS traffic_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    
    prediction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    prediction_week INT NOT NULL,  -- Week number of year (1-52)
    prediction_year INT NOT NULL,
    
    -- Prediction Outputs
    weekly_walk_ins INT NOT NULL,
    daily_average INT,
    peak_hour_estimate INT,
    
    -- Component Breakdown
    physical_traffic_component INT,
    demand_traffic_component INT,
    supply_demand_multiplier DECIMAL(5,2),
    base_before_adjustment INT,
    
    -- Temporal Patterns
    weekday_avg INT,
    weekend_avg INT,
    weekday_total INT,
    weekend_total INT,
    peak_day VARCHAR(20),
    peak_hour VARCHAR(30),
    
    -- Confidence
    confidence_score DECIMAL(4,2) CHECK (confidence_score BETWEEN 0 AND 1),
    confidence_tier VARCHAR(10) CHECK (confidence_tier IN ('High', 'Medium', 'Low')),
    confidence_breakdown JSONB,  -- Detailed confidence components
    
    -- Market Context
    submarket_id VARCHAR(100),
    market_research_report_id UUID REFERENCES market_research_reports(id),
    foot_traffic_index INT,
    supply_demand_ratio DECIMAL(5,2),
    
    -- Model Metadata
    model_version VARCHAR(50) NOT NULL,
    calibration_factors_applied JSONB,
    
    -- Full Breakdown (for analysis)
    prediction_details JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(property_id, prediction_week, prediction_year)
);

CREATE INDEX idx_predictions_property_week ON traffic_predictions(property_id, prediction_week, prediction_year);
CREATE INDEX idx_predictions_deal ON traffic_predictions(deal_id);
CREATE INDEX idx_predictions_date ON traffic_predictions(prediction_date DESC);
CREATE INDEX idx_predictions_confidence ON traffic_predictions(confidence_score DESC);
CREATE INDEX idx_predictions_model ON traffic_predictions(model_version);

-- ===== ACTUAL TRAFFIC MEASUREMENTS TABLE =====
CREATE TABLE IF NOT EXISTS property_traffic_actual (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    measurement_date DATE NOT NULL,
    measurement_week INT NOT NULL,
    measurement_year INT NOT NULL,
    
    -- Actual Measurements
    total_walk_ins INT NOT NULL,
    weekday_average INT,
    weekend_average INT,
    peak_hour_count INT,
    peak_day VARCHAR(20),
    
    -- Breakdown by Source (if measurable)
    street_walk_ins INT,
    parking_walk_ins INT,
    transit_walk_ins INT,
    delivery_walk_ins INT,
    
    -- Measurement Method
    measurement_method VARCHAR(50) NOT NULL,  
    -- Options: 'manual_count', 'camera_ai', 'wifi_tracking', 'pos_reverse', 'hybrid'
    measurement_hours DECIMAL(5,1),  -- How many hours were measured
    extrapolation_factor DECIMAL(5,2),  -- If extrapolated from partial coverage
    measurement_confidence DECIMAL(4,2) CHECK (measurement_confidence BETWEEN 0 AND 1),
    
    -- Environmental Context
    weather VARCHAR(50),
    temperature_f INT,
    precipitation_inches DECIMAL(4,2),
    wind_speed_mph INT,
    
    -- Event Context
    special_events TEXT[],  -- Array of events during this period
    unusual_circumstances TEXT,
    holiday BOOLEAN DEFAULT FALSE,
    
    -- Equipment Details
    camera_locations TEXT[],
    counter_names TEXT[],
    measurement_equipment JSONB,
    
    -- Quality Assurance
    validated_by VARCHAR(100),
    validation_notes TEXT,
    qa_passed BOOLEAN DEFAULT TRUE,
    
    -- Raw Data Reference
    raw_data_location VARCHAR(500),  -- S3 path or file location
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(property_id, measurement_week, measurement_year)
);

CREATE INDEX idx_actual_property_week ON property_traffic_actual(property_id, measurement_week, measurement_year);
CREATE INDEX idx_actual_date ON property_traffic_actual(measurement_date DESC);
CREATE INDEX idx_actual_method ON property_traffic_actual(measurement_method);
CREATE INDEX idx_actual_confidence ON property_traffic_actual(measurement_confidence DESC);

-- ===== VALIDATION RESULTS TABLE =====
CREATE TABLE IF NOT EXISTS validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    week INT NOT NULL,
    year INT NOT NULL,
    
    -- Comparison
    predicted_walkins INT NOT NULL,
    actual_walkins INT NOT NULL,
    absolute_error INT NOT NULL,
    percentage_error DECIMAL(6,2) NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('over', 'under', 'exact')),
    
    -- Error Metrics
    squared_error BIGINT,  -- For RMSE calculation
    absolute_percentage_error DECIMAL(6,2),  -- For MAPE
    
    -- Confidence Scores
    prediction_confidence DECIMAL(4,2),
    measurement_confidence DECIMAL(4,2),
    combined_confidence DECIMAL(4,2),  -- Min of both
    
    -- Context
    property_type VARCHAR(50),
    property_subtype VARCHAR(50),
    submarket_id VARCHAR(100),
    model_version VARCHAR(50),
    
    -- Environmental Factors
    weather VARCHAR(50),
    special_events TEXT[],
    holiday BOOLEAN,
    
    -- Analysis Flags
    is_outlier BOOLEAN DEFAULT FALSE,
    outlier_reason TEXT,
    outlier_score DECIMAL(5,2),  -- Z-score or similar
    
    -- Investigation
    investigated BOOLEAN DEFAULT FALSE,
    investigation_notes TEXT,
    root_cause TEXT,
    
    -- References
    prediction_id UUID REFERENCES traffic_predictions(id),
    measurement_id UUID REFERENCES property_traffic_actual(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_validation_property ON validation_results(property_id);
CREATE INDEX idx_validation_week ON validation_results(week, year);
CREATE INDEX idx_validation_error ON validation_results(percentage_error);
CREATE INDEX idx_validation_outlier ON validation_results(is_outlier);
CREATE INDEX idx_validation_model ON validation_results(model_version);

-- ===== MODEL VERSIONS TABLE =====
CREATE TABLE IF NOT EXISTS traffic_model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) UNIQUE NOT NULL,
    
    -- Performance Metrics
    mape DECIMAL(6,4),  -- Mean Absolute Percentage Error
    rmse DECIMAL(10,2),  -- Root Mean Square Error
    mae DECIMAL(10,2),   -- Mean Absolute Error
    r_squared DECIMAL(6,4),
    median_error DECIMAL(6,2),
    
    -- Performance by Category
    accuracy_by_property_type JSONB,
    accuracy_by_submarket JSONB,
    accuracy_by_confidence_tier JSONB,
    
    -- Training Metadata
    training_samples INT NOT NULL,
    training_start_date DATE,
    training_end_date DATE,
    training_duration_seconds INT,
    
    -- Model Configuration
    algorithm VARCHAR(50) NOT NULL,
    hyperparameters JSONB,
    feature_importance JSONB,
    features_used TEXT[],
    
    -- Deployment
    deployed_to_production BOOLEAN DEFAULT FALSE,
    deployment_date TIMESTAMP WITH TIME ZONE,
    replaced_version VARCHAR(50),
    
    -- Validation
    cross_validation_scores JSONB,
    test_set_size INT,
    test_set_mape DECIMAL(6,4),
    
    -- Model Files
    model_file_path VARCHAR(500),
    model_size_mb DECIMAL(8,2),
    
    -- Documentation
    description TEXT,
    training_notes TEXT,
    changelog TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE INDEX idx_model_version ON traffic_model_versions(version);
CREATE INDEX idx_model_deployed ON traffic_model_versions(deployed_to_production);
CREATE INDEX idx_model_mape ON traffic_model_versions(mape);

-- ===== ERROR PATTERNS TABLE =====
CREATE TABLE IF NOT EXISTS traffic_error_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    pattern_type VARCHAR(50) NOT NULL,  
    -- Options: 'property_type', 'submarket', 'weather', 'season', 'day_of_week', 'model_version'
    pattern_value VARCHAR(100) NOT NULL,
    pattern_subvalue VARCHAR(100),  -- For compound patterns
    
    -- Error Statistics
    sample_size INT NOT NULL,
    avg_percentage_error DECIMAL(6,2),
    median_percentage_error DECIMAL(6,2),
    stddev_percentage_error DECIMAL(6,2),
    
    -- Direction Bias
    over_predictions INT,
    under_predictions INT,
    direction_bias VARCHAR(10),  -- 'over', 'under', or 'balanced'
    
    -- Adjustment Recommendation
    recommended_multiplier DECIMAL(6,4),
    confidence_in_adjustment DECIMAL(4,2),
    
    -- Application
    adjustment_applied BOOLEAN DEFAULT FALSE,
    adjustment_date TIMESTAMP WITH TIME ZONE,
    adjustment_result TEXT,  -- Did it improve accuracy?
    
    -- Time Period Analyzed
    analysis_start_date DATE NOT NULL,
    analysis_end_date DATE NOT NULL,
    weeks_analyzed INT,
    
    -- Metadata
    discovered_by VARCHAR(20),  -- 'automated' or 'manual'
    discovery_method TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_error_patterns_type ON traffic_error_patterns(pattern_type, pattern_value);
CREATE INDEX idx_error_patterns_applied ON traffic_error_patterns(adjustment_applied);

-- ===== CALIBRATION FACTORS TABLE =====
CREATE TABLE IF NOT EXISTS traffic_calibration_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    factor_type VARCHAR(50) NOT NULL,  
    -- Options: 'global', 'property_type', 'submarket', 'weather', 'season', 'dow', 'model_correction'
    factor_key VARCHAR(100) NOT NULL,
    
    -- Factor Value
    multiplier DECIMAL(6,4) NOT NULL DEFAULT 1.0,
    additive_adjustment INT DEFAULT 0,  -- For absolute adjustments
    
    -- Applicability Rules
    applies_to_property_types TEXT[],
    applies_to_submarkets TEXT[],
    applies_to_conditions JSONB,  -- Complex rules
    
    -- Metadata
    reason TEXT NOT NULL,
    supporting_data JSONB,
    
    -- Lifecycle
    applied_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_start_date DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Validation
    improvement_observed DECIMAL(6,2),  -- % improvement in MAPE after applying
    validation_sample_size INT,
    validation_date DATE,
    
    -- Supersession
    supersedes_factor_id UUID REFERENCES traffic_calibration_factors(id),
    superseded_by_factor_id UUID REFERENCES traffic_calibration_factors(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE INDEX idx_calibration_type_key ON traffic_calibration_factors(factor_type, factor_key);
CREATE INDEX idx_calibration_active ON traffic_calibration_factors(is_active);

-- ===== VALIDATION PROPERTIES TABLE =====
CREATE TABLE IF NOT EXISTS validation_properties (
    property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Validation Configuration
    validation_start_date DATE NOT NULL,
    validation_end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Measurement Setup
    measurement_method VARCHAR(50) NOT NULL,
    measurement_frequency VARCHAR(20),  -- 'continuous', 'daily', 'weekly'
    measurement_equipment JSONB,
    
    -- Property Classification
    archetype VARCHAR(50),  -- 'high_traffic_corner', 'mid_block_retail', etc.
    use_for_training BOOLEAN DEFAULT TRUE,
    
    -- Quality Metrics
    total_weeks_measured INT DEFAULT 0,
    avg_measurement_confidence DECIMAL(4,2),
    data_quality_score DECIMAL(4,2),
    
    -- Personnel
    measurement_coordinator VARCHAR(100),
    contact_email VARCHAR(255),
    
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_validation_active ON validation_properties(is_active);
CREATE INDEX idx_validation_archetype ON validation_properties(archetype);

-- ===== VIEWS =====

-- Latest predictions per property
CREATE OR REPLACE VIEW latest_traffic_predictions AS
SELECT DISTINCT ON (property_id)
    property_id,
    weekly_walk_ins,
    daily_average,
    confidence_score,
    confidence_tier,
    prediction_date,
    model_version,
    submarket_id
FROM traffic_predictions
ORDER BY property_id, prediction_date DESC;

-- Validation summary by property
CREATE OR REPLACE VIEW property_validation_summary AS
SELECT 
    vr.property_id,
    p.property_name,
    p.address,
    COUNT(*) as validation_count,
    ROUND(AVG(vr.percentage_error), 2) as avg_error_pct,
    ROUND(MIN(vr.percentage_error), 2) as best_error_pct,
    ROUND(MAX(vr.percentage_error), 2) as worst_error_pct,
    ROUND(STDDEV(vr.percentage_error), 2) as error_stddev,
    ROUND(AVG(vr.prediction_confidence), 2) as avg_confidence,
    SUM(CASE WHEN vr.is_outlier THEN 1 ELSE 0 END) as outlier_count
FROM validation_results vr
JOIN properties p ON vr.property_id = p.id
WHERE vr.is_outlier = FALSE
GROUP BY vr.property_id, p.property_name, p.address;

-- Model performance over time
CREATE OR REPLACE VIEW model_performance_timeline AS
SELECT 
    vr.model_version,
    DATE_TRUNC('month', vr.created_at) as month,
    COUNT(*) as prediction_count,
    ROUND(AVG(vr.percentage_error), 2) as avg_monthly_error,
    ROUND(STDDEV(vr.percentage_error), 2) as error_stddev,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vr.percentage_error), 2) as median_error,
    SUM(CASE WHEN vr.direction = 'over' THEN 1 ELSE 0 END) as over_predictions,
    SUM(CASE WHEN vr.direction = 'under' THEN 1 ELSE 0 END) as under_predictions
FROM validation_results vr
WHERE vr.is_outlier = FALSE
GROUP BY vr.model_version, DATE_TRUNC('month', vr.created_at)
ORDER BY month DESC;

-- Current calibration factors
CREATE OR REPLACE VIEW active_calibration_factors AS
SELECT 
    factor_type,
    factor_key,
    multiplier,
    reason,
    applied_date,
    improvement_observed
FROM traffic_calibration_factors
WHERE is_active = TRUE
AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
ORDER BY factor_type, factor_key;

-- Property traffic intelligence (combines predictions + actuals)
CREATE OR REPLACE VIEW property_traffic_intelligence AS
SELECT 
    p.id as property_id,
    p.property_name,
    p.address,
    p.city,
    p.state,
    
    -- Latest prediction
    ltp.weekly_walk_ins as predicted_weekly_walkins,
    ltp.daily_average as predicted_daily_avg,
    ltp.confidence_score as prediction_confidence,
    ltp.prediction_date as last_prediction_date,
    
    -- Latest actual (if available)
    lta.total_walk_ins as actual_weekly_walkins,
    lta.measurement_date as last_measurement_date,
    lta.measurement_confidence,
    
    -- Validation status
    CASE 
        WHEN lta.id IS NOT NULL THEN 'Validated'
        ELSE 'Prediction Only'
    END as data_status,
    
    -- Accuracy (if validated)
    CASE 
        WHEN lta.id IS NOT NULL THEN 
            ABS(ltp.weekly_walk_ins - lta.total_walk_ins)
        ELSE NULL
    END as latest_error,
    
    CASE 
        WHEN lta.id IS NOT NULL AND lta.total_walk_ins > 0 THEN 
            ROUND(ABS(ltp.weekly_walk_ins - lta.total_walk_ins)::DECIMAL / lta.total_walk_ins * 100, 2)
        ELSE NULL
    END as latest_error_pct,
    
    -- Historical performance
    pvs.validation_count,
    pvs.avg_error_pct as historical_avg_error
    
FROM properties p
LEFT JOIN latest_traffic_predictions ltp ON p.id = ltp.property_id
LEFT JOIN LATERAL (
    SELECT * FROM property_traffic_actual pta
    WHERE pta.property_id = p.id
    ORDER BY pta.measurement_date DESC
    LIMIT 1
) lta ON TRUE
LEFT JOIN property_validation_summary pvs ON p.id = pvs.property_id;

COMMENT ON TABLE traffic_predictions IS 'Property-level foot traffic predictions with detailed breakdowns';
COMMENT ON TABLE property_traffic_actual IS 'Actual measured traffic from validation properties';
COMMENT ON TABLE validation_results IS 'Comparison of predictions vs actuals for model improvement';
COMMENT ON TABLE traffic_model_versions IS 'ML model versions and performance metrics';
COMMENT ON TABLE traffic_error_patterns IS 'Systematic bias patterns detected in predictions';
COMMENT ON TABLE traffic_calibration_factors IS 'Adjustment factors to improve prediction accuracy';
COMMENT ON TABLE validation_properties IS 'Properties configured for traffic measurement and validation';
