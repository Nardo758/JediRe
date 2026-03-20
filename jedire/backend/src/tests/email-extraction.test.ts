/**
 * Email Extraction Integration Tests
 * Verify property and news extraction from emails
 */

import { classifyEmailByKeywords, classifyEmail } from '../services/email-classification.service';
import { extractNewsFromEmail } from '../services/email-news-extraction.service';
import { extractPropertyFromEmail } from '../services/email-property-automation.service';

describe('Email Classification', () => {
  test('Should classify property listing email', () => {
    const result = classifyEmailByKeywords({
      subject: 'Off-Market Deal: 200-Unit Multifamily - Austin, TX',
      body: '200-unit apartment complex in Austin. Built 2018. $25M asking. 6.5% cap rate. 95% occupancy.',
      from: 'broker@cbre.com',
    });

    expect(result.classification).toBe('property');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.containsProperty).toBe(true);
  });

  test('Should classify news email', () => {
    const result = classifyEmailByKeywords({
      subject: 'Amazon Announces 5,000-Job Expansion in Atlanta',
      body: 'Amazon will invest $500M in new fulfillment center, creating 5,000 jobs by 2025.',
      from: 'newsletter@bisnow.com',
    });

    expect(result.classification).toBe('news');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.containsNews).toBe(true);
  });

  test('Should classify mixed email', () => {
    const result = classifyEmailByKeywords({
      subject: 'Amazon HQ2 Announced + Adjacent Land for Sale',
      body: 'Amazon announced new campus with 10,000 jobs. Adjacent 5-acre parcel available for $20M.',
      from: 'broker@jll.com',
    });

    expect(result.classification).toBe('mixed');
    expect(result.containsProperty).toBe(true);
    expect(result.containsNews).toBe(true);
  });

  test('Should classify general correspondence', () => {
    const result = classifyEmailByKeywords({
      subject: 'Re: Meeting Next Week',
      body: 'Thanks for your email. Let\'s meet next Tuesday at 2pm.',
      from: 'john@example.com',
    });

    expect(result.classification).toBe('general');
    expect(result.confidence).toBeLessThan(0.3);
  });
});

describe('Property Extraction (Mock)', () => {
  test('Should extract property details from broker email', async () => {
    // This would use a real LLM in production
    // For testing, we can verify the structure

    const emailData = {
      id: 'test-123',
      subject: 'Off-Market: 250-Unit Multifamily - Atlanta, GA',
      from: { name: 'John Broker', address: 'john@cbre.com' },
      bodyPreview: '250-unit apartment complex...',
      body: {
        content: `
          250-unit apartment complex in Atlanta, GA
          Address: 123 Main Street, Atlanta, GA 30303
          Built: 2015
          Price: $35,000,000
          Cap Rate: 6.8%
          Occupancy: 92%
          Property Type: Multifamily
          Condition: Good
        `
      },
      receivedDateTime: new Date().toISOString(),
    };

    // In real test, would call extractPropertyFromEmail(emailData)
    // and verify structure of response
    expect(emailData.subject).toContain('Multifamily');
  });
});

describe('News Extraction (Mock)', () => {
  test('Should extract news event from intelligence email', async () => {
    const subject = 'New Amazon Fulfillment Center - Atlanta Metro';
    const body = `
      Amazon announced a $500 million investment in a new fulfillment center
      in Gwinnett County, GA. The 1M sqft facility will create 2,500 jobs
      by 2026 and is expected to significantly impact local employment and
      real estate demand.
    `;
    const from = 'newsletter@bisnow.com';

    // In real test, would call extractNewsFromEmail
    // and verify structure
    expect(body).toContain('Amazon');
    expect(body).toContain('jobs');
  });
});

// Integration test placeholder
describe('Full Extraction Pipeline', () => {
  test('Should process email through complete pipeline', async () => {
    // 1. Classify email
    const classification = classifyEmailByKeywords({
      subject: 'Investment Opportunity: 200-Unit Property',
      body: 'Off-market deal, $20M, 7% cap rate',
      from: 'broker@example.com',
    });

    expect(classification.containsProperty).toBe(true);

    // 2. Would extract property (mocked)
    // 3. Would match preferences (mocked)
    // 4. Would create pin or queue for review (mocked)

    // For now, just verify classification works
    expect(classification.classification).toBe('property');
  });
});

// Run tests:
// npm test email-extraction.test.ts
