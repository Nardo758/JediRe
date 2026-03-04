import * as XLSX from 'xlsx';

/**
 * Export data to CSV format and trigger download
 */
export const exportToCSV = (data: any[], filename: string): void => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Convert data to CSV format
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(value => {
      // Escape values that contain commas or quotes
      const stringValue = String(value ?? '');
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  const csv = [headers, ...rows].join('\n');
  
  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Export data to Excel (XLSX) format and trigger download
 */
export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1'): void => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  try {
    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export to Excel');
  }
};

/**
 * Copy data to clipboard in a formatted table structure
 */
export const copyToClipboard = async (data: any[]): Promise<void> => {
  if (!data || data.length === 0) {
    console.warn('No data to copy');
    return;
  }

  try {
    // Format as tab-separated values (TSV) for better paste into spreadsheets
    const headers = Object.keys(data[0]).join('\t');
    const rows = data.map(row => 
      Object.values(row).map(value => String(value ?? '')).join('\t')
    );
    
    const text = [headers, ...rows].join('\n');
    
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    throw new Error('Failed to copy to clipboard');
  }
};

/**
 * Format property data for export
 */
export const formatPropertyDataForExport = (properties: any[]) => {
  return properties.map(prop => ({
    'Address': prop.address || prop.property_address,
    'Units': prop.units || prop.total_units,
    'Owner Name': prop.owner_name || prop.ownerName,
    'Appraised Value': prop.appraised_value || prop.appraisedValue,
    'Price Per Unit': prop.price_per_unit || prop.pricePerUnit,
    'Year Built': prop.year_built || prop.yearBuilt,
    'City': prop.city,
  }));
};

/**
 * Format owner data for export
 */
export const formatOwnerDataForExport = (owners: any[]) => {
  return owners.map(owner => ({
    'Owner Name': owner.owner_name || owner.ownerName,
    'Properties Owned': owner.properties_owned || owner.propertiesOwned,
    'Total Units': owner.total_units || owner.totalUnits,
    'Transactions': owner.transactions,
    'Avg Price Per Unit': owner.avg_price_per_unit || owner.avgPricePerUnit,
  }));
};

/**
 * Format future supply data for export
 */
export const formatFutureSupplyDataForExport = (projects: any[]) => {
  return projects.map(project => ({
    'Project Name': project.project_name || project.projectName,
    'Developer': project.developer,
    'Units': project.units,
    'Phase': project.phase,
    'Expected Date': project.expected_date || project.expectedDate,
  }));
};
