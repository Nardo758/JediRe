"""
Data validation for GIS pipeline
"""
import logging
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
import numpy as np
from datetime import datetime

from .config import config

logger = logging.getLogger(__name__)


class DataValidator:
    """Validate GIS data before insertion"""
    
    def __init__(self, required_fields: Optional[List[str]] = None, 
                 field_type_mapping: Optional[Dict[str, str]] = None):
        self.required_fields = required_fields or config.required_fields
        self.field_type_mapping = field_type_mapping or config.field_type_mapping
    
    def validate_parcel_record(self, record: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate a single parcel record
        
        Args:
            record: Dictionary containing parcel data
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check required fields
        for field in self.required_fields:
            if field not in record or record[field] is None:
                errors.append(f"Missing required field: {field}")
            elif pd.isna(record[field]):
                errors.append(f"Required field is NaN: {field}")
        
        # Validate field types
        for field, expected_type in self.field_type_mapping.items():
            if field in record and record[field] is not None and not pd.isna(record[field]):
                value = record[field]
                
                try:
                    if expected_type == "str":
                        # Convert to string
                        str(value)
                    elif expected_type == "int":
                        # Try to convert to int
                        int(float(value)) if isinstance(value, (int, float, str)) else int(value)
                    elif expected_type == "float":
                        # Try to convert to float
                        float(value)
                    elif expected_type == "bool":
                        # Try to convert to bool
                        bool(value)
                except (ValueError, TypeError) as e:
                    errors.append(f"Field {field} has invalid type. Expected {expected_type}, got {type(value).__name__}: {value}")
        
        # Validate specific business rules
        self._validate_business_rules(record, errors)
        
        return len(errors) == 0, errors
    
    def _validate_business_rules(self, record: Dict[str, Any], errors: List[str]):
        """Apply business rule validations"""
        
        # Validate APN format (should be non-empty string)
        if "PARCELID" in record and record["PARCELID"]:
            apn = str(record["PARCELID"]).strip()
            if len(apn) == 0:
                errors.append("APN cannot be empty")
            elif len(apn) > 50:
                errors.append(f"APN too long (max 50 chars): {apn}")
        
        # Validate numeric values are positive (or zero)
        numeric_fields = ["LNDVALUE", "TOT_APPR", "IMPR_APPR"]
        for field in numeric_fields:
            if field in record and record[field] is not None and not pd.isna(record[field]):
                try:
                    value = float(record[field])
                    if value < 0:
                        errors.append(f"{field} cannot be negative: {value}")
                except (ValueError, TypeError):
                    pass  # Type validation will catch this
        
        # Validate coordinates if present
        if "coordinates_lat" in record and record["coordinates_lat"] is not None:
            lat = record["coordinates_lat"]
            try:
                lat_val = float(lat)
                if not (-90 <= lat_val <= 90):
                    errors.append(f"Invalid latitude: {lat_val}")
            except (ValueError, TypeError):
                pass
        
        if "coordinates_lon" in record and record["coordinates_lon"] is not None:
            lon = record["coordinates_lon"]
            try:
                lon_val = float(lon)
                if not (-180 <= lon_val <= 180):
                    errors.append(f"Invalid longitude: {lon_val}")
            except (ValueError, TypeError):
                pass
    
    def validate_batch(self, batch: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Validate a batch of records
        
        Args:
            batch: List of parcel records
            
        Returns:
            Tuple of (valid_records, invalid_records_with_errors)
        """
        valid_records = []
        invalid_records = []
        
        for i, record in enumerate(batch):
            is_valid, errors = self.validate_parcel_record(record)
            
            if is_valid:
                valid_records.append(record)
            else:
                invalid_records.append({
                    "record": record,
                    "errors": errors,
                    "index": i
                })
                logger.warning(f"Record {i} invalid: {errors}")
        
        logger.info(f"Batch validation: {len(valid_records)} valid, {len(invalid_records)} invalid")
        return valid_records, invalid_records
    
    def clean_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean and normalize a record
        
        Args:
            record: Raw parcel record
            
        Returns:
            Cleaned record
        """
        cleaned = record.copy()
        
        # Clean string fields
        for field in cleaned:
            if isinstance(cleaned[field], str):
                cleaned[field] = cleaned[field].strip()
                if cleaned[field] == "":
                    cleaned[field] = None
        
        # Convert numeric fields
        numeric_fields = ["LNDVALUE", "TOT_APPR", "IMPR_APPR"]
        for field in numeric_fields:
            if field in cleaned and cleaned[field] is not None:
                try:
                    cleaned[field] = float(cleaned[field])
                except (ValueError, TypeError):
                    cleaned[field] = None
        
        # Ensure APN is string
        if "PARCELID" in cleaned and cleaned["PARCELID"] is not None:
            cleaned["PARCELID"] = str(cleaned["PARCELID"])
        
        return cleaned
    
    def transform_to_database_schema(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw GIS record to database schema
        
        Args:
            record: Raw parcel record from shapefile
            
        Returns:
            Record transformed to database schema
        """
        # Map shapefile fields to database columns
        transformed = {
            "apn": record.get("PARCELID"),
            "address": record.get("SITEADDRESS"),
            "city": record.get("SITECITY"),
            "state": "GA",  # Default for Fulton County
            "zip_code": record.get("SITEZIP"),
            "county": "Fulton",
            
            # Property values
            "land_value": record.get("LNDVALUE"),
            "total_appraised_value": record.get("TOT_APPR"),
            "improvement_value": record.get("IMPR_APPR"),
            
            # Zoning
            "current_zoning": record.get("ZONING1"),
            
            # Owner information
            "owner_name1": record.get("OWNERNME1"),
            "owner_name2": record.get("OWNERNME2"),
            
            # Property classification
            "property_class_code": record.get("CLASSCD"),
            "property_class_description": record.get("CLASSDSCRP"),
            
            # Administrative
            "council_district": record.get("COUNCIL"),
            "npu": record.get("NPU"),
            "neighborhood": record.get("NEIGHBORHOOD"),
            
            # Default values
            "current_units": 0,  # Will need to be populated from other sources
            "lot_size_sqft": None,  # Not in sample data, will need from full dataset
        }
        
        # Extract coordinates from geometry if present
        if "geometry" in record and record["geometry"] is not None:
            try:
                # Get centroid of polygon
                centroid = record["geometry"].centroid
                transformed["coordinates_lat"] = centroid.y
                transformed["coordinates_lon"] = centroid.x
            except Exception as e:
                logger.warning(f"Could not extract coordinates from geometry: {e}")
        
        # Clean None values
        transformed = {k: v for k, v in transformed.items() if v is not None}
        
        return transformed
    
    def get_validation_summary(self, total_records: int, valid_records: int, 
                              invalid_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate validation summary statistics"""
        error_counts = {}
        for invalid in invalid_records:
            for error in invalid["errors"]:
                error_type = error.split(":")[0] if ":" in error else error
                error_counts[error_type] = error_counts.get(error_type, 0) + 1
        
        return {
            "total_records": total_records,
            "valid_records": valid_records,
            "invalid_records": len(invalid_records),
            "validation_rate": valid_records / total_records if total_records > 0 else 0,
            "error_counts": error_counts,
            "top_errors": sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        }