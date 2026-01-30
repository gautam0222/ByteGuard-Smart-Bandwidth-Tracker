/**
 * Export/Import Manager
 * Handles data backup, export, and import functionality
 */

export class ExportImportManager {
  
  /**
   * Export all usage data to JSON
   */
  static async exportToJSON() {
    try {
      const data = await chrome.storage.local.get(null);
      
      // Prepare export data
      const exportData = {
        version: '0.4.0',
        exportDate: new Date().toISOString(),
        settings: data.settings || {},
        usage: data.usage || {},
        lowDataMode: data.lowDataMode || false,
        blockedDomains: data.blockedDomains || [],
        autoLowData: data.autoLowData !== false
      };
      
      // Create downloadable JSON file
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Trigger download
      const filename = `bandwidth-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });
      
      console.log('✅ Data exported successfully');
      return { success: true, filename };
      
    } catch (error) {
      console.error('❌ Export error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Export usage history to CSV
   */
  static async exportToCSV() {
    try {
      const data = await chrome.storage.local.get('usage');
      const usage = data.usage || {};
      
      // Create CSV header
      let csv = 'Date,Total Usage (MB),Top Domain,Top Domain Usage (MB)\n';
      
      // Add history data
      if (usage.history && usage.history.length > 0) {
        usage.history.forEach(day => {
          const date = day.date;
          const totalMB = (day.total / (1024 * 1024)).toFixed(2);
          
          // Find top domain for this day
          const domains = day.domains || {};
          const topDomain = Object.entries(domains)
            .sort(([, a], [, b]) => b - a)[0];
          
          const topDomainName = topDomain ? topDomain[0] : 'N/A';
          const topDomainMB = topDomain ? (topDomain[1] / (1024 * 1024)).toFixed(2) : '0';
          
          csv += `${date},${totalMB},${topDomainName},${topDomainMB}\n`;
        });
      }
      
      // Add current day
      const today = new Date().toISOString().split('T')[0];
      const todayMB = (usage.totalToday / (1024 * 1024)).toFixed(2);
      const todayDomains = usage.domains || {};
      const todayTopDomain = Object.entries(todayDomains)
        .sort(([, a], [, b]) => b - a)[0];
      const todayTopName = todayTopDomain ? todayTopDomain[0] : 'N/A';
      const todayTopMB = todayTopDomain ? (todayTopDomain[1] / (1024 * 1024)).toFixed(2) : '0';
      
      csv += `${today},${todayMB},${todayTopName},${todayTopMB}\n`;
      
      // Create downloadable CSV
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const filename = `bandwidth-usage-${new Date().toISOString().split('T')[0]}.csv`;
      
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });
      
      console.log('✅ CSV exported successfully');
      return { success: true, filename };
      
    } catch (error) {
      console.error('❌ CSV export error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import data from JSON backup
   */
  static async importFromJSON(jsonString) {
    try {
      const importData = JSON.parse(jsonString);
      
      // Validate data structure
      if (!importData.version || !importData.exportDate) {
        throw new Error('Invalid backup file format');
      }
      
      // Import settings
      if (importData.settings) {
        await chrome.storage.local.set({ settings: importData.settings });
      }
      
      // Import usage data
      if (importData.usage) {
        await chrome.storage.local.set({ usage: importData.usage });
      }
      
      // Import preferences
      if (importData.lowDataMode !== undefined) {
        await chrome.storage.local.set({ lowDataMode: importData.lowDataMode });
      }
      
      if (importData.blockedDomains) {
        await chrome.storage.local.set({ blockedDomains: importData.blockedDomains });
      }
      
      if (importData.autoLowData !== undefined) {
        await chrome.storage.local.set({ autoLowData: importData.autoLowData });
      }
      
      console.log('✅ Data imported successfully');
      return { success: true, imported: importData };
      
    } catch (error) {
      console.error('❌ Import error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Generate weekly summary report
   */
  static async generateWeeklySummary() {
    try {
      const data = await chrome.storage.local.get(['usage', 'settings']);
      const usage = data.usage || {};
      const settings = data.settings || {};
      
      // Get last 7 days of data
      const last7Days = usage.history ? usage.history.slice(-7) : [];
      
      // Calculate statistics
      const totalUsage = last7Days.reduce((sum, day) => sum + day.total, 0);
      const avgDaily = totalUsage / 7;
      const maxDay = last7Days.reduce((max, day) => day.total > max.total ? day : max, { total: 0 });
      const minDay = last7Days.reduce((min, day) => day.total < min.total ? day : min, { total: Infinity });
      
      // Find most used domains
      const allDomains = {};
      last7Days.forEach(day => {
        const domains = day.domains || {};
        Object.entries(domains).forEach(([domain, bytes]) => {
          allDomains[domain] = (allDomains[domain] || 0) + bytes;
        });
      });
      
      const topDomains = Object.entries(allDomains)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      
      // Create HTML report
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Weekly Usage Summary</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              padding: 40px; 
              background: #f5f7fa;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { 
              color: #667eea; 
              border-bottom: 3px solid #667eea;
              padding-bottom: 10px;
            }
            .stat { 
              background: white; 
              padding: 20px; 
              margin: 15px 0; 
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .stat-label { 
              color: #6b7280; 
              font-size: 14px; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .stat-value { 
              font-size: 32px; 
              font-weight: bold; 
              color: #1f2937;
              margin-top: 5px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
            }
            th, td { 
              padding: 15px; 
              text-align: left; 
            }
            th { 
              background: #667eea; 
              color: white; 
              font-weight: 600;
            }
            tr:nth-child(even) { 
              background: #f9fafb; 
            }
            .footer {
              text-align: center;
              color: #9ca3af;
              margin-top: 40px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h1>📊 Weekly Usage Summary</h1>
          <p style="color: #6b7280;">Report Period: Last 7 Days</p>
          
          <div class="stat">
            <div class="stat-label">Total Usage</div>
            <div class="stat-value">${this.formatBytes(totalUsage)}</div>
          </div>
          
          <div class="stat">
            <div class="stat-label">Daily Average</div>
            <div class="stat-value">${this.formatBytes(avgDaily)}</div>
          </div>
          
          <div class="stat">
            <div class="stat-label">Highest Day</div>
            <div class="stat-value">${maxDay.date || 'N/A'} - ${this.formatBytes(maxDay.total)}</div>
          </div>
          
          <div class="stat">
            <div class="stat-label">Lowest Day</div>
            <div class="stat-value">${minDay.date || 'N/A'} - ${this.formatBytes(minDay.total)}</div>
          </div>
          
          <h2 style="margin-top: 40px; color: #374151;">Top 5 Sites</h2>
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Total Usage</th>
                <th>% of Total</th>
              </tr>
            </thead>
            <tbody>
              ${topDomains.map(([domain, bytes]) => `
                <tr>
                  <td>${domain}</td>
                  <td>${this.formatBytes(bytes)}</td>
                  <td>${((bytes / totalUsage) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Generated by Bandwidth Budget Tracker</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body>
        </html>
      `;
      
      // Create downloadable HTML
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const filename = `weekly-summary-${new Date().toISOString().split('T')[0]}.html`;
      
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });
      
      console.log('✅ Weekly summary generated');
      return { success: true, filename };
      
    } catch (error) {
      console.error('❌ Summary generation error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Helper: Format bytes to human readable
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
