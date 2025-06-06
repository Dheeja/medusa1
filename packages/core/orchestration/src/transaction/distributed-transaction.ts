import { isDefined } from "@medusajs/utils"
import { EventEmitter } from "events"
import { IDistributedTransactionStorage } from "./datastore/abstract-storage"
import { BaseInMemoryDistributedTransactionStorage } from "./datastore/base-in-memory-storage"
import { NonSerializableCheckPointError } from "./errors"
import { TransactionOrchestrator } from "./transaction-orchestrator"
import { TransactionStep, TransactionStepHandler } from "./transaction-step"
import {
  TransactionFlow,
  TransactionHandlerType,
  TransactionState,
} from "./types"

/**
 * @typedef TransactionMetadata
 * @property model_id - The id of the model_id that created the transaction (modelId).
 * @property idempotency_key - The idempotency key of the transaction.
 * @property action - The action of the transaction.
 * @property action_type - The type of the transaction.
 * @property attempt - The number of attempts for the transaction.
 * @property timestamp - The timestamp of the transaction.
 */
export type TransactionMetadata = {
  model_id: string
  idempotency_key: string
  action: string
  action_type: TransactionHandlerType
  attempt: number
  timestamp: number
}

/**
 * @typedef TransactionContext
 * @property payload - Object containing the initial payload.
 * @property invoke - Object containing responses of Invoke handlers on steps flagged with saveResponse.
 * @property compensate - Object containing responses of Compensate handlers on steps flagged with saveResponse.
 */
export class TransactionContext {
  constructor(
    public payload: unknown = undefined,
    public invoke: Record<string, unknown> = {},
    public compensate: Record<string, unknown> = {}
  ) {}
}

export class TransactionStepError {
  constructor(
    public action: string,
    public handlerType: TransactionHandlerType,
    public error: Error | any
  ) {}
}

export class TransactionCheckpoint {
  constructor(
    public flow: TransactionFlow,
    public context: TransactionContext,
    public errors: TransactionStepError[] = []
  ) {}
}

export class TransactionPayload {
  /**
   * @param metadata - The metadata of the transaction.
   * @param data - The initial payload data to begin a transation.
   * @param context - Object gathering responses of all steps flagged with saveResponse.
   */
  constructor(
    public metadata: TransactionMetadata,
    public data: Record<string, unknown>,
    public context: TransactionContext
  ) {}
}

/**
 * DistributedTransaction represents a distributed transaction, which is a transaction that is composed of multiple steps that are executed in a specific order.
 */

class DistributedTransaction extends EventEmitter {
  public modelId: string
  public transactionId: string
  public runId: string

  private readonly errors: TransactionStepError[] = []
  private readonly context: TransactionContext = new TransactionContext()
  private static keyValueStore: IDistributedTransactionStorage

  /**
   * Store data during the life cycle of the current transaction execution.
   * Store non persistent data such as transformers results, temporary data, etc.
   *
   * @private
   */
  #temporaryStorage = new Map<string, unknown>()

  public static setStorage(storage: IDistributedTransactionStorage) {
    this.keyValueStore = storage
  }

  public static keyPrefix = "dtrx"

  constructor(
    private flow: TransactionFlow,
    public handler: TransactionStepHandler,
    public payload?: any,
    errors?: TransactionStepError[],
    context?: TransactionContext
  ) {
    super()

    this.transactionId = flow.transactionId
    this.modelId = flow.modelId
    this.runId = flow.runId
    if (errors) {
      this.errors = errors
    }

    this.context.payload = payload
    if (context) {
      this.context = { ...context }
    }
  }

  public getFlow() {
    return this.flow
  }

  public getContext() {
    return this.context
  }

  public getErrors(handlerType?: TransactionHandlerType) {
    if (!isDefined(handlerType)) {
      return this.errors
    }

    return this.errors.filter((error) => error.handlerType === handlerType)
  }

  public addError(
    action: string,
    handlerType: TransactionHandlerType,
    error: Error | any
  ) {
    this.errors.push({
      action,
      handlerType,
      error,
    })
  }

  public addResponse(
    action: string,
    handlerType: TransactionHandlerType,
    response: unknown
  ) {
    this.context[handlerType][action] = response
  }

  public hasFinished(): boolean {
    return [
      TransactionState.DONE,
      TransactionState.REVERTED,
      TransactionState.FAILED,
    ].includes(this.getState())
  }

  public getState(): TransactionState {
    return this.getFlow().state
  }

  public get isPartiallyCompleted(): boolean {
    return !!this.getFlow().hasFailedSteps || !!this.getFlow().hasSkippedSteps
  }

  public canInvoke(): boolean {
    return (
      this.getFlow().state === TransactionState.NOT_STARTED ||
      this.getFlow().state === TransactionState.INVOKING
    )
  }

  public canRevert(): boolean {
    return (
      this.getFlow().state === TransactionState.DONE ||
      this.getFlow().state === TransactionState.COMPENSATING
    )
  }

  public hasTimeout(): boolean {
    return !!this.getTimeout()
  }

