import {
  CampaignBudgetTypeValues,
  Context,
  DAL,
  FilterablePromotionProps,
  FindConfig,
  InferEntityType,
  InternalModuleDeclaration,
  ModuleJoinerConfig,
  ModulesSdkTypes,
  PromotionDTO,
  PromotionTypes,
} from "@medusajs/framework/types"
import {
  ApplicationMethodAllocation,
  ApplicationMethodTargetType,
  arrayDifference,
  CampaignBudgetType,
  ComputedActions,
  deduplicate,
  InjectManager,
  InjectTransactionManager,
  isDefined,
  isPresent,
  isString,
  MathBN,
  MedusaContext,
  MedusaError,
  MedusaService,
  PromotionStatus,
  PromotionType,
  toMikroORMEntity,
  transformPropertiesToBigNumber,
} from "@medusajs/framework/utils"
import {
  ApplicationMethod,
  Campaign,
  CampaignBudget,
  Promotion,
  PromotionRule,
  PromotionRuleValue,
} from "@models"
import {
  ApplicationMethodRuleTypes,
  CreateApplicationMethodDTO,
  CreateCampaignBudgetDTO,
  CreateCampaignDTO,
  CreatePromotionDTO,
  CreatePromotionRuleDTO,
  UpdateApplicationMethodDTO,
  UpdateCampaignBudgetDTO,
  UpdateCampaignDTO,
  UpdatePromotionDTO,
} from "@types"
import {
  allowedAllocationForQuantity,
  areRulesValidForContext,
  ComputeActionUtils,
  validateApplicationMethodAttributes,
  validatePromotionRuleAttributes,
} from "@utils"
import { joinerConfig } from "../joiner-config"
import { CreatePromotionRuleValueDTO } from "../types/promotion-rule-value"

type InjectedDependencies = {
  baseRepository: DAL.RepositoryService
  promotionService: ModulesSdkTypes.IMedusaInternalService<any>
  applicationMethodService: ModulesSdkTypes.IMedusaInternalService<any>
  promotionRuleService: ModulesSdkTypes.IMedusaInternalService<any>
  promotionRuleValueService: ModulesSdkTypes.IMedusaInternalService<any>
  campaignService: ModulesSdkTypes.IMedusaInternalService<any>
  campaignBudgetService: ModulesSdkTypes.IMedusaInternalService<any>
}

