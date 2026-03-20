#!/usr/bin/env node

/**
 * JediRe CLI Tool
 * Command-line interface for JediRe platform operations
 */

const { JediReClient } = require('jedire-client');
const { formatDeal, formatProperty, analyzeError } = require('../helpers');

// Configuration
const API_KEY = process.env.JEDIRE_API_KEY;
const API_URL = process.env.JEDIRE_API_URL || 'https://api.jedire.com';

if (!API_KEY) {
  console.error('❌ Error: JEDIRE_API_KEY environment variable not set');
  console.error('   Set it with: export JEDIRE_API_KEY=your_api_key');
  process.exit(1);
}

// Initialize client
const client = new JediReClient({
  apiKey: API_KEY,
  baseUrl: API_URL
});

// Command handlers
const commands = {
  async deal(dealId) {
    if (!dealId) {
      console.error('Usage: jedire-cli deal <dealId>');
      process.exit(1);
    }

    console.log(`📊 Fetching deal ${dealId}...`);
    
    try {
      const deal = await client.deals.get(dealId);
      console.log('\n' + formatDeal(deal));
      
      if (deal.warnings && deal.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        deal.warnings.forEach(w => console.log(`  • ${w}`));
      }
    } catch (error) {
      console.error('\n❌ Error fetching deal:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  },

  async property(address) {
    if (!address) {
      console.error('Usage: jedire-cli property "<address>"');
      process.exit(1);
    }

    console.log(`🏠 Searching for property: ${address}...`);
    
    try {
      const results = await client.properties.search(address);
      
      if (!results || results.length === 0) {
        console.log('\n❌ No properties found matching that address');
        return;
      }

      if (results.length > 1) {
        console.log(`\n✅ Found ${results.length} properties:\n`);
        results.forEach((p, i) => {
          console.log(`${i + 1}. ${p.address}, ${p.city}, ${p.state}`);
        });
        console.log('\nShowing details for first result:\n');
      }

      console.log(formatProperty(results[0]));

      if (results[0].comparables && results[0].comparables.length > 0) {
        console.log('\n📊 Comparable Properties:');
        results[0].comparables.slice(0, 3).forEach(comp => {
          console.log(`  • ${comp.address}: ${formatCurrency(comp.value)}`);
        });
      }
    } catch (error) {
      console.error('\n❌ Error searching property:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  },

  async analyze(dealId, type) {
    if (!dealId || !type) {
      console.error('Usage: jedire-cli analyze <dealId> <type>');
      console.error('Types: cashflow, sensitivity, market, risk');
      process.exit(1);
    }

    const validTypes = ['cashflow', 'sensitivity', 'market', 'risk'];
    if (!validTypes.includes(type)) {
      console.error(`❌ Invalid analysis type: ${type}`);
      console.error(`   Valid types: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    console.log(`🔍 Running ${type} analysis for deal ${dealId}...`);
    
    try {
      const analysis = await client.analysis.run(dealId, type);
      
      console.log(`\n📈 ${type.toUpperCase()} ANALYSIS\n`);
      
      if (type === 'cashflow') {
        displayCashflowAnalysis(analysis);
      } else if (type === 'sensitivity') {
        displaySensitivityAnalysis(analysis);
      } else if (type === 'market') {
        displayMarketAnalysis(analysis);
      } else if (type === 'risk') {
        displayRiskAnalysis(analysis);
      }
    } catch (error) {
      console.error('\n❌ Error running analysis:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  },

  async errors() {
    console.log('🔍 Fetching recent errors...');
    
    try {
      const errors = await client.monitoring.getErrors({
        limit: 10,
        since: Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
      });

      if (!errors || errors.length === 0) {
        console.log('\n✅ No errors in the last 24 hours');
        return;
      }

      console.log(`\n⚠️  Found ${errors.length} error(s):\n`);
      
      errors.forEach((error, i) => {
        const analysis = analyzeError(error);
        console.log(`${i + 1}. [${analysis.severity.toUpperCase()}] ${analysis.message}`);
        console.log(`   Type: ${analysis.type}`);
        console.log(`   Time: ${formatDate(analysis.timestamp)}`);
        console.log(`   Impact: ${analysis.impact}`);
        console.log(`   Explanation: ${analysis.explanation}`);
        
        if (analysis.recommendations.length > 0) {
          console.log('   Recommendations:');
          analysis.recommendations.forEach(rec => {
            console.log(`     • ${rec}`);
          });
        }
        console.log('');
      });
    } catch (error) {
      console.error('\n❌ Error fetching errors:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  }
};

// Analysis display functions
function displayCashflowAnalysis(analysis) {
  const { projections, summary } = analysis;
  
  console.log('💰 Cash Flow Projections (Years 1-10):\n');
  
  projections.slice(0, 10).forEach((year, i) => {
    console.log(`Year ${i + 1}:`);
    console.log(`  Revenue:     ${formatCurrency(year.revenue)}`);
    console.log(`  Expenses:    ${formatCurrency(year.expenses)}`);
    console.log(`  NOI:         ${formatCurrency(year.noi)}`);
    console.log(`  Cash Flow:   ${formatCurrency(year.cashFlow)}`);
    console.log('');
  });

  console.log('📊 Summary:');
  console.log(`  Total NOI:        ${formatCurrency(summary.totalNOI)}`);
  console.log(`  Total Cash Flow:  ${formatCurrency(summary.totalCashFlow)}`);
  console.log(`  Average Cap Rate: ${formatPercent(summary.avgCapRate)}`);
}

function displaySensitivityAnalysis(analysis) {
  const { variables, scenarios } = analysis;
  
  console.log('📊 Sensitivity Analysis:\n');
  
  variables.forEach(variable => {
    console.log(`${variable.name}:`);
    console.log(`  Base Case:  ${formatValue(variable.baseValue, variable.format)}`);
    console.log(`  Best Case:  ${formatValue(variable.bestCase, variable.format)} → IRR: ${formatPercent(variable.bestIRR)}`);
    console.log(`  Worst Case: ${formatValue(variable.worstCase, variable.format)} → IRR: ${formatPercent(variable.worstIRR)}`);
    console.log('');
  });

  console.log('🎯 Key Insights:');
  scenarios.insights.forEach(insight => {
    console.log(`  • ${insight}`);
  });
}

function displayMarketAnalysis(analysis) {
  const { market, comparables, trends } = analysis;
  
  console.log('🏙️  Market Analysis:\n');
  console.log(`Market: ${market.name}`);
  console.log(`Population: ${formatNumber(market.population)}`);
  console.log(`Median Income: ${formatCurrency(market.medianIncome)}`);
  console.log(`Unemployment: ${formatPercent(market.unemployment)}`);
  console.log('');

  console.log('📈 Market Metrics:');
  console.log(`  Avg Cap Rate:     ${formatPercent(market.avgCapRate)}`);
  console.log(`  Avg Price/Unit:   ${formatCurrency(market.avgPricePerUnit)}`);
  console.log(`  Vacancy Rate:     ${formatPercent(market.vacancyRate)}`);
  console.log(`  YoY Appreciation: ${formatPercent(market.appreciation)}`);
  console.log('');

  if (comparables && comparables.length > 0) {
    console.log('🏢 Comparable Deals:');
    comparables.slice(0, 5).forEach(comp => {
      console.log(`  • ${comp.name}: ${formatCurrency(comp.price)} | Cap: ${formatPercent(comp.capRate)}`);
    });
    console.log('');
  }

  console.log('📊 Trends:');
  trends.forEach(trend => {
    console.log(`  • ${trend}`);
  });
}

function displayRiskAnalysis(analysis) {
  const { riskScore, factors, mitigation } = analysis;
  
  console.log(`⚠️  Overall Risk Score: ${riskScore}/100\n`);
  
  console.log('Risk Factors:\n');
  factors.forEach(factor => {
    const icon = factor.level === 'high' ? '🔴' : factor.level === 'medium' ? '🟡' : '🟢';
    console.log(`${icon} ${factor.name} (${factor.level.toUpperCase()})`);
    console.log(`   ${factor.description}`);
    console.log(`   Impact: ${factor.impact}`);
    console.log('');
  });

  console.log('🛡️  Mitigation Strategies:');
  mitigation.forEach(strategy => {
    console.log(`  • ${strategy}`);
  });
}

// Utility functions
function formatCurrency(value) {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value) {
  if (value == null) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value) {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US');
}

function formatValue(value, format) {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return formatPercent(value);
  return formatNumber(value);
}

// Main execution
const [,, command, ...args] = process.argv;

if (!command) {
  console.log('JediRe CLI Tool\n');
  console.log('Usage: jedire-cli <command> [args]\n');
  console.log('Commands:');
  console.log('  deal <id>              Fetch and display deal information');
  console.log('  property "<address>"   Search and display property data');
  console.log('  analyze <id> <type>    Run analysis (cashflow|sensitivity|market|risk)');
  console.log('  errors                 Show recent errors');
  console.log('\nEnvironment:');
  console.log('  JEDIRE_API_KEY        Your JediRe API key (required)');
  console.log('  JEDIRE_API_URL        API endpoint (default: https://api.jedire.com)');
  process.exit(0);
}

const handler = commands[command];
if (!handler) {
  console.error(`❌ Unknown command: ${command}`);
  console.error('   Run without arguments to see available commands');
  process.exit(1);
}

// Execute command
handler(...args).catch(error => {
  console.error('\n❌ Unexpected error:');
  console.error(`   ${error.message}`);
  if (process.env.DEBUG) {
    console.error('\n' + error.stack);
  }
  process.exit(1);
});
