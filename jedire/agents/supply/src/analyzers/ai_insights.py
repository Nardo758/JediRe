"""
AI Insights Generator using Claude
Generates market commentary and recommendations
"""
import anthropic
from typing import Optional
from loguru import logger

from ..models import (
    InventoryMetrics,
    InventoryTrends,
    SupplyScore,
    AIInsights
)
from config.settings import settings


class AIInsightsGenerator:
    """Generate AI-powered market insights using Claude"""
    
    def __init__(self):
        self.name = "AIInsightsGenerator"
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.claude_model
        self.max_tokens = settings.claude_max_tokens
        self.call_count = 0
        self.total_tokens = 0
    
    async def generate_insights(
        self,
        market: str,
        metrics: InventoryMetrics,
        trends: InventoryTrends,
        score: SupplyScore
    ) -> AIInsights:
        """
        Generate comprehensive market insights using Claude
        
        Args:
            market: Market name
            metrics: Current inventory metrics
            trends: Inventory trends
            score: Supply score
            
        Returns:
            AIInsights with summary, findings, and recommendations
        """
        if not settings.enable_ai_insights:
            logger.info("AI insights disabled, returning basic insights")
            return self._generate_basic_insights(market, score)
        
        try:
            logger.info(f"Generating AI insights for {market} (score: {score.overall_score})")
            
            # Build prompt
            prompt = self._build_prompt(market, metrics, trends, score)
            
            # Call Claude
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            # Track usage
            self.call_count += 1
            self.total_tokens += response.usage.input_tokens + response.usage.output_tokens
            
            # Parse response
            insights = self._parse_response(response.content[0].text)
            
            logger.success(
                f"Generated AI insights: {len(insights.key_findings)} findings, "
                f"{len(insights.recommendations)} recommendations"
            )
            
            return insights
            
        except Exception as e:
            logger.error(f"AI insights generation failed: {e}")
            return self._generate_basic_insights(market, score)
    
    def _build_prompt(
        self,
        market: str,
        metrics: InventoryMetrics,
        trends: InventoryTrends,
        score: SupplyScore
    ) -> str:
        """Build prompt for Claude"""
        
        prompt = f"""You are a real estate market analyst. Analyze the following supply data for {market} and provide concise, actionable insights.

## Market Data:

**Supply Score: {score.overall_score}/100** ({score.interpretation.value.replace('_', ' ').title()})

**Current Inventory:**
- Total Active Listings: {metrics.total_inventory:,}
- Months of Supply: {metrics.months_of_supply}
- Median Days on Market: {metrics.median_dom} days
- Absorption Rate: {metrics.absorption_rate:.1%}
- Pending Sales: {metrics.pending_sales:,}
- Closed Sales (30d): {metrics.closed_sales_30d:,}

**Trends:**
- Inventory Change (30d): {trends.inventory_change_30d:+.1f}%
- Inventory Change (90d): {trends.inventory_change_90d:+.1f}%
- Absorption Change: {trends.absorption_change:+.3f}
- New Listings Trend: {trends.new_listings_trend}

**Score Components:**
- Inventory Factor: {score.inventory_component:.0f}/100
- Absorption Factor: {score.absorption_component:.0f}/100
- Days on Market Factor: {score.dom_component:.0f}/100
- Trend Factor: {score.trend_component:.0f}/100

## Instructions:

Provide your analysis in the following format:

### SUMMARY
[2-3 sentence market summary highlighting the most important insights]

### KEY_FINDINGS
- [Finding 1: Specific, data-driven insight]
- [Finding 2: Another key observation]
- [Finding 3: Important trend or anomaly]
[Add 2-5 findings total]

### RECOMMENDATIONS
- [Recommendation 1: Actionable advice for investors/buyers/sellers]
- [Recommendation 2: Strategic suggestion based on data]
- [Recommendation 3: Timing or tactical advice]
[Add 2-5 recommendations total]

### RISKS
- [Risk 1: Potential market risk to watch]
- [Risk 2: Another concern]
[Add 1-3 risks]

### OPPORTUNITIES
- [Opportunity 1: Investment or strategic opportunity]
- [Opportunity 2: Market inefficiency or advantage]
[Add 1-3 opportunities]

Be concise, specific, and focus on actionable intelligence. Avoid generic statements.
"""
        
        return prompt
    
    def _parse_response(self, response_text: str) -> AIInsights:
        """Parse Claude's response into structured insights"""
        
        # Simple parsing based on section headers
        sections = {
            'SUMMARY': '',
            'KEY_FINDINGS': [],
            'RECOMMENDATIONS': [],
            'RISKS': [],
            'OPPORTUNITIES': []
        }
        
        current_section = None
        
        for line in response_text.split('\n'):
            line = line.strip()
            
            if not line:
                continue
            
            # Check for section headers
            if 'SUMMARY' in line.upper() and line.startswith('#'):
                current_section = 'SUMMARY'
                continue
            elif 'KEY_FINDINGS' in line.upper() or 'KEY FINDINGS' in line.upper():
                current_section = 'KEY_FINDINGS'
                continue
            elif 'RECOMMENDATION' in line.upper():
                current_section = 'RECOMMENDATIONS'
                continue
            elif 'RISK' in line.upper():
                current_section = 'RISKS'
                continue
            elif 'OPPORTUNIT' in line.upper():
                current_section = 'OPPORTUNITIES'
                continue
            
            # Add content to current section
            if current_section:
                if current_section == 'SUMMARY':
                    sections['SUMMARY'] += line + ' '
                elif line.startswith('-') or line.startswith('•') or line.startswith('*'):
                    # Bullet point
                    content = line[1:].strip()
                    if content:
                        sections[current_section].append(content)
                elif line[0].isdigit() and '.' in line[:3]:
                    # Numbered list
                    content = line.split('.', 1)[1].strip()
                    if content:
                        sections[current_section].append(content)
        
        return AIInsights(
            summary=sections['SUMMARY'].strip(),
            key_findings=sections['KEY_FINDINGS'],
            recommendations=sections['RECOMMENDATIONS'],
            risks=sections['RISKS'] if sections['RISKS'] else None,
            opportunities=sections['OPPORTUNITIES'] if sections['OPPORTUNITIES'] else None
        )
    
    def _generate_basic_insights(self, market: str, score: SupplyScore) -> AIInsights:
        """Generate basic insights without AI (fallback)"""
        
        interpretation = score.interpretation.value.replace('_', ' ').title()
        
        # Template-based insights
        if score.overall_score >= 75:
            summary = f"{market} shows {interpretation} conditions with very tight inventory. Buyers should act quickly and expect competition."
            findings = [
                f"Supply score of {score.overall_score}/100 indicates a strong seller's market",
                "Limited inventory is creating competitive conditions",
                "Properties are likely moving quickly with multiple offers"
            ]
            recommendations = [
                "Buyers: Be prepared to move fast and consider offers above asking",
                "Sellers: Favorable conditions for listing properties",
                "Investors: Focus on off-market deals to find opportunities"
            ]
        elif score.overall_score >= 40:
            summary = f"{market} displays {interpretation} market conditions. More neutral environment for buyers and sellers."
            findings = [
                f"Supply score of {score.overall_score}/100 suggests relatively balanced market",
                "Neither buyers nor sellers have significant advantage",
                "Normal negotiation dynamics expected"
            ]
            recommendations = [
                "Buyers: Good time to negotiate and take time with decisions",
                "Sellers: Price competitively and expect standard timelines",
                "Investors: Analyze deals carefully, no urgency premium needed"
            ]
        else:
            summary = f"{market} shows {interpretation} with elevated inventory levels. Buyers have more negotiating power."
            findings = [
                f"Supply score of {score.overall_score}/100 indicates buyer's market conditions",
                "Higher inventory gives buyers more options and leverage",
                "Properties staying on market longer than normal"
            ]
            recommendations = [
                "Buyers: Take time to find the right property and negotiate firmly",
                "Sellers: Price aggressively and consider incentives",
                "Investors: Opportunity to find deals below market value"
            ]
        
        return AIInsights(
            summary=summary,
            key_findings=findings,
            recommendations=recommendations,
            risks=["Data may not reflect very recent market changes"],
            opportunities=None
        )
    
    def get_stats(self) -> dict:
        """Get AI usage statistics"""
        return {
            "calls": self.call_count,
            "total_tokens": self.total_tokens,
            "avg_tokens_per_call": (
                self.total_tokens / self.call_count if self.call_count > 0 else 0
            )
        }
