import { HttpTypes } from "@medusajs/framework/types"
import {
  CSVNormalizer,
  Modules,
  productValidators,
} from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { convertCsvToJson } from "../utils"

/**
 * The CSV file content to parse.
 */
export type NormalizeProductCsvV1StepInput = string

export const normalizeCsvToChunksStepId = "normalize-product-csv-to-chunks"

/**
 * This step parses a CSV file holding products to import, returning the chunks
 * to be processed. Each chunk is written to a file using the file provider.
 *
 * @example
 * const data = normalizeCsvToChunksStep("products.csv")
 */
export const normalizeCsvToChunksStep = createStep(
  normalizeCsvToChunksStepId,
  async (fileKey: NormalizeProductCsvV1StepInput, { container }) => {
    const file = container.resolve(Modules.FILE)
    const contents = await file.getAsBuffer(fileKey)

    const csvProducts = convertCsvToJson<
      ConstructorParameters<typeof CSVNormalizer>[0][0]
    >(contents.toString("utf-8"))

    const normalizer = new CSVNormalizer(csvProducts)
    const products = normalizer.proccess()

    const create = Object.keys(products.toCreate).reduce<
      HttpTypes.AdminCreateProduct[]
    >((result, toCreateHandle) => {
      result.push(
        productValidators.CreateProduct.parse(
          products.toCreate[toCreateHandle]
        ) as HttpTypes.AdminCreateProduct
      )
      return result
    }, [])

    const update = Object.keys(products.toUpdate).reduce<
      HttpTypes.AdminUpdateProduct & { id: string }[]
    >((result, toUpdateId) => {
      result.push(
        productValidators.UpdateProduct.parse(products.toUpdate[toUpdateId])
      )
      return result
    }, [])

    const { id } = await file.createFiles({
      filename: `${fileKey}.json`,
      content: JSON.stringify({ create, update }),
      mimeType: "application/json",
    })

    return new StepResponse({
      chunks: [id],
      summary: {
        toCreate: create.length,
        toUpdate: update.length,
      },
    })
  }
)
