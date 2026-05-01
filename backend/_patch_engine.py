# -*- coding: utf-8 -*-
"""Patch financial-model-engine.service.ts: switch Claude -> DeepSeek, fix interceptor normalization."""

path = 'src/services/financial-model-engine.service.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Add OpenAI import + interceptor helpers import
old = "import { applyFullAnchorInterceptor } from './sigma/anchor-interceptor.service';"
new = """import { applyFullAnchorInterceptor, normalizeExpensesForInterceptor, rekeyExpensesFromInterceptor } from './sigma/anchor-interceptor.service';
import OpenAI from 'openai';"""
content = content.replace(old, new)
changes += 1
print(f"1. Added imports ({changes})")

# 2. Replace Anthropic config with DeepSeek config
old = """const ANTHROPIC_API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const CLAUDE_MODEL = 'claude-sonnet-4-5';"""
new = """const DEEPSEEK_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const llmClient = new OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: DEEPSEEK_BASE_URL });"""
content = content.replace(old, new)
changes += 1
print(f"2. DeepSeek config ({changes})")

# 3. Rename callClaudeForModel -> callLLMForModel
content = content.replace('callClaudeForModel', 'callLLMForModel')
changes += 1
print(f"3. Renamed ({changes})")

# 4. Replace the Anthropic API call block with OpenAI-compatible
# Find the method
old_block = """  private async callLLMForModel(assumptions: ProFormaAssumptions): Promise<FinancialModelResult> {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(assumptions.modelType);
    const userPrompt = this.buildUserPrompt(assumptions);

    const response = await llmClient.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 16000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });"""

new_block = """  private async callLLMForModel(assumptions: ProFormaAssumptions): Promise<FinancialModelResult> {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(assumptions.modelType);
    const userPrompt = this.buildUserPrompt(assumptions);

    const response = await llmClient.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 16000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices?.[0]?.message?.content || '';"""

if old_block in content:
    content = content.replace(old_block, new_block)
    changes += 1
    print(f"4. Replaced API call block ({changes})")
else:
    print(f"4. WARN: Could not find old_block - checking for the old Anthropic block...")
    # Check if we still have the old Anthropic-style block
    old_anthropic = """  private async callLLMForModel(assumptions: ProFormaAssumptions): Promise<FinancialModelResult> {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(assumptions.modelType);
    const userPrompt = this.buildUserPrompt(assumptions);

    const response = await axios.post("""
    if old_anthropic in content:
        print("Found old Anthropic block still present")
    else:
        print("Neither old nor new block found")

# 5. Remove the Anthropic-specific header lines and old axios response parsing
# Look for and remove: 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01',
old = """          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',"""
content = content.replace(old, '')

# Remove the old `const text = response.data...` if present
old = """    const text = response.data.content?.[0]?.text || '';"""
new = """    const text = response.choices?.[0]?.message?.content || '';"""
content = content.replace(old, new)

# 6. Fix anchor interceptor call to normalize keys
old = """      const stateCode = enhancedAssumptions.dealInfo?.state ?? null;
      if (stateCode) {
        const intercepted = applyFullAnchorInterceptor(
          {},
          enhancedAssumptions.expenses || {},
          stateCode,
        );
        enhancedAssumptions.expenses = intercepted.expenses;
        logger.info(`[Anchor-Interceptor] Applied anchor growth rates for ${dealId} in ${stateCode} (${Object.keys(intercepted.expenses).length} lines)`)
      }"""
new = """      const stateCode = enhancedAssumptions.dealInfo?.state ?? null;
      if (stateCode) {
        const normalized = normalizeExpensesForInterceptor(enhancedAssumptions.expenses || {});
        const intercepted = applyFullAnchorInterceptor(
          {},
          normalized,
          stateCode,
        );
        enhancedAssumptions.expenses = rekeyExpensesFromInterceptor(intercepted.expenses);
        logger.info(`[Anchor-Interceptor] Applied anchor growth rates for ${dealId} in ${stateCode} (${Object.keys(normalized).length} source lines \u2192 ${Object.keys(intercepted.expenses).length} anchors mapped)`)
      }"""
content = content.replace(old, new)
changes += 1
print(f"6. Fixed interceptor normalization ({changes})")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone. {changes} changes applied to {path}")
