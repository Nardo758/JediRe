/**
 * Market Research Export Service
 * Handles CSV, Excel, and clipboard exports
 */

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
}

export class MarketResearchExportService {
  /**
   * Export data to CSV format
   */
  static toCSV(data: any[], columns: ExportColumn[]): string {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Create header row
    const headers = columns.map(col => col.label);
    const headerRow = headers.join(',');

    // Create data rows
    const dataRows = data.map(row => {
      return columns.map(col => {
        let value = row[col.key];
        
        // Apply formatter if provided
        if (col.format && value !== null && value !== undefined) {
          value = col.format(value);
        }

        // Handle null/undefined
        if (value === null || value === undefined) {
          return '';
        }

        // Convert to string and escape
        const stringValue = String(value);
        
        // Escape commas, quotes, and newlines
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
      }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
  }

  /**
   * Download CSV file
   */
  static downloadCSV(data: any[], columns: ExportColumn[], filename: string) {
    const csv = this.toCSV(data, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Copy data to clipboard as tab-separated values (Excel-friendly)
   */
  static async copyToClipboard(data: any[], columns: ExportColumn[]): Promise<void> {
    if (!data || data.length === 0) {
      throw new Error('No data to copy');
    }

    // Create header row
    const headers = columns.map(col => col.label);
    const headerRow = headers.join('\t');

    // Create data rows
    const dataRows = data.map(row => {
      return columns.map(col => {
        let value = row[col.key];
        
        // Apply formatter if provided
        if (col.format && value !== null && value !== undefined) {
          value = col.format(value);
        }

        // Handle null/undefined
        if (value === null || value === undefined) {
          return '';
        }

        return String(value);
      }).join('\t');
    });

    const tsvContent = [headerRow, ...dataRows].join('\n');

    try {
      await navigator.clipboard.writeText(tsvContent);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = tsvContent;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  /**
   * Export to Excel format (basic)
   * Creates a simple HTML table that Excel can open
   */
  static downloadExcel(data: any[], columns: ExportColumn[], filename: string) {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Create HTML table
    const headerRow = columns.map(col => `<th>${col.label}</th>`).join('');
    
    const dataRows = data.map(row => {
      const cells = columns.map(col => {
        let value = row[col.key];
        
        // Apply formatter if provided
        if (col.format && value !== null && value !== undefined) {
          value = col.format(value);
        }

        // Handle null/undefined
        if (value === null || value === undefined) {
          return '<td></td>';
        }

        // For numbers, add data-type attribute to help Excel
        const isNumber = typeof value === 'number';
        const dataType = isNumber ? ' data-type="number"' : '';
        
        return `<td${dataType}>${value}</td>`;
      }).join('');
      
      return `<tr>${cells}</tr>`;
    }).join('');

    const htmlTable = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <thead><tr>${headerRow}</tr></thead>
            <tbody>${dataRows}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xls`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Format currency value
   */
  static formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  /**
   * Format number with commas
   */
  static formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('en-US');
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number | null | undefined, decimals: number = 1): string {
    if (value === null || value === undefined) return '';
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Format date
   */
  static formatDate(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleDateString('en-US');
  }
}

export default MarketResearchExportService;