export default class PromotionModuleService
  extends MedusaService<{
    Promotion: { dto: PromotionTypes.PromotionDTO }
    ApplicationMethod: { dto: PromotionTypes.ApplicationMethodDTO }
    Campaign: { dto: PromotionTypes.CampaignDTO }
    CampaignBudget: { dto: PromotionTypes.CampaignBudgetDTO }
    PromotionRule: { dto: PromotionTypes.PromotionRuleDTO }
    PromotionRuleValue: { dto: PromotionTypes.PromotionRuleValueDTO }
  }>({
    Promotion,
    ApplicationMethod,
    Campaign,
    CampaignBudget,
    PromotionRule,
    PromotionRuleValue,
  })
  implements PromotionTypes.IPromotionModuleService
{
  protected baseRepository_: DAL.RepositoryService
  protected promotionService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof Promotion>
  >
  protected applicationMethodService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof ApplicationMethod>
  >
  protected promotionRuleService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof PromotionRule>
  >
  protected promotionRuleValueService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof PromotionRuleValue>
  >
  protected campaignService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof Campaign>
  >
  protected campaignBudgetService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof CampaignBudget>
  >

  constructor(
    {
      baseRepository,
      promotionService,
      applicationMethodService,
      promotionRuleService,
      promotionRuleValueService,
      campaignService,
      campaignBudgetService,
    }: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    // @ts-ignore
    super(...arguments)

    this.baseRepository_ = baseRepository
    this.promotionService_ = promotionService
    this.applicationMethodService_ = applicationMethodService
    this.promotionRuleService_ = promotionRuleService
    this.promotionRuleValueService_ = promotionRuleValueService
    this.campaignService_ = campaignService
    this.campaignBudgetService_ = campaignBudgetService
  }

  __joinerConfig(): ModuleJoinerConfig {
    return joinerConfig
  }

  @InjectManager()
  listActivePromotions(
    filters?: FilterablePromotionProps,
    config?: FindConfig<PromotionDTO>,
    sharedContext?: Context
  ): Promise<PromotionDTO[]> {
    // Ensure we share the same now date across all filters
    const now = new Date()
    const activeFilters = {
      status: PromotionStatus.ACTIVE,
      $or: [
        {
          campaign_id: null,
          ...filters,
        },
        {
          ...filters,
          campaign: {
            ...filters?.campaign,
            $and: [
              {
                $or: [{ starts_at: null }, { starts_at: { $lte: now } }],
              },
              {
                $or: [{ ends_at: null }, { ends_at: { $gt: now } }],
              },
            ],
          },
        },
      ],
    }

    return this.listPromotions(activeFilters, config, sharedContext)
  }

  @InjectTransactionManager()
  async registerUsage(
    computedActions: PromotionTypes.UsageComputedActions[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const promotionCodes = computedActions
      .map((computedAction) => computedAction.code)
      .filter(Boolean)

    const campaignBudgetMap = new Map<string, UpdateCampaignBudgetDTO>()
    const promotionCodeUsageMap = new Map<string, boolean>()

    const existingPromotions = await this.listActivePromotions(
      { code: promotionCodes },
      { relations: ["campaign", "campaign.budget"] },
      sharedContext
    )

    for (const promotion of existingPromotions) {
      if (promotion.campaign?.budget) {
        campaignBudgetMap.set(
          promotion.campaign?.budget.id,
          promotion.campaign?.budget
        )
      }
    }

    const existingPromotionsMap = new Map<string, PromotionTypes.PromotionDTO>(
      existingPromotions.map((promotion) => [promotion.code!, promotion])
    )

    for (let computedAction of computedActions) {
      const promotion = existingPromotionsMap.get(computedAction.code)

      if (!promotion) {
        continue
      }

      const campaignBudget = promotion.campaign?.budget

      if (!campaignBudget) {
        continue
      }

      if (campaignBudget.type === CampaignBudgetType.SPEND) {
        const campaignBudgetData = campaignBudgetMap.get(campaignBudget.id)

        if (!campaignBudgetData) {
          continue
        }

        // Calculate the new budget value
        const newUsedValue = MathBN.add(
          campaignBudgetData.used ?? 0,
          computedAction.amount
        )

        if (
          campaignBudget.limit &&
          MathBN.gt(newUsedValue, campaignBudget.limit)
        ) {
          continue
        } else {
          campaignBudgetData.used = newUsedValue
        }

        campaignBudgetMap.set(campaignBudget.id, campaignBudgetData)
      }

      if (campaignBudget.type === CampaignBudgetType.USAGE) {
        const promotionAlreadyUsed =
          promotionCodeUsageMap.get(promotion.code!) || false

        if (promotionAlreadyUsed) {
          continue
        }

        const newUsedValue = MathBN.add(campaignBudget.used ?? 0, 1)

        // Check if it exceeds the limit and cap it if necessary
        if (
          campaignBudget.limit &&
          MathBN.gt(newUsedValue, campaignBudget.limit)
        ) {
          campaignBudgetMap.set(campaignBudget.id, {
            id: campaignBudget.id,
            used: campaignBudget.limit,
          })
        } else {
          campaignBudgetMap.set(campaignBudget.id, {
            id: campaignBudget.id,
            used: newUsedValue,
          })
        }

        promotionCodeUsageMap.set(promotion.code!, true)
      }
    }

    if (campaignBudgetMap.size > 0) {
      const campaignBudgetsData: UpdateCampaignBudgetDTO[] = []
      for (const [_, campaignBudgetData] of campaignBudgetMap) {
        campaignBudgetsData.push(campaignBudgetData)
      }

      await this.campaignBudgetService_.update(
        campaignBudgetsData,
        sharedContext
      )
    }
  }

  @InjectTransactionManager()
  async revertUsage(
    computedActions: PromotionTypes.UsageComputedActions[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const promotionCodeUsageMap = new Map<string, boolean>()
    const campaignBudgetMap = new Map<string, UpdateCampaignBudgetDTO>()

    const existingPromotions = await this.listActivePromotions(
      {
        code: computedActions
          .map((computedAction) => computedAction.code)
          .filter(Boolean),
      },
      { relations: ["campaign", "campaign.budget"] },
      sharedContext
    )

    for (const promotion of existingPromotions) {
      if (promotion.campaign?.budget) {
        campaignBudgetMap.set(
          promotion.campaign?.budget.id,
          promotion.campaign?.budget
        )
      }
    }

    const existingPromotionsMap = new Map<string, PromotionTypes.PromotionDTO>(
      existingPromotions.map((promotion) => [promotion.code!, promotion])
    )

    for (let computedAction of computedActions) {
      const promotion = existingPromotionsMap.get(computedAction.code)

      if (!promotion) {
        continue
      }

      const campaignBudget = promotion.campaign?.budget

      if (!campaignBudget) {
        continue
      }

      if (campaignBudget.type === CampaignBudgetType.SPEND) {
        const campaignBudgetData = campaignBudgetMap.get(campaignBudget.id)

        if (!campaignBudgetData) {
          continue
        }

        // Calculate new used value and ensure it doesn't go below 0
        const newUsedValue = MathBN.sub(
          campaignBudgetData.used ?? 0,
          computedAction.amount
        )

        campaignBudgetData.used = MathBN.lt(newUsedValue, 0) ? 0 : newUsedValue
        campaignBudgetMap.set(campaignBudget.id, campaignBudgetData)
      }

      if (campaignBudget.type === CampaignBudgetType.USAGE) {
        const promotionAlreadyUsed =
          promotionCodeUsageMap.get(promotion.code!) || false

        if (promotionAlreadyUsed) {
          continue
        }

        // Calculate new used value and ensure it doesn't go below 0
        const newUsedValue = MathBN.sub(campaignBudget.used ?? 0, 1)
        const usedValue = MathBN.lt(newUsedValue, 0) ? 0 : newUsedValue

        campaignBudgetMap.set(campaignBudget.id, {
          id: campaignBudget.id,
          used: usedValue,
        })

        promotionCodeUsageMap.set(promotion.code!, true)
      }
    }

    if (campaignBudgetMap.size > 0) {
      const campaignBudgetsData: UpdateCampaignBudgetDTO[] = []
      for (const [_, campaignBudgetData] of campaignBudgetMap) {
        campaignBudgetsData.push(campaignBudgetData)
      }

      await this.campaignBudgetService_.update(
        campaignBudgetsData,
        sharedContext
      )
    }
  }

  @InjectManager()
  async computeActions(
    promotionCodes: string[],
    applicationContext: PromotionTypes.ComputeActionContext,
    options: PromotionTypes.ComputeActionOptions = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.ComputeActions[]> {
    const { prevent_auto_promotions: preventAutoPromotions } = options
    const computedActions: PromotionTypes.ComputeActions[] = []
    const { items = [], shipping_methods: shippingMethods = [] } =
      applicationContext

    const codeAdjustmentMap = new Map<
      string,
      {
        items: PromotionTypes.ComputeActionAdjustmentLine[]
        shipping: PromotionTypes.ComputeActionAdjustmentLine[]
      }
    >()

    // Pre-process items and shipping methods to build adjustment map efficiently
    for (const item of items) {
      if (!item.adjustments?.length) continue

      for (const adjustment of item.adjustments) {
        if (!isString(adjustment.code)) continue

        if (!codeAdjustmentMap.has(adjustment.code)) {
          codeAdjustmentMap.set(adjustment.code, { items: [], shipping: [] })
        }

        codeAdjustmentMap.get(adjustment.code)!.items.push(adjustment)
      }
    }

    for (const shippingMethod of shippingMethods) {
      if (!shippingMethod.adjustments?.length) continue

      for (const adjustment of shippingMethod.adjustments) {
        if (!isString(adjustment.code)) continue

        if (!codeAdjustmentMap.has(adjustment.code)) {
          codeAdjustmentMap.set(adjustment.code, { items: [], shipping: [] })
        }

        codeAdjustmentMap.get(adjustment.code)!.shipping.push(adjustment)
      }
    }

    const appliedCodes = Array.from(codeAdjustmentMap.keys())

    const methodIdPromoValueMap = new Map<string, number>()

    const automaticPromotions = preventAutoPromotions
      ? []
      : await this.listActivePromotions(
          { is_automatic: true },
          { select: ["code"] },
          sharedContext
        )

    const automaticPromotionCodes = automaticPromotions.map((p) => p.code!)
    const promotionCodesToApply = [
      ...promotionCodes,
      ...automaticPromotionCodes,
      ...appliedCodes,
    ]

    const uniquePromotionCodes = Array.from(new Set(promotionCodesToApply))

    const promotions = await this.listActivePromotions(
      { code: uniquePromotionCodes },
      {
        take: null,
        order: { application_method: { value: "DESC" } },
        relations: [
          "application_method",
          "application_method.target_rules",
          "application_method.target_rules.values",
          "application_method.buy_rules",
          "application_method.buy_rules.values",
          "rules",
          "rules.values",
          "campaign",
          "campaign.budget",
        ],
      },
      sharedContext
    )

    const existingPromotionsMap = new Map<string, PromotionTypes.PromotionDTO>(
      promotions.map((promotion) => [promotion.code!, promotion])
    )

    for (const [code, adjustments] of codeAdjustmentMap.entries()) {
      for (const adjustment of adjustments.items) {
        computedActions.push({
          action: ComputedActions.REMOVE_ITEM_ADJUSTMENT,
          adjustment_id: adjustment.id,
          code,
        })
      }

      for (const adjustment of adjustments.shipping) {
        computedActions.push({
          action: ComputedActions.REMOVE_SHIPPING_METHOD_ADJUSTMENT,
          adjustment_id: adjustment.id,
          code,
        })
      }
    }

    const sortedPromotionsToApply = promotions
      .filter(
        (p) =>
          promotionCodes.includes(p.code!) ||
          automaticPromotionCodes.includes(p.code!)
      )
      .sort(ComputeActionUtils.sortByBuyGetType)

    const eligibleBuyItemMap = new Map<
      string,
      ComputeActionUtils.EligibleItem[]
    >()
    const eligibleTargetItemMap = new Map<
      string,
      ComputeActionUtils.EligibleItem[]
    >()

    for (const promotionToApply of sortedPromotionsToApply) {
      const promotion = existingPromotionsMap.get(promotionToApply.code!)!
      const {
        application_method: applicationMethod,
        rules: promotionRules = [],
      } = promotion

      if (!applicationMethod) {
        continue
      }

      const isPromotionApplicable = areRulesValidForContext(
        promotionRules,
        applicationContext,
        ApplicationMethodTargetType.ORDER
      )

      if (!isPromotionApplicable) {
        continue
      }

      if (promotion.type === PromotionType.BUYGET) {
        const computedActionsForItems =
          ComputeActionUtils.getComputedActionsForBuyGet(
            promotion,
            applicationContext[ApplicationMethodTargetType.ITEMS]!,
            methodIdPromoValueMap,
            eligibleBuyItemMap,
            eligibleTargetItemMap
          )

        computedActions.push(...computedActionsForItems)
      } else if (promotion.type === PromotionType.STANDARD) {
        const isTargetOrder =
          applicationMethod.target_type === ApplicationMethodTargetType.ORDER
        const isTargetItems =
          applicationMethod.target_type === ApplicationMethodTargetType.ITEMS
        const isTargetShipping =
          applicationMethod.target_type ===
          ApplicationMethodTargetType.SHIPPING_METHODS
        const allocationOverride = isTargetOrder
          ? ApplicationMethodAllocation.ACROSS
          : undefined

        if (isTargetOrder || isTargetItems) {
          const computedActionsForItems =
            ComputeActionUtils.getComputedActionsForItems(
              promotion,
              applicationContext[ApplicationMethodTargetType.ITEMS],
              methodIdPromoValueMap,
              allocationOverride
            )

          computedActions.push(...computedActionsForItems)
        }

        if (isTargetShipping) {
          const computedActionsForShippingMethods =
            ComputeActionUtils.getComputedActionsForShippingMethods(
              promotion,
              applicationContext[ApplicationMethodTargetType.SHIPPING_METHODS],
              methodIdPromoValueMap
            )

          computedActions.push(...computedActionsForShippingMethods)
        }
      }
    }

    transformPropertiesToBigNumber(computedActions, { include: ["amount"] })

    return computedActions
  }

  // @ts-expect-error
  async createPromotions(
    data: PromotionTypes.CreatePromotionDTO,
    sharedContext?: Context
  ): Promise<PromotionTypes.PromotionDTO>

  // @ts-expect-error
  async createPromotions(
    data: PromotionTypes.CreatePromotionDTO[],
    sharedContext?: Context
  ): Promise<PromotionTypes.PromotionDTO[]>

  @InjectManager()
  // @ts-expect-error
  async createPromotions(
    data:
      | PromotionTypes.CreatePromotionDTO
      | PromotionTypes.CreatePromotionDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.PromotionDTO | PromotionTypes.PromotionDTO[]> {
    const input = Array.isArray(data) ? data : [data]
    const createdPromotions = await this.createPromotions_(input, sharedContext)

    const promotions = await this.listPromotions(
      { id: createdPromotions.map((p) => p!.id) },
      {
        relations: [
          "application_method",
          "application_method.target_rules",
          "application_method.target_rules.values",
          "application_method.buy_rules",
          "application_method.buy_rules.values",
          "rules",
          "rules.values",
          "campaign",
          "campaign.budget",
        ],
      },
      sharedContext
    )

    return Array.isArray(data) ? promotions : promotions[0]
  }

  @InjectTransactionManager()
  protected async createPromotions_(
    data: PromotionTypes.CreatePromotionDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    const promotionsData: CreatePromotionDTO[] = []
    const applicationMethodsData: CreateApplicationMethodDTO[] = []
    const campaignsData: CreateCampaignDTO[] = []

    const campaignIds = data
      .filter((d) => d.campaign_id)
      .map((d) => d.campaign_id)
      .filter((id): id is string => isString(id))

    const existingCampaigns =
      campaignIds.length > 0
        ? await this.campaignService_.list(
            { id: campaignIds },
            { relations: ["budget"] },
            sharedContext
          )
        : []

    const promotionCodeApplicationMethodDataMap = new Map<
      string,
      PromotionTypes.CreateApplicationMethodDTO
    >()
    const promotionCodeRulesDataMap = new Map<
      string,
      PromotionTypes.CreatePromotionRuleDTO[]
    >()
    const methodTargetRulesMap = new Map<
      string,
      PromotionTypes.CreatePromotionRuleDTO[]
    >()
    const methodBuyRulesMap = new Map<
      string,
      PromotionTypes.CreatePromotionRuleDTO[]
    >()
    const promotionCodeCampaignMap = new Map<
      string,
      PromotionTypes.CreateCampaignDTO
    >()

    for (const {
      application_method: applicationMethodData,
      rules: rulesData,
      campaign: campaignData,
      campaign_id: campaignId,
      ...promotionData
    } of data) {
      promotionCodeApplicationMethodDataMap.set(
        promotionData.code,
        applicationMethodData
      )

      if (rulesData) {
        promotionCodeRulesDataMap.set(promotionData.code, rulesData)
      }

      if (campaignData && campaignId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Provide either the 'campaign' or 'campaign_id' parameter; both cannot be used simultaneously.`
        )
      }

      if (!campaignData && !campaignId) {
        promotionsData.push({ ...promotionData })
        continue
      }

      const existingCampaign = existingCampaigns.find(
        (c) => c.id === campaignId
      )

      if (campaignId && !existingCampaign) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Could not find campaign with id - ${campaignId}`
        )
      }

      const campaignCurrency =
        campaignData?.budget?.currency_code ||
        existingCampaigns.find((c) => c.id === campaignId)?.budget
          ?.currency_code

      if (
        campaignData?.budget?.type === CampaignBudgetType.SPEND &&
        campaignCurrency !== applicationMethodData?.currency_code
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Currency between promotion and campaigns should match`
        )
      }

      if (campaignData) {
        promotionCodeCampaignMap.set(promotionData.code, campaignData)
      }

      promotionsData.push({
        ...promotionData,
        campaign_id: campaignId,
      })
    }

    const createdPromotions = await this.promotionService_.create(
      promotionsData,
      sharedContext
    )

    for (const promotion of createdPromotions) {
      const applMethodData = promotionCodeApplicationMethodDataMap.get(
        promotion.code
      )

      const campaignData = promotionCodeCampaignMap.get(promotion.code)

      if (campaignData) {
        campaignsData.push({
          ...campaignData,
          promotions: [promotion],
        })
      }

      if (applMethodData) {
        const {
          target_rules: targetRulesData = [],
          buy_rules: buyRulesData = [],
          ...applicationMethodWithoutRules
        } = applMethodData
        const applicationMethodData = {
          ...applicationMethodWithoutRules,
          promotion,
        }

        if (
          applicationMethodData.target_type ===
            ApplicationMethodTargetType.ORDER &&
          targetRulesData.length
        ) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Target rules for application method with target type (${ApplicationMethodTargetType.ORDER}) is not allowed`
          )
        }

        if (promotion.type === PromotionType.BUYGET && !buyRulesData.length) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Buy rules are required for ${PromotionType.BUYGET} promotion type`
          )
        }

        if (
          promotion.type === PromotionType.BUYGET &&
          !targetRulesData.length
        ) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Target rules are required for ${PromotionType.BUYGET} promotion type`
          )
        }

        validateApplicationMethodAttributes(applicationMethodData, promotion)

        applicationMethodsData.push(applicationMethodData)

        if (targetRulesData.length) {
          methodTargetRulesMap.set(promotion.id, targetRulesData)
        }

        if (buyRulesData.length) {
          methodBuyRulesMap.set(promotion.id, buyRulesData)
        }
      }

      if (promotionCodeRulesDataMap.has(promotion.code)) {
        await this.createPromotionRulesAndValues_(
          promotionCodeRulesDataMap.get(promotion.code) || [],
          "promotions",
          promotion,
          sharedContext
        )
      }
    }

    const createdApplicationMethods =
      applicationMethodsData.length > 0
        ? await this.applicationMethodService_.create(
            applicationMethodsData,
            sharedContext
          )
        : []

    const createdCampaigns =
      campaignsData.length > 0
        ? await this.createCampaigns(campaignsData, sharedContext)
        : []

    for (const campaignData of campaignsData) {
      const promotions = campaignData.promotions
      const campaign = createdCampaigns.find(
        (c) => c.campaign_identifier === campaignData.campaign_identifier
      )

      if (campaign && promotions && promotions.length) {
        await this.addPromotionsToCampaign(
          { id: campaign.id, promotion_ids: promotions.map((p) => p.id) },
          sharedContext
        )
      }
    }

    for (const applicationMethod of createdApplicationMethods) {
      const targetRules = methodTargetRulesMap.get(
        applicationMethod.promotion.id
      )
      if (targetRules && targetRules.length > 0) {
        await this.createPromotionRulesAndValues_(
          targetRules,
          "method_target_rules",
          applicationMethod,
          sharedContext
        )
      }

      const buyRules = methodBuyRulesMap.get(applicationMethod.promotion.id)
      if (buyRules && buyRules.length > 0) {
        await this.createPromotionRulesAndValues_(
          buyRules,
          "method_buy_rules",
          applicationMethod,
          sharedContext
        )
      }
    }

    return createdPromotions
  }

  // @ts-expect-error
  async updatePromotions(
    data: PromotionTypes.UpdatePromotionDTO,
    sharedContext?: Context
  ): Promise<PromotionTypes.PromotionDTO>

  // @ts-expect-error
  async updatePromotions(
    data: PromotionTypes.UpdatePromotionDTO[],
    sharedContext?: Context
  ): Promise<PromotionTypes.PromotionDTO[]>

  @InjectManager()
  // @ts-expect-error
  async updatePromotions(
    data:
      | PromotionTypes.UpdatePromotionDTO
      | PromotionTypes.UpdatePromotionDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.PromotionDTO | PromotionTypes.PromotionDTO[]> {
    const input = Array.isArray(data) ? data : [data]
    const updatedPromotions = await this.updatePromotions_(input, sharedContext)

    const promotions = await this.listPromotions(
      { id: updatedPromotions.map((p) => p!.id) },
      {
        relations: [
          "application_method",
          "application_method.target_rules",
          "application_method.target_rules.values",
          "rules",
          "rules.values",
          "campaign",
          "campaign.budget",
        ],
      },
      sharedContext
    )

    return Array.isArray(data) ? promotions : promotions[0]
  }

  @InjectTransactionManager()
  protected async updatePromotions_(
    data: PromotionTypes.UpdatePromotionDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    const promotionIds = data.map((d) => d.id)
    const existingPromotions = await this.promotionService_.list(
      { id: promotionIds },
      { relations: ["application_method"] }
    )
    const existingCampaigns = await this.campaignService_.list(
      { id: data.map((d) => d.campaign_id).filter((d) => isPresent(d)) },
      { relations: ["budget"] }
    )

    const existingPromotionsMap = new Map<
      string,
      InferEntityType<typeof Promotion>
    >(existingPromotions.map((promotion) => [promotion.id, promotion]))

    const promotionsData: UpdatePromotionDTO[] = []
    const applicationMethodsData: UpdateApplicationMethodDTO[] = []

    for (const {
      application_method: applicationMethodData,
      campaign_id: campaignId,
      ...promotionData
    } of data) {
      const existingCampaign = existingCampaigns.find(
        (c) => c.id === campaignId
      )
      const existingPromotion = existingPromotionsMap.get(promotionData.id)!
      const existingApplicationMethod = existingPromotion?.application_method
      const promotionCurrencyCode =
        existingApplicationMethod?.currency_code ||
        applicationMethodData?.currency_code

      if (campaignId && !existingCampaign) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Could not find campaign with id ${campaignId}`
        )
      }

      if (
        campaignId &&
        existingCampaign?.budget?.type === CampaignBudgetType.SPEND &&
        existingCampaign.budget.currency_code !== promotionCurrencyCode
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Currency code doesn't match for campaign (${campaignId}) and promotion (${existingPromotion.id})`
        )
      }

      if (isDefined(campaignId)) {
        promotionsData.push({ ...promotionData, campaign_id: campaignId })
      } else {
        promotionsData.push(promotionData)
      }

      if (!applicationMethodData || !existingApplicationMethod) {
        continue
      }

      if (
        applicationMethodData.allocation &&
        !allowedAllocationForQuantity.includes(applicationMethodData.allocation)
      ) {
        applicationMethodData.max_quantity = null
        existingApplicationMethod.max_quantity = null
      }

      validateApplicationMethodAttributes(
        applicationMethodData,
        existingPromotion
      )

      applicationMethodsData.push({
        ...applicationMethodData,
        id: existingApplicationMethod.id,
      })
    }

    const updatedPromotions = this.promotionService_.update(
      promotionsData,
      sharedContext
    )

    if (applicationMethodsData.length) {
      await this.applicationMethodService_.update(
        applicationMethodsData,
        sharedContext
      )
    }

    return updatedPromotions
  }

  @InjectManager()
  // @ts-ignore
  async updatePromotionRules(
    data: PromotionTypes.UpdatePromotionRuleDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.PromotionRuleDTO[]> {
    const updatedPromotionRules = await this.updatePromotionRules_(
      data,
      sharedContext
    )

    return await this.listPromotionRules(
      { id: updatedPromotionRules.map((r) => r.id) },
      { relations: ["values"] },
      sharedContext
    )
  }

  @InjectTransactionManager()
  protected async updatePromotionRules_(
    data: PromotionTypes.UpdatePromotionRuleDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    const promotionRuleIds = data.map((d) => d.id)

    const promotionRules = await this.listPromotionRules(
      { id: promotionRuleIds },
      { relations: ["values"] },
      sharedContext
    )

    const invalidRuleId = arrayDifference(
      deduplicate(promotionRuleIds),
      promotionRules.map((pr) => pr.id)
    )

    if (invalidRuleId.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Promotion rules with id - ${invalidRuleId.join(", ")} not found`
      )
    }

    const promotionRulesMap = new Map<string, PromotionTypes.PromotionRuleDTO>(
      promotionRules.map((pr) => [pr.id, pr])
    )

    const rulesToUpdate: PromotionTypes.UpdatePromotionRuleDTO[] = []
    const ruleValueIdsToDelete: string[] = []
    const ruleValuesToCreate: CreatePromotionRuleValueDTO[] = []

    for (const promotionRuleData of data) {
      const { values, ...rest } = promotionRuleData
      const normalizedValues = Array.isArray(values) ? values : [values]
      rulesToUpdate.push(rest)

      if (isDefined(values)) {
        const promotionRule = promotionRulesMap.get(promotionRuleData.id)!

        ruleValueIdsToDelete.push(...promotionRule.values.map((v) => v.id))
        ruleValuesToCreate.push(
          ...normalizedValues.map((value) => ({
            value,
            promotion_rule: promotionRule,
          }))
        )
      }
    }

    const [updatedRules] = await Promise.all([
      this.promotionRuleService_.update(rulesToUpdate, sharedContext),
      this.promotionRuleValueService_.delete(
        ruleValueIdsToDelete,
        sharedContext
      ),
      this.promotionRuleValueService_.create(ruleValuesToCreate, sharedContext),
    ])

    return updatedRules
  }

  @InjectManager()
  async addPromotionRules(
    promotionId: string,
    rulesData: PromotionTypes.CreatePromotionRuleDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.PromotionRuleDTO[]> {
    const promotion = await this.promotionService_.retrieve(promotionId)

    const createdPromotionRules = await this.createPromotionRulesAndValues_(
      rulesData,
      "promotions",
      promotion,
      sharedContext
    )

    return this.listPromotionRules(
      { id: createdPromotionRules.map((r) => r.id) },
      { relations: ["values"] },
      sharedContext
    )
  }

  @InjectManager()
  async addPromotionTargetRules(
    promotionId: string,
    rulesData: PromotionTypes.CreatePromotionRuleDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.PromotionRuleDTO[]> {
    const promotion = await this.promotionService_.retrieve(promotionId, {
      relations: ["application_method"],
    })

    const applicationMethod = promotion.application_method

    if (!applicationMethod) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `application_method for promotion not found`
      )
    }

    const createdPromotionRules = await this.createPromotionRulesAndValues_(
      rulesData,
      "method_target_rules",
      applicationMethod,
      sharedContext
    )

    return await this.listPromotionRules(
      { id: createdPromotionRules.map((pr) => pr.id) },
      { relations: ["values"] },
      sharedContext
    )
  }

  @InjectManager()
  async addPromotionBuyRules(
    promotionId: string,
    rulesData: PromotionTypes.CreatePromotionRuleDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.PromotionRuleDTO[]> {
    const promotion = await this.promotionService_.retrieve(
      promotionId,
      { relations: ["application_method"] },
      sharedContext
    )

    const applicationMethod = promotion.application_method

    if (!applicationMethod) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `application_method for promotion not found`
      )
    }

    const createdPromotionRules = await this.createPromotionRulesAndValues_(
      rulesData,
      "method_buy_rules",
      applicationMethod,
      sharedContext
    )

    return await this.listPromotionRules(
      { id: createdPromotionRules.map((pr) => pr.id) },
      { relations: ["values"] },
      sharedContext
    )
  }

  @InjectTransactionManager()
  protected async createPromotionRulesAndValues_(
    rulesData: PromotionTypes.CreatePromotionRuleDTO[],
    relationName: "promotions" | "method_target_rules" | "method_buy_rules",
    relation:
      | InferEntityType<typeof Promotion>
      | InferEntityType<typeof ApplicationMethod>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<InferEntityType<typeof PromotionRule>[]> {
    const MikroORMApplicationMethod = toMikroORMEntity(ApplicationMethod)
    const createdPromotionRules: InferEntityType<typeof PromotionRule>[] = []
    const promotion =
      relation instanceof MikroORMApplicationMethod
        ? relation.promotion
        : relation

    if (!rulesData.length) {
      return []
    }

    if (
      relationName === "method_buy_rules" &&
      promotion.type === PromotionType.STANDARD
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Can't add buy rules to a ${PromotionType.STANDARD} promotion`
      )
    }

    validatePromotionRuleAttributes(rulesData)

    for (const ruleData of rulesData) {
      const { values, ...rest } = ruleData
      const promotionRuleData: CreatePromotionRuleDTO = {
        ...rest,
        [relationName]: [relation],
      }

      const [createdPromotionRule] = await this.promotionRuleService_.create(
        [promotionRuleData],
        sharedContext
      )

      createdPromotionRules.push(createdPromotionRule)

      const ruleValues = Array.isArray(values) ? values : [values]
      const promotionRuleValuesData = ruleValues.map((ruleValue) => ({
        value: ruleValue,
        promotion_rule: createdPromotionRule,
      }))

      await this.promotionRuleValueService_.create(
        promotionRuleValuesData,
        sharedContext
      )
    }

    return createdPromotionRules
  }

  @InjectManager()
  async removePromotionRules(
    promotionId: string,
    ruleIds: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.removePromotionRules_(promotionId, ruleIds, sharedContext)
  }

  @InjectTransactionManager()
  protected async removePromotionRules_(
    promotionId: string,
    ruleIds: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const promotion = await this.promotionService_.retrieve(
      promotionId,
      { relations: ["rules"] },
      sharedContext
    )

    const existingRuleIds = promotion.rules.map((rule) => rule.id)
    const idsToRemove = ruleIds.filter((id) => existingRuleIds.includes(id))

    await this.promotionRuleService_.delete(idsToRemove, sharedContext)
  }

  @InjectManager()
  async removePromotionTargetRules(
    promotionId: string,
    ruleIds: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.removeApplicationMethodRules_(
      promotionId,
      ruleIds,
      ApplicationMethodRuleTypes.TARGET_RULES,
      sharedContext
    )
  }

  @InjectManager()
  async removePromotionBuyRules(
    promotionId: string,
    ruleIds: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.removeApplicationMethodRules_(
      promotionId,
      ruleIds,
      ApplicationMethodRuleTypes.BUY_RULES,
      sharedContext
    )
  }

  @InjectTransactionManager()
  protected async removeApplicationMethodRules_(
    promotionId: string,
    ruleIds: string[],
    relation:
      | ApplicationMethodRuleTypes.TARGET_RULES
      | ApplicationMethodRuleTypes.BUY_RULES,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const promotion = await this.promotionService_.retrieve(
      promotionId,
      { relations: [`application_method.${relation}`] },
      sharedContext
    )

    const applicationMethod = promotion.application_method

    if (!applicationMethod) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `application_method for promotion not found`
      )
    }

    const targetRuleIdsToRemove = applicationMethod[relation]
      .filter((rule) => ruleIds.includes(rule.id))
      .map((rule) => rule.id)

    await this.promotionRuleService_.delete(
      targetRuleIdsToRemove,
      sharedContext
    )
  }

  // @ts-expect-error
  async createCampaigns(
    data: PromotionTypes.CreateCampaignDTO,
    sharedContext?: Context
  ): Promise<PromotionTypes.CampaignDTO>

  // @ts-expect-error
  async createCampaigns(
    data: PromotionTypes.CreateCampaignDTO[],
    sharedContext?: Context
  ): Promise<PromotionTypes.CampaignDTO[]>

  @InjectManager()
  // @ts-expect-error
  async createCampaigns(
    data: PromotionTypes.CreateCampaignDTO | PromotionTypes.CreateCampaignDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.CampaignDTO | PromotionTypes.CampaignDTO[]> {
    const input = Array.isArray(data) ? data : [data]
    const createdCampaigns = await this.createCampaigns_(input, sharedContext)

    const campaigns = await this.listCampaigns(
      { id: createdCampaigns.map((p) => p!.id) },
      {
        relations: ["budget", "promotions"],
      },
      sharedContext
    )

    return Array.isArray(data) ? campaigns : campaigns[0]
  }

  @InjectTransactionManager()
  protected async createCampaigns_(
    data: PromotionTypes.CreateCampaignDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    const campaignsData: CreateCampaignDTO[] = []
    const campaignBudgetsData: CreateCampaignBudgetDTO[] = []
    const campaignIdentifierBudgetMap = new Map<
      string,
      CreateCampaignBudgetDTO
    >()

    for (const createCampaignData of data) {
      const { budget: campaignBudgetData, ...campaignData } = createCampaignData

      if (campaignBudgetData) {
        campaignIdentifierBudgetMap.set(
          campaignData.campaign_identifier,
          campaignBudgetData
        )
      }

      campaignsData.push({
        ...campaignData,
      })
    }

    const createdCampaigns = await this.campaignService_.create(
      campaignsData,
      sharedContext
    )

    for (const createdCampaign of createdCampaigns) {
      const campaignBudgetData = campaignIdentifierBudgetMap.get(
        createdCampaign.campaign_identifier
      )

      if (campaignBudgetData) {
        this.validateCampaignBudgetData(campaignBudgetData)

        campaignBudgetsData.push({
          ...campaignBudgetData,
          campaign: createdCampaign.id,
        })
      }
    }

    if (campaignBudgetsData.length) {
      await this.campaignBudgetService_.create(
        campaignBudgetsData,
        sharedContext
      )
    }

    return createdCampaigns
  }

  protected validateCampaignBudgetData(data: {
    type?: CampaignBudgetTypeValues
    currency_code?: string | null
  }) {
    if (!data.type) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Campaign Budget type is a required field`
      )
    }

    if (
      data.type === CampaignBudgetType.SPEND &&
      !isPresent(data.currency_code)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Campaign Budget type is a required field`
      )
    }
  }

  // @ts-expect-error
  async updateCampaigns(
    data: PromotionTypes.UpdateCampaignDTO,
    sharedContext?: Context
  ): Promise<PromotionTypes.CampaignDTO>

  // @ts-expect-error
  async updateCampaigns(
    data: PromotionTypes.UpdateCampaignDTO[],
    sharedContext?: Context
  ): Promise<PromotionTypes.CampaignDTO[]>

  @InjectManager()
  // @ts-expect-error
  async updateCampaigns(
    data: PromotionTypes.UpdateCampaignDTO | PromotionTypes.UpdateCampaignDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PromotionTypes.CampaignDTO | PromotionTypes.CampaignDTO[]> {
    const input = Array.isArray(data) ? data : [data]
    const updatedCampaigns = await this.updateCampaigns_(input, sharedContext)

    const campaigns = await this.listCampaigns(
      { id: updatedCampaigns.map((p) => p!.id) },
      {
        relations: ["budget", "promotions"],
      },
      sharedContext
    )

    return Array.isArray(data) ? campaigns : campaigns[0]
  }

  @InjectTransactionManager()
  protected async updateCampaigns_(
    data: PromotionTypes.UpdateCampaignDTO[],
    @MedusaContext() sharedContext: Context = {}
  ) {
    const campaignIds = data.map((d) => d.id)
    const campaignsData: UpdateCampaignDTO[] = []
    const updateBudgetData: UpdateCampaignBudgetDTO[] = []
    const createBudgetData: CreateCampaignBudgetDTO[] = []

    const existingCampaigns = await this.listCampaigns(
      { id: campaignIds },
      { relations: ["budget"] },
      sharedContext
    )

    const existingCampaignsMap = new Map<string, PromotionTypes.CampaignDTO>(
      existingCampaigns.map((campaign) => [campaign.id, campaign])
    )

    for (const updateCampaignData of data) {
      const { budget: budgetData, ...campaignData } = updateCampaignData
      const existingCampaign = existingCampaignsMap.get(campaignData.id)!

      campaignsData.push(campaignData)

      // Type & currency code of the budget is immutable, we don't allow for it to be updated.
      // If an existing budget is present, we remove the type and currency from being updated
      if (
        (existingCampaign?.budget && budgetData?.type) ||
        budgetData?.currency_code
      ) {
        delete budgetData?.type
        delete budgetData?.currency_code

        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Campaign budget attributes (type, currency_code) are immutable`
        )
      }

      if (budgetData) {
        if (existingCampaign?.budget) {
          updateBudgetData.push({
            id: existingCampaign.budget.id,
            ...budgetData,
          })
        } else {
          createBudgetData.push({
            ...budgetData,
            campaign: existingCampaign.id,
          })
        }
      }
    }

    const updatedCampaigns = await this.campaignService_.update(
      campaignsData,
      sharedContext
    )

    if (updateBudgetData.length) {
      await this.campaignBudgetService_.update(updateBudgetData, sharedContext)
    }

    if (createBudgetData.length) {
      await this.campaignBudgetService_.create(createBudgetData, sharedContext)
    }

    return updatedCampaigns
  }

  @InjectManager()
  async addPromotionsToCampaign(
    data: PromotionTypes.AddPromotionsToCampaignDTO,
    sharedContext?: Context
  ): Promise<{ ids: string[] }> {
    const ids = await this.addPromotionsToCampaign_(data, sharedContext)

    return { ids }
  }

  // TODO:
  // - introduce currency_code to promotion
  // - allow promotions to be queried by currency code
  // - when the above is present, validate adding promotion to campaign based on currency code
  @InjectTransactionManager()
  protected async addPromotionsToCampaign_(
    data: PromotionTypes.AddPromotionsToCampaignDTO,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { id, promotion_ids: promotionIds = [] } = data

    const campaign = await this.campaignService_.retrieve(id, {}, sharedContext)
    const promotionsToAdd = await this.promotionService_.list(
      { id: promotionIds, campaign_id: null },
      { relations: ["application_method"] },
      sharedContext
    )

    const diff = arrayDifference(
      promotionsToAdd.map((p) => p.id),
      promotionIds
    )

    if (diff.length > 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Cannot add promotions (${diff.join(
          ","
        )}) to campaign. These promotions are either already part of a campaign or not found.`
      )
    }

    const promotionsWithInvalidCurrency = promotionsToAdd.filter(
      (promotion) =>
        campaign.budget?.type === CampaignBudgetType.SPEND &&
        promotion.application_method?.currency_code !==
          campaign?.budget?.currency_code
    )

    if (promotionsWithInvalidCurrency.length > 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Cannot add promotions to campaign where currency_code don't match.`
      )
    }

    await this.promotionService_.update(
      promotionsToAdd.map((promotion) => ({
        id: promotion.id,
        campaign_id: campaign.id,
      })),
      sharedContext
    )

    return promotionsToAdd.map((promo) => promo.id)
  }

  @InjectManager()
  async removePromotionsFromCampaign(
    data: PromotionTypes.AddPromotionsToCampaignDTO,
    sharedContext?: Context
  ): Promise<{ ids: string[] }> {
    const ids = await this.removePromotionsFromCampaign_(data, sharedContext)

    return { ids }
  }

  @InjectTransactionManager()
  protected async removePromotionsFromCampaign_(
    data: PromotionTypes.AddPromotionsToCampaignDTO,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { id, promotion_ids: promotionIds = [] } = data

    await this.campaignService_.retrieve(id, {}, sharedContext)
    const promotionsToRemove = await this.promotionService_.list(
      { id: promotionIds },
      {},
      sharedContext
    )

    const diff = arrayDifference(
      promotionsToRemove.map((p) => p.id),
      promotionIds
    )

    if (diff.length > 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Promotions with ids (${diff.join(",")}) not found.`
      )
    }

    await this.promotionService_.update(
      promotionsToRemove.map((promotion) => ({
        id: promotion.id,
        campaign_id: null,
      })),
      sharedContext
    )

    return promotionsToRemove.map((promo) => promo.id)
  }
}