  public getTimeout(): number | undefined {
    return this.getFlow().options?.timeout
  }

  public async saveCheckpoint(
    ttl = 0
  ): Promise<TransactionCheckpoint | undefined> {
    const options =
      TransactionOrchestrator.getWorkflowOptions(this.modelId) ??
      this.getFlow().options

    if (!options?.store) {
      return
    }

    const key = TransactionOrchestrator.getKeyName(
      DistributedTransaction.keyPrefix,
      this.modelId,
      this.transactionId
    )

    const rawData = this.#serializeCheckpointData()

    await DistributedTransaction.keyValueStore.save(key, rawData, ttl, options)

    return rawData
  }

  public static async loadTransaction(
    modelId: string,
    transactionId: string,
    options?: { isCancelling?: boolean }
  ): Promise<TransactionCheckpoint | null> {
    const key = TransactionOrchestrator.getKeyName(
      DistributedTransaction.keyPrefix,
      modelId,
      transactionId
    )

    const workflowOptions = TransactionOrchestrator.getWorkflowOptions(modelId)

    const loadedData = await DistributedTransaction.keyValueStore.get(key, {
      ...workflowOptions,
      isCancelling: options?.isCancelling,
    })

    if (loadedData) {
      return loadedData
    }

    return null
  }

  public async scheduleRetry(
    step: TransactionStep,
    interval: number
  ): Promise<void> {
    if (this.hasFinished()) {
      return
    }

    await DistributedTransaction.keyValueStore.scheduleRetry(
      this,
      step,
      Date.now(),
      interval
    )
  }

  public async clearRetry(step: TransactionStep): Promise<void> {
    await DistributedTransaction.keyValueStore.clearRetry(this, step)
  }

  public async scheduleTransactionTimeout(interval: number): Promise<void> {
    // schedule transaction timeout only if there are async steps
    if (!this.getFlow().hasAsyncSteps) {
      return
    }

    await DistributedTransaction.keyValueStore.scheduleTransactionTimeout(
      this,
      Date.now(),
      interval
    )
  }

  public async clearTransactionTimeout(): Promise<void> {
    if (!this.getFlow().hasAsyncSteps) {
      return
    }

    await DistributedTransaction.keyValueStore.clearTransactionTimeout(this)
  }

  public async scheduleStepTimeout(
    step: TransactionStep,
    interval: number
  ): Promise<void> {
    // schedule step timeout only if the step is async
    if (!step.definition.async) {
      return
    }

    await this.saveCheckpoint()
    await DistributedTransaction.keyValueStore.scheduleStepTimeout(
      this,
      step,
      Date.now(),
      interval
    )
  }

  public async clearStepTimeout(step: TransactionStep): Promise<void> {
    if (!step.definition.async || step.isCompensating()) {
      return
    }

    await DistributedTransaction.keyValueStore.clearStepTimeout(this, step)
  }

  public setTemporaryData(key: string, value: unknown) {
    this.#temporaryStorage.set(key, value)
  }

  public getTemporaryData(key: string) {
    return this.#temporaryStorage.get(key)
  }

  public hasTemporaryData(key: string) {
    return this.#temporaryStorage.has(key)
  }

  /**
   * Try to serialize the checkpoint data
   * If it fails, it means that the context or the errors are not serializable
   * and we should handle it
   *
   * @internal
   * @returns
   */
  #serializeCheckpointData() {
    const data = new TransactionCheckpoint(
      this.getFlow(),
      this.getContext(),
      this.getErrors()
    )

    const isSerializable = (obj) => {
      try {
        JSON.parse(JSON.stringify(obj))
        return true
      } catch {
        return false
      }
    }

    let rawData
    try {
      rawData = JSON.parse(JSON.stringify(data))
    } catch (e) {
      if (!isSerializable(this.context)) {
        // This is a safe guard, we should never reach this point
        // If we do, it means that the context is not serializable
        // and we should throw an error
        throw new NonSerializableCheckPointError(
          "Unable to serialize context object. Please make sure the workflow input and steps response are serializable."
        )
      }

      if (!isSerializable(this.errors)) {
        const nonSerializableErrors: TransactionStepError[] = []
        for (const error of this.errors) {
          if (!isSerializable(error.error)) {
            error.error = {
              name: error.error.name,
              message: error.error.message,
              stack: error.error.stack,
            }
            nonSerializableErrors.push({
              ...error,
              error: e,
            })
          }
        }

        if (nonSerializableErrors.length) {
          this.errors.push(...nonSerializableErrors)
        }
      }

      const data = new TransactionCheckpoint(
        this.getFlow(),
        this.getContext(),
        this.getErrors()
      )

      rawData = JSON.parse(JSON.stringify(data))
    }

    return rawData
  }
}

DistributedTransaction.setStorage(
  new BaseInMemoryDistributedTransactionStorage()
)

global.DistributedTransaction ??= DistributedTransaction
const GlobalDistributedTransaction =
  global.DistributedTransaction as typeof DistributedTransaction

export {
  GlobalDistributedTransaction as DistributedTransaction,
  DistributedTransaction as DistributedTransactionType,
}
