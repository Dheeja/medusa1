import {
  batchProductsWorkflow,
  batchProductsWorkflowId,
  batchProductVariantsWorkflow,
  batchProductVariantsWorkflowId,
} from "@medusajs/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  IFulfillmentModuleService,
  IProductModuleService,
} from "@medusajs/types"
import { Modules } from "@medusajs/utils"

jest.setTimeout(50000)

medusaIntegrationTestRunner({
  env: {},
  testSuite: ({ getContainer }) => {
    describe("Workflows: Batch Product", () => {
      let appContainer
      let service: IProductModuleService

      let fulfullmentService: IFulfillmentModuleService
      let shippingProfile

      beforeAll(async () => {
        appContainer = getContainer()
        service = appContainer.resolve(Modules.PRODUCT)
        fulfullmentService = appContainer.resolve(Modules.FULFILLMENT)
      })

      beforeEach(async () => {
        shippingProfile = await fulfullmentService.createShippingProfiles({
          name: "Test",
          type: "default",
        })
      })

      describe("batchProductWorkflow", () => {
        describe("compensation", () => {
          it("should cancel created and deleted products if step throws error", async () => {
            const workflow = batchProductsWorkflow(appContainer)

            workflow.appendAction("throw", batchProductsWorkflowId, {
              invoke: async function failStep() {
                throw new Error(
                  `Failed the update product workflow after creating product`
                )
              },
            })

            const product1 = await service.createProducts({ title: "test1" })
            const product2 = await service.createProducts({ title: "test2" })

            const { errors } = await workflow.run({
              input: {
                create: [
                  {
                    title: "test3",
                    shipping_profile_id: shippingProfile.id,
                    options: [{ title: "size", values: ["x"] }],
                  },
                ],
                update: [{ id: product1.id, title: "test1-updated" }],
                delete: [product2.id],
              },
              throwOnError: false,
            })

            expect(errors).toEqual([
              {
                action: "throw",
                handlerType: "invoke",
                error: expect.objectContaining({
                  message: `Failed the update product workflow after creating product`,
                }),
              },
            ])

            const products = await service.listProducts()

            expect(products).toHaveLength(2)
            expect(products).toEqual([
              expect.objectContaining({
                title: "test1",
              }),
              expect.objectContaining({
                title: "test2",
              }),
            ])
          })
        })
      })

      describe("batchVariantWorkflow", () => {
        describe("compensation", () => {
          it("should cancel created and deleted variant if step throws error", async () => {
            const workflow = batchProductVariantsWorkflow(appContainer)

            workflow.appendAction("throw", batchProductVariantsWorkflowId, {
              invoke: async function failStep() {
                throw new Error(`Failed the update product variant workflow`)
              },
            })

            const res = await batchProductsWorkflow(appContainer).run({
              input: {
                create: [
                  {
                    title: "test1",
                    options: [{ title: "size", values: ["x", "l", "m"] }],
                    shipping_profile_id: shippingProfile.id,
                    variants: [
                      {
                        title: "variant1",
                        prices: [{ amount: 100, currency_code: "EUR" }],
                        options: { size: "x" },
                      },
                      {
                        title: "variant2",
                        prices: [{ amount: 100, currency_code: "EUR" }],
                        options: { size: "l" },
                      },
                    ],
                  },
                ],
              },
            })
            const product1 = res.result.created[0]

            const { errors } = await workflow.run({
              input: {
                create: [
                  {
                    title: "variant3",
                    product_id: product1.id,
                    options: { size: "m" },
                    prices: [{ amount: 100, currency_code: "EUR" }],
                  },
                ],
                update: [
                  {
                    id: product1.variants[0].id,
                    product_id: product1.id,
                    title: "variant1-updated",
                  },
                ],
                delete: [product1.variants[1].id],
              },
              throwOnError: false,
            })

            expect(errors).toEqual([
              {
                action: "throw",
                handlerType: "invoke",
                error: expect.objectContaining({
                  message: `Failed the update product variant workflow`,
                }),
              },
            ])

            const product = await service.retrieveProduct(product1.id, {
              relations: ["variants"],
            })

            expect(product.variants).toHaveLength(2)
            expect(product.variants).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  title: "variant1",
                }),
                expect.objectContaining({
                  title: "variant2",
                }),
              ])
            )
          })
        })
      })
    })
  },
})
