import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Agent job types
export interface AgentJob {
  type: 'property-search' | 'strategy-arbitrage' | 'zoning-analysis' | 'cash-flow' | 'supply-demand';
  dealId: string;
  userId: string;
  params: any;
}

// Create agent queue
export const agentQueue = new Queue('agents', { connection });

export class QueueService {
  private static workers: Map<string, Worker> = new Map();

  // Add agent job to queue
  static async addAgentJob(job: AgentJob): Promise<string> {
    const queueJob = await agentQueue.add(job.type, job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    return queueJob.id || '';
  }

  // Get job status
  static async getJobStatus(jobId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed';
    progress: number;
    result?: any;
    error?: string;
  }> {
    const job = await agentQueue.getJob(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress as number || 0;

    return {
      status: state as any,
      progress,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  // Register worker for agent type
  static registerWorker(
    agentType: string,
    processor: (job: Job<AgentJob>) => Promise<any>
  ) {
    const worker = new Worker(
      'agents',
      async (job) => {
        if (job.name === agentType) {
          return processor(job);
        }
      },
      { connection }
    );

    worker.on('completed', (job) => {
      console.log(`✅ Agent job completed: ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Agent job failed: ${job?.id}`, err);
    });

    this.workers.set(agentType, worker);
  }

  // Example: Property Search Agent Worker
  static startPropertySearchWorker() {
    this.registerWorker('property-search', async (job) => {
      const { dealId, params } = job.data;

      // Update progress
      await job.updateProgress(10);

      // Simulate property search
      // In reality, this would query the database
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await job.updateProgress(50);

      const properties = []; // Query results
      await job.updateProgress(100);

      return { dealId, properties, count: properties.length };
    });
  }

  // Example: Strategy Arbitrage Agent Worker
  static startStrategyArbitrageWorker() {
    this.registerWorker('strategy-arbitrage', async (job) => {
      const { dealId, params } = job.data;

      await job.updateProgress(10);

      // Run Python analysis engines
      // This would call the Python capacity analyzer, etc.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await job.updateProgress(50);

      const analysis = {
        jediScore: 78,
        verdict: 'OPPORTUNITY',
        recommendations: [],
      };

      await job.updateProgress(100);

      return { dealId, analysis };
    });
  }

  // Clean up completed jobs (older than 24h)
  static async cleanOldJobs() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    await agentQueue.clean(oneDayAgo, 100, 'completed');
    await agentQueue.clean(oneDayAgo, 100, 'failed');
  }

  // Shutdown workers gracefully
  static async shutdown() {
    const promises = Array.from(this.workers.values()).map((worker) =>
      worker.close()
    );
    await Promise.all(promises);
    await connection.quit();
  }
}

// Start workers on module load
if (process.env.NODE_ENV !== 'test') {
  QueueService.startPropertySearchWorker();
  QueueService.startStrategyArbitrageWorker();
  
  // Clean old jobs every hour
  setInterval(() => {
    QueueService.cleanOldJobs();
  }, 60 * 60 * 1000);
}
