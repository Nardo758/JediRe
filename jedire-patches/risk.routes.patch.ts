/**
 * PATCH: risk.routes.ts - Add user model preference support
 * 
 * Apply to: backend/src/api/rest/risk.routes.ts
 * 
 * CHANGES NEEDED:
 * 1. Add import for getUserAIModel at top of file
 * 2. Modify the POST /narrative/:dealId endpoint to use user's preferred model
 */

// ============================================
// STEP 1: Add this import near the top of the file
// ============================================
import { getUserAIModel } from '../../utils/ai-model.utils';


// ============================================
// STEP 2: In the POST /narrative/:dealId handler,
// Replace the hardcoded model with user preference lookup
// ============================================

// FIND this code (around line 863-970):
/*
router.post('/narrative/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    ...
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-20250514',  // <-- HARDCODED MODEL
      max_tokens: 8192,
      ...
*/

// REPLACE with:
router.post('/narrative/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    
    // Get user ID from auth (add this line)
    const userId = (req as any).user?.id;
    
    // Get user's preferred model for risk analysis (add this line)
    const userModel = await getUserAIModel(userId, 'risk');
    
    // ... rest of existing code ...
    
    // When creating the stream, use userModel instead of hardcoded value:
    const stream = anthropic.messages.stream({
      model: userModel,  // <-- USE USER'S PREFERRED MODEL
      max_tokens: 8192,
      // ... rest of stream config
    });

    // ... rest of handler
  } catch (error) {
    // ... error handling
  }
});


// ============================================
// FULL REPLACEMENT for the handler (copy-paste ready):
// ============================================

/**
 * POST /api/v1/risk/narrative/:dealId
 * Generate AI-powered risk narrative assessment
 * Now uses user's preferred AI model from settings
 */
/*
router.post('/narrative/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.id;
    
    // Get user's preferred model for risk analysis
    const userModel = await getUserAIModel(userId, 'risk');
    console.log(`[Risk Narrative] Using model: ${userModel} for user: ${userId || 'anonymous'}`);

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // ... [keep all the existing data fetching code] ...

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = anthropic.messages.stream({
      model: userModel,  // <-- DYNAMIC MODEL
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // ... [keep all the existing streaming code] ...

  } catch (error) {
    logger.error('Error generating risk narrative:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to generate risk narrative',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});
*/
