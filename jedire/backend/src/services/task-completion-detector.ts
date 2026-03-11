/**
 * Task Completion Detector Service
 * Scans emails for task completion signals and suggests task updates
 */

interface Email {
  id: string;
  subject: string;
  body: string;
  sender: string;
  recipients: string[];
  timestamp: string;
}

interface Task {
  id: string;
  name: string;
  description?: string;
  status: string;
  linkedEntity: {
    id: string;
    name: string;
    type: string;
  };
  assignedTo: {
    userId: string;
    name: string;
  };
}

interface CompletionSignal {
  taskId: string;
  taskName: string;
  emailId: string;
  emailSubject: string;
  completionDate: string;
  confidence: number; // 0-100
  matchedKeywords: string[];
  matchedBy: 'name' | 'deal' | 'person' | 'multiple';
  sender: string;
  reasoning: string;
}

export class TaskCompletionDetector {
  // Completion keywords (strong signals)
  private readonly COMPLETION_KEYWORDS = [
    'completed',
    'done',
    'finished',
    'closed',
    'resolved',
    'accomplished',
    'wrapped up',
    'finalized',
    'submitted',
    'delivered',
    'sent',
    'uploaded',
    'signed',
    'executed',
  ];

  // Context keywords (boost confidence)
  private readonly CONTEXT_KEYWORDS = [
    'task',
    'action item',
    'to-do',
    'deliverable',
    'milestone',
  ];

  // Negative keywords (reduce confidence)
  private readonly NEGATIVE_KEYWORDS = [
    'not completed',
    'incomplete',
    'pending',
    'waiting',
    'blocked',
    'delayed',
    'issue',
    'problem',
  ];

