#!/usr/bin/env node
/**
 * Data Quality Audit Script
 * Identifies deals with missing or invalid data
 */

const API_URL = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev';
const API_TOKEN = '69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6';

async function api(endpoint, body) {
  const response = await fetch(`${API_URL}/api/v1/clawdbot/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function main() {
  console.log('🔍 JediRe Data Quality Audit');
  console.log('================================\n');

  // Get all deals
  const result = await api('command', { command: 'get_deals', params: { limit: 50 } });
  const deals = result.result.deals;

  console.log(`Auditing ${deals.length} deals...\n`);

  const issues = {
    missingAddress: [],
    missingCity: [],
    missingState: [],
    missingBudget: [],
    missingUnits: [],
    missingProjectType: [],
    invalidAddress: [],
    lowQuality: [],
  };

  let qualityScore = 0;
  const maxScore = deals.length * 6; // 6 fields per deal

  deals.forEach(deal => {
    let dealScore = 0;

    // Check address
    if (!deal.address || deal.address.trim().length < 10) {
      issues.missingAddress.push(deal.name);
    } else {
      dealScore++;
      
      // Check if address has city/state
      const parts = deal.address.split(',');
      if (parts.length < 2) {
        issues.invalidAddress.push(deal.name);
      }
    }

    // Check city
    if (!deal.city) {
      issues.missingCity.push(deal.name);
    } else {
      dealScore++;
    }

    // Check state
    if (!deal.state) {
      issues.missingState.push(deal.name);
    } else {
      dealScore++;
    }

    // Check budget
    if (!deal.budget || deal.budget === '0') {
      issues.missingBudget.push(deal.name);
    } else {
      dealScore++;
    }

    // Check target units
    if (!deal.targetUnits || deal.targetUnits === 0) {
      issues.missingUnits.push(deal.name);
    } else {
      dealScore++;
    }

    // Check project type
    if (!deal.projectType) {
      issues.missingProjectType.push(deal.name);
    } else {
      dealScore++;
    }

    qualityScore += dealScore;

    // Flag low quality deals (< 50% complete)
    if (dealScore < 3) {
      issues.lowQuality.push({
        name: deal.name,
        score: dealScore,
        id: deal.id,
      });
    }
  });

  // Print report
  console.log('📊 Data Quality Report\n');
  console.log(`Overall Score: ${qualityScore}/${maxScore} (${(qualityScore/maxScore*100).toFixed(1)}%)\n`);

  if (issues.missingAddress.length > 0) {
    console.log(`❌ Missing Address (${issues.missingAddress.length}):`);
    issues.missingAddress.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }

  if (issues.invalidAddress.length > 0) {
    console.log(`⚠️  Invalid Address Format (${issues.invalidAddress.length}):`);
    issues.invalidAddress.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }

  if (issues.missingCity.length > 0) {
    console.log(`❌ Missing City (${issues.missingCity.length}):`);
    issues.missingCity.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }

  if (issues.missingBudget.length > 0) {
    console.log(`⚠️  Missing Budget (${issues.missingBudget.length}):`);
    issues.missingBudget.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }

  if (issues.missingUnits.length > 0) {
    console.log(`⚠️  Missing Target Units (${issues.missingUnits.length}):`);
    issues.missingUnits.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }

  if (issues.lowQuality.length > 0) {
    console.log(`🚨 Low Quality Deals (${issues.lowQuality.length}):`);
    issues.lowQuality.forEach(deal => {
      console.log(`   - ${deal.name} (${deal.score}/6) - ID: ${deal.id}`);
    });
    console.log('');
  }

  console.log('================================');
  console.log('\n💡 Recommendations:\n');

  if (issues.missingAddress.length > 0 || issues.invalidAddress.length > 0) {
    console.log('1. Fix addresses - agents cannot geocode without valid addresses');
  }

  if (issues.missingBudget.length > 0) {
    console.log('2. Add budget data - cashflow agent needs purchase price');
  }

  if (issues.missingUnits.length > 0) {
    console.log('3. Add target units - affects revenue calculations');
  }

  console.log('\nUse SQL to update missing data:');
  console.log('  UPDATE deals SET budget = <value> WHERE name = \'<deal_name>\';');
  console.log('  UPDATE deals SET target_units = <value> WHERE name = \'<deal_name>\';');
  console.log('  UPDATE deals SET lot_size_sqft = <value> WHERE name = \'<deal_name>\';');
}

main().catch(console.error);
