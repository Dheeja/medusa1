/**
 * @schema AdminCreateProduct
 * type: object
 * description: The product's details.
 * x-schemaName: AdminCreateProduct
 * required:
 *   - title
 *   - options
 * properties:
 *   title:
 *     type: string
 *     title: title
 *     description: The product's title.
 *   subtitle:
 *     type: string
 *     title: subtitle
 *     description: The product's subtitle.
 *   description:
 *     type: string
 *     title: description
 *     description: The product's description.
 *   is_giftcard:
 *     type: boolean
 *     title: is_giftcard
 *     description: Whether the product is a gift card.
 *   discountable:
 *     type: boolean
 *     title: discountable
 *     description: Whether the product is discountable.
 *   images:
 *     type: array
 *     description: The product's images.
 *     items:
 *       type: object
 *       description: A product's image details.
 *       required:
 *         - url
 *       properties:
 *         url:
 *           type: string
 *           title: url
 *           description: The image's URL.
 *   thumbnail:
 *     type: string
 *     title: thumbnail
 *     description: The URL of the product's thumbnail.
 *   handle:
 *     type: string
 *     title: handle
 *     description: The product's handle.
 *   status:
 *     type: string
 *     description: The product's status.
 *     enum:
 *       - draft
 *       - proposed
 *       - published
 *       - rejected
 *   type_id:
 *     type: string
 *     title: type_id
 *     description: The ID of the type the product belongs to.
 *   collection_id:
 *     type: string
 *     title: collection_id
 *     description: The ID of the collection the product belongs to.
 *   categories:
 *     type: array
 *     description: The categories the product belongs to.
 *     items:
 *       type: object
 *       description: A category's details.
 *       required:
 *         - id
 *       properties:
 *         id:
 *           type: string
 *           title: id
 *           description: The category's ID.
 *   tags:
 *     type: array
 *     description: The product's tags.
 *     items:
 *       type: object
 *       description: A tag's details.
 *       required:
 *         - id
 *       properties:
 *         id:
 *           type: string
 *           title: id
 *           description: The tag's ID.
 *   options:
 *     type: array
 *     description: The product's options.
 *     items:
 *       $ref: "#/components/schemas/AdminCreateProductOption"
 *   variants:
 *     type: array
 *     description: The product's variants.
 *     items:
 *       $ref: "#/components/schemas/AdminCreateProductVariant"
 *   sales_channels:
 *     type: array
 *     description: The sales channels the product is available in.
 *     items:
 *       type: object
 *       description: A sales channel's details.
 *       required:
 *         - id
 *       properties:
 *         id:
 *           type: string
 *           title: id
 *           description: The sales channel's ID.
 *   weight:
 *     type: number
 *     title: weight
 *     description: The product's weight.
 *   length:
 *     type: number
 *     title: length
 *     description: The product's length.
 *   height:
 *     type: number
 *     title: height
 *     description: The product's height.
 *   width:
 *     type: number
 *     title: width
 *     description: The product's width.
 *   hs_code:
 *     type: string
 *     title: hs_code
 *     description: The product's HS code.
 *   mid_code:
 *     type: string
 *     title: mid_code
 *     description: The product's MID code.
 *   origin_country:
 *     type: string
 *     title: origin_country
 *     description: The product's origin country.
 *   material:
 *     type: string
 *     title: material
 *     description: The product's material.
 *   metadata:
 *     type: object
 *     description: The product's metadata, used to store custom key-value pairs.
 *   external_id:
 *     type: string
 *     title: external_id
 *     description: The ID of the product in an external or third-party system.
 *   shipping_profile_id:
 *     type: string
 *     title: shipping_profile_id
 *     description: The ID of the product's shipping profile.
 * 
*/

