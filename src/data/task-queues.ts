// TODO: Validate
export class SerialTaskQueue {
  private lastQueuedTask: Promise<unknown> = Promise.resolve();

  // TODO: Validate
  run<TaskResult>(queuedTask: () => Promise<TaskResult>): Promise<TaskResult> {
    const queuedTaskResult = this.lastQueuedTask.then(queuedTask, queuedTask);
    this.lastQueuedTask = queuedTaskResult.catch(() => undefined);
    return queuedTaskResult;
  }
}

// TODO: Validate
export class ConcurrencyLimitedQueue {
  private readonly maximumRunningTasks: number;
  private runningTaskCount = 0;
  private readonly waitingTaskStarters: (() => void)[] = [];

  // TODO: Validate
  constructor(maximumRunningTasks: number) {
    this.maximumRunningTasks = maximumRunningTasks;
  }

  // TODO: Validate
  async run<TaskResult>(queuedTask: () => Promise<TaskResult>): Promise<TaskResult> {
    if (this.runningTaskCount >= this.maximumRunningTasks) {
      await new Promise<void>((startWaitingTask) => this.waitingTaskStarters.push(startWaitingTask));
    }
    this.runningTaskCount++;
    try {
      return await queuedTask();
    } finally {
      this.runningTaskCount--;
      this.waitingTaskStarters.shift()?.();
    }
  }
}