  /**
   * Scan emails for task completion signals
   */
  async scanEmails(emails: Email[], tasks: Task[]): Promise<CompletionSignal[]> {
    const signals: CompletionSignal[] = [];

    for (const email of emails) {
      const emailText = `${email.subject} ${email.body}`.toLowerCase();

      // Check if email contains completion keywords
      const hasCompletionKeyword = this.COMPLETION_KEYWORDS.some(keyword =>
        emailText.includes(keyword)
      );

      if (!hasCompletionKeyword) continue;

      // Try to match email to tasks
      for (const task of tasks) {
        // Skip already completed tasks
        if (task.status === 'complete') continue;

        const signal = this.matchEmailToTask(email, task, emailText);
        if (signal && signal.confidence >= 40) {
          signals.push(signal);
        }
      }
    }

    // Sort by confidence (highest first)
    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Match an email to a specific task
   */
  private matchEmailToTask(
    email: Email,
    task: Task,
    emailText: string
  ): CompletionSignal | null {
    let confidence = 0;
    const matchedKeywords: string[] = [];
    const matchTypes: Array<'name' | 'deal' | 'person'> = [];

    // 1. Check for task name match (strong signal)
    const taskNameMatch = this.fuzzyMatch(emailText, task.name.toLowerCase());
    if (taskNameMatch > 0.7) {
      confidence += 50;
      matchTypes.push('name');
      matchedKeywords.push(`task name: "${task.name}"`);
    } else if (taskNameMatch > 0.4) {
      confidence += 30;
      matchTypes.push('name');
      matchedKeywords.push(`partial task name match`);
    }

    // 2. Check for deal/property mention
    if (emailText.includes(task.linkedEntity.name.toLowerCase())) {
      confidence += 25;
      matchTypes.push('deal');
      matchedKeywords.push(`deal: "${task.linkedEntity.name}"`);
    }

    // 3. Check for assigned person (sender or recipient)
    const assignedName = task.assignedTo.name.toLowerCase();
    const senderMatch = email.sender.toLowerCase().includes(assignedName);
    const recipientMatch = email.recipients.some(r =>
      r.toLowerCase().includes(assignedName)
    );

    if (senderMatch || recipientMatch) {
      confidence += 15;
      matchTypes.push('person');
      matchedKeywords.push(`person: "${task.assignedTo.name}"`);
    }

    // 4. Boost confidence for completion keywords
    for (const keyword of this.COMPLETION_KEYWORDS) {
      if (emailText.includes(keyword)) {
        confidence += 5;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }

    // 5. Boost for context keywords
    for (const keyword of this.CONTEXT_KEYWORDS) {
      if (emailText.includes(keyword)) {
        confidence += 3;
      }
    }

    // 6. Reduce confidence for negative keywords
    for (const keyword of this.NEGATIVE_KEYWORDS) {
      if (emailText.includes(keyword)) {
        confidence -= 20;
        matchedKeywords.push(`⚠️ "${keyword}"`);
      }
    }

    // Need at least some confidence to return a signal
    if (confidence < 30) return null;

    // Cap confidence at 100
    confidence = Math.min(100, confidence);

    // Determine match type
    let matchedBy: 'name' | 'deal' | 'person' | 'multiple' = 'name';
    if (matchTypes.length > 1) {
      matchedBy = 'multiple';
    } else if (matchTypes.length === 1) {
      matchedBy = matchTypes[0];
    }

    // Generate reasoning
    const reasoning = this.generateReasoning(matchTypes, matchedKeywords, confidence);

    return {
      taskId: task.id,
      taskName: task.name,
      emailId: email.id,
      emailSubject: email.subject,
      completionDate: email.timestamp,
      confidence,
      matchedKeywords,
      matchedBy,
      sender: email.sender,
      reasoning,
    };
  }

  /**
   * Fuzzy string matching (simple implementation)
   */
  private fuzzyMatch(text: string, pattern: string): number {
    // Simple word-based matching
    const textWords = text.split(/\s+/);
    const patternWords = pattern.split(/\s+/);

    let matches = 0;
    for (const word of patternWords) {
      if (textWords.some(w => w.includes(word) || word.includes(w))) {
        matches++;
      }
    }

    return matches / patternWords.length;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    matchTypes: Array<'name' | 'deal' | 'person'>,
    keywords: string[],
    confidence: number
  ): string {
    const reasons: string[] = [];

    if (matchTypes.includes('name')) {
      reasons.push('Email mentions task name');
    }
    if (matchTypes.includes('deal')) {
      reasons.push('Email mentions related deal/property');
    }
    if (matchTypes.includes('person')) {
      reasons.push('Email from/to assigned person');
    }

    if (keywords.length > 0) {
      const positiveKeywords = keywords.filter(k => !k.startsWith('⚠️'));
      if (positiveKeywords.length > 0) {
        reasons.push(`Contains keywords: ${positiveKeywords.slice(0, 3).join(', ')}`);
      }
    }

    let reasoning = reasons.join(' • ');

    if (confidence >= 80) {
      reasoning = `🟢 High confidence: ${reasoning}`;
    } else if (confidence >= 60) {
      reasoning = `🟡 Medium confidence: ${reasoning}`;
    } else {
      reasoning = `🟠 Low confidence: ${reasoning}`;
    }

    return reasoning;
  }

  /**
   * Extract completion date from email
   * Uses email timestamp as completion date
   */
  extractCompletionDate(email: Email): string {
    return email.timestamp;
  }

  /**
   * Validate completion signal before applying
   */
  validateSignal(signal: CompletionSignal): { valid: boolean; reason?: string } {
    // Must have minimum confidence
    if (signal.confidence < 40) {
      return { valid: false, reason: 'Confidence too low' };
    }

    // Must have matched keywords
    if (signal.matchedKeywords.length === 0) {
      return { valid: false, reason: 'No matching keywords found' };
    }

    // Check for negative signals
    const hasNegativeKeywords = signal.matchedKeywords.some(k => k.startsWith('⚠️'));
    if (hasNegativeKeywords && signal.confidence < 70) {
      return { valid: false, reason: 'Negative keywords detected with low confidence' };
    }

    return { valid: true };
  }
}

export const taskCompletionDetector = new TaskCompletionDetector();
