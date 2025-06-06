import { MedusaError } from "@medusajs/utils"
import { IDistributedSchedulerStorage, SchedulerOptions } from "../transaction"
import { WorkflowDefinition } from "./workflow-manager"

class WorkflowScheduler {
  private static storage: IDistributedSchedulerStorage
  public static setStorage(storage: IDistributedSchedulerStorage) {
    this.storage = storage
  }

  public async scheduleWorkflow(workflow: WorkflowDefinition) {
    const schedule = workflow.options?.schedule
    if (!schedule) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Workflow schedule is not defined while registering a scheduled workflow"
      )
    }

    const normalizedSchedule: SchedulerOptions =
      typeof schedule === "string"
        ? {
            cron: schedule,
            concurrency: "forbid",
          }
        : {
            concurrency: "forbid",
            ...schedule,
          }

    await WorkflowScheduler.storage.schedule(workflow.id, normalizedSchedule)
  }

  public async clearWorkflow(workflow: WorkflowDefinition) {
    await WorkflowScheduler.storage.remove(workflow.id)
  }

  public async clear() {
    await WorkflowScheduler.storage.removeAll()
  }
}

global.WorkflowScheduler ??= WorkflowScheduler
const GlobalWorkflowScheduler =
  global.WorkflowScheduler as typeof WorkflowScheduler

export { GlobalWorkflowScheduler as WorkflowScheduler }
