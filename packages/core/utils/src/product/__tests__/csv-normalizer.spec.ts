import { join } from "node:path"
import { readFile } from "node:fs/promises"
import { CSVNormalizer } from "../csv-normalizer"

async function loadFixtureFile(fileName: string) {
  return JSON.parse(
    await readFile(join(__dirname, "__fixtures__", fileName), "utf-8")
  )
}

describe("CSV processor", () => {
  it("should error when both Product Id and Handle are missing", async () => {
    const processor = new CSVNormalizer([{}])

    expect(() => processor.proccess()).toThrow(
      "Row 1: Missing product id and handle. One of them are required to process the row"
    )
  })

  it("should process a CSV row", async () => {
    const csvData = await loadFixtureFile("single-row-create.json")
    const processor = new CSVNormalizer(csvData)

    const products = processor.proccess()
    expect(products).toMatchInlineSnapshot(`
      {
        "toCreate": {
          "sweatshirt": {
            "categories": [],
            "description": "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.",
            "discountable": true,
            "handle": "sweatshirt",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-back.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "S",
                ],
              },
            ],
            "sales_channels": [
              {
                "id": "sc_01JSXX3XX2CBE5ZV10K88NR8Q4",
              },
            ],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
            "title": "Medusa Sweatshirt",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXFG4R7PVX55YQCZQPB",
                "manage_inventory": true,
                "options": {
                  "Size": "S",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-S",
                "title": "S",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
        },
        "toUpdate": {},
      }
    `)
  })

  it("should process multiple CSV rows for the same product", async () => {
    const csvData = await loadFixtureFile("same-product-multiple-rows.json")
    const processor = new CSVNormalizer(csvData)

    const products = processor.proccess()
    expect(products).toMatchInlineSnapshot(`
      {
        "toCreate": {
          "sweatshirt": {
            "categories": [],
            "description": "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.",
            "discountable": true,
            "handle": "sweatshirt",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-back.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "M",
                  "L",
                  "XL",
                ],
              },
            ],
            "sales_channels": [
              {
                "id": "sc_01JSXX3XX2CBE5ZV10K88NR8Q4",
              },
            ],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
            "title": "Medusa Sweatshirt",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXG4Z955G5VJ9Z956GY",
                "manage_inventory": true,
                "options": {
                  "Size": "M",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-M",
                "title": "M",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGVMXD6CTKWB3KEAG3",
                "manage_inventory": true,
                "options": {
                  "Size": "L",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-L",
                "title": "L",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGF5JMS0ATYH5VDEGT",
                "manage_inventory": true,
                "options": {
                  "Size": "XL",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-XL",
                "title": "XL",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
        },
        "toUpdate": {},
      }
    `)
  })

  it("should process multiple CSV rows where each variant uses different options", async () => {
    const csvData = await loadFixtureFile(
      "same-product-multiple-variant-options.json"
    )
    const processor = new CSVNormalizer(csvData)

    const products = processor.proccess()
    expect(products).toMatchInlineSnapshot(`
      {
        "toCreate": {
          "sweatshirt": {
            "categories": [],
            "description": "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.",
            "discountable": true,
            "handle": "sweatshirt",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-back.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "M",
                  "L",
                  "XL",
                ],
              },
              {
                "title": "Color",
                "values": [
                  "Black",
                  "White",
                ],
              },
            ],
            "sales_channels": [
              {
                "id": "sc_01JSXX3XX2CBE5ZV10K88NR8Q4",
              },
            ],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
            "title": "Medusa Sweatshirt",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXG4Z955G5VJ9Z956GY",
                "manage_inventory": true,
                "options": {
                  "Size": "M",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-M",
                "title": "M",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGVMXD6CTKWB3KEAG3",
                "manage_inventory": true,
                "options": {
                  "Color": "Black",
                  "Size": "L",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-BLACK",
                "title": "BLACK",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGF5JMS0ATYH5VDEGT",
                "manage_inventory": true,
                "options": {
                  "Color": "White",
                  "Size": "XL",
                },
                "origin_country": "EU",
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-XL",
                "title": "XL",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
        },
        "toUpdate": {},
      }
    `)
  })

  it("should process multiple CSV rows with multiple products and variants", async () => {
    const csvData = await loadFixtureFile(
      "multiple-products-multiple-variants.json"
    )
    const processor = new CSVNormalizer(csvData)

    const products = processor.proccess()
    expect(products).toMatchInlineSnapshot(`
      {
        "toCreate": {
          "shorts": {
            "categories": [],
            "description": "Reimagine the feeling of classic shorts. With our cotton shorts, everyday essentials no longer have to be ordinary.",
            "discountable": true,
            "handle": "shorts",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-back.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "S",
                  "M",
                  "L",
                  "XL",
                ],
              },
            ],
            "sales_channels": [
              {
                "id": "sc_01JSXX3XX2CBE5ZV10K88NR8Q4",
              },
            ],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png",
            "title": "Medusa Shorts",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGD1Q1AEYEPX45DHZP",
                "manage_inventory": true,
                "options": {
                  "Size": "S",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHORTS-S",
                "title": "S",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXG0BZ6AWZPHYJWS18J",
                "manage_inventory": true,
                "options": {
                  "Size": "M",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHORTS-M",
                "title": "M",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGKYAJ34RK1VQNVSTX",
                "manage_inventory": true,
                "options": {
                  "Size": "L",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHORTS-L",
                "title": "L",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGNJYQQT30RCBA1XBD",
                "manage_inventory": true,
                "options": {
                  "Size": "XL",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHORTS-XL",
                "title": "XL",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
          "sweatpants": {
            "categories": [],
            "description": "Reimagine the feeling of classic sweatpants. With our cotton sweatpants, everyday essentials no longer have to be ordinary.",
            "discountable": true,
            "handle": "sweatpants",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-back.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "S",
                  "M",
                  "L",
                  "XL",
                ],
              },
            ],
            "sales_channels": [
              {
                "id": "sc_01JSXX3XX2CBE5ZV10K88NR8Q4",
              },
            ],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
            "title": "Medusa Sweatpants",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGYYNY3F72R0KY506M",
                "manage_inventory": true,
                "options": {
                  "Size": "S",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATPANTS-S",
                "title": "S",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGTEQ7CA8F1WPM99HK",
                "manage_inventory": true,
                "options": {
                  "Size": "M",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATPANTS-M",
                "title": "M",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGACM79ES7FK2GZV9A",
                "manage_inventory": true,
                "options": {
                  "Size": "L",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATPANTS-L",
                "title": "L",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGC9S0APDPN26MMYV5",
                "manage_inventory": true,
                "options": {
                  "Size": "XL",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATPANTS-XL",
                "title": "XL",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
          "t-shirt": {
            "categories": [],
            "description": "Reimagine the feeling of a classic T-shirt. With our cotton T-shirts, everyday essentials no longer have to be ordinary.",
            "discountable": true,
            "handle": "t-shirt",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-back.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-back.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "S",
                  "M",
                  "L",
                  "XL",
                ],
              },
              {
                "title": "Color",
                "values": [
                  "Black",
                  "White",
                ],
              },
            ],
            "sales_channels": [
              {
                "id": "sc_01JSXX3XX2CBE5ZV10K88NR8Q4",
              },
            ],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
            "title": "Medusa T-Shirt",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXFRB2MPHAQG05YXG8V",
                "manage_inventory": true,
                "options": {
                  "Color": "Black",
                  "Size": "S",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHIRT-S-BLACK",
                "title": "S / Black",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXFQ44Q0QTE591BWT51",
                "manage_inventory": true,
                "options": {
                  "Color": "White",
                  "Size": "S",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHIRT-S-WHITE",
                "title": "S / White",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXF16D95TZT4F511AYS",
                "manage_inventory": true,
                "options": {
                  "Color": "Black",
                  "Size": "M",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHIRT-M-BLACK",
                "title": "M / Black",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXFPDHC22WPXJAJ1D14",
                "manage_inventory": true,
                "options": {
                  "Color": "White",
                  "Size": "M",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHIRT-M-WHITE",
                "title": "M / White",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXFWV657RM1ZBX8DSBB",
                "manage_inventory": true,
                "options": {
                  "Color": "Black",
                  "Size": "L",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHIRT-L-BLACK",
                "title": "L / Black",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXF2JWK1RYG8V2Q2PWT",
                "manage_inventory": true,
                "options": {
                  "Color": "White",
                  "Size": "L",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHIRT-L-WHITE",
                "title": "L / White",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXFA50F2R2F8HBVTQBP",
                "manage_inventory": true,
                "options": {
                  "Color": "Black",
                  "Size": "XL",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHIRT-XL-BLACK",
                "title": "XL / Black",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXFY0W5DE9HD4C7YD53",
                "manage_inventory": true,
                "options": {
                  "Color": "White",
                  "Size": "XL",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SHIRT-XL-WHITE",
                "title": "XL / White",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
        },
        "toUpdate": {
          "prod_01JSXX3ZVW4M4RS0NH4MSWCQWA": {
            "categories": [],
            "description": "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.",
            "discountable": true,
            "handle": "sweatshirt",
            "id": "prod_01JSXX3ZVW4M4RS0NH4MSWCQWA",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-back.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "S",
                  "M",
                  "L",
                  "XL",
                ],
              },
            ],
            "sales_channels": [
              {
                "id": "sc_01JSXX3XX2CBE5ZV10K88NR8Q4",
              },
            ],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
            "title": "Medusa Sweatshirt",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXFG4R7PVX55YQCZQPB",
                "manage_inventory": true,
                "options": {
                  "Size": "S",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-S",
                "title": "S",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXG4Z955G5VJ9Z956GY",
                "manage_inventory": true,
                "options": {
                  "Size": "M",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-M",
                "title": "M",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGVMXD6CTKWB3KEAG3",
                "manage_inventory": true,
                "options": {
                  "Size": "L",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-L",
                "title": "L",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JSXX3ZXGF5JMS0ATYH5VDEGT",
                "manage_inventory": true,
                "options": {
                  "Size": "XL",
                },
                "prices": [
                  {
                    "amount": 10,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 15,
                    "currency_code": "usd",
                  },
                ],
                "sku": "SWEATSHIRT-XL",
                "title": "XL",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
          "prod_01JT598HEWAE555V0A6BD602MG": {
            "categories": [],
            "description": "Every programmer's best friend.",
            "discountable": true,
            "handle": "coffee-mug-v3",
            "id": "prod_01JT598HEWAE555V0A6BD602MG",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/coffee-mug.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "One Size",
                ],
              },
            ],
            "sales_channels": [],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/coffee-mug.png",
            "title": "Medusa Coffee Mug",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JT598HFWBE6ZYXWWVS1E5HFM",
                "manage_inventory": true,
                "options": {
                  "Size": "One Size",
                },
                "prices": [
                  {
                    "amount": 1000,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 1200,
                    "currency_code": "usd",
                  },
                ],
                "title": "One Size",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
          "prod_01JT598HEX26EHDG7SRK37Q3FG": {
            "categories": [],
            "description": "Reimagine the feeling of classic sweatpants. With our cotton sweatpants, everyday essentials no longer have to be ordinary.",
            "discountable": true,
            "handle": "sweatpants-v2",
            "id": "prod_01JT598HEX26EHDG7SRK37Q3FG",
            "images": [
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
              },
              {
                "url": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-back.png",
              },
            ],
            "options": [
              {
                "title": "Size",
                "values": [
                  "S",
                  "M",
                  "L",
                  "XL",
                ],
              },
            ],
            "sales_channels": [],
            "status": "published",
            "tags": [],
            "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
            "title": "Medusa Sweatpants",
            "variants": [
              {
                "allow_backorder": false,
                "id": "variant_01JT598HFWM8NWRS6QPPQZG0C6",
                "manage_inventory": true,
                "options": {
                  "Size": "S",
                },
                "prices": [
                  {
                    "amount": 2950,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 3350,
                    "currency_code": "usd",
                  },
                ],
                "title": "S",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JT598HFW9HED0YJ2A40DHWMK",
                "manage_inventory": true,
                "options": {
                  "Size": "M",
                },
                "prices": [
                  {
                    "amount": 2950,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 3350,
                    "currency_code": "usd",
                  },
                ],
                "title": "M",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JT598HFX2PASE49T503JJ9SB",
                "manage_inventory": true,
                "options": {
                  "Size": "L",
                },
                "prices": [
                  {
                    "amount": 2950,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 3350,
                    "currency_code": "usd",
                  },
                ],
                "title": "L",
                "variant_rank": 0,
              },
              {
                "allow_backorder": false,
                "id": "variant_01JT598HFX1KMJ9MYFJBHT422N",
                "manage_inventory": true,
                "options": {
                  "Size": "XL",
                },
                "prices": [
                  {
                    "amount": 2950,
                    "currency_code": "eur",
                  },
                  {
                    "amount": 3350,
                    "currency_code": "usd",
                  },
                ],
                "title": "XL",
                "variant_rank": 0,
              },
            ],
            "weight": 400,
          },
        },
      }
    `)
  })
})
