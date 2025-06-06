/**
 * @oas [delete] /admin/product-types/{id}
 * operationId: DeleteProductTypesId
 * summary: Delete a Product Type
 * description: Delete a product type. This doesn't delete products of this type.
 * x-authenticated: true
 * parameters:
 *   - name: id
 *     in: path
 *     description: The product type's ID.
 *     required: true
 *     schema:
 *       type: string
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS SDK
 *     source: |-
 *       import Medusa from "@medusajs/js-sdk"
 * 
 *       export const sdk = new Medusa({
 *         baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
 *         debug: import.meta.env.DEV,
 *         auth: {
 *           type: "session",
 *         },
 *       })
 * 
 *       sdk.admin.productType.delete("ptyp_123")
 *       .then(({ deleted }) => {
 *         console.log(deleted)
 *       })
 *   - lang: Shell
 *     label: cURL
 *     source: |-
 *       curl -X DELETE '{backend_url}/admin/product-types/{id}' \
 *       -H 'Authorization: Bearer {access_token}'
 * tags:
 *   - Product Types
 * responses:
 *   "200":
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminProductTypeDeleteResponse"
 *   "400":
 *     $ref: "#/components/responses/400_error"
 *   "401":
 *     $ref: "#/components/responses/unauthorized"
 *   "404":
 *     $ref: "#/components/responses/not_found_error"
 *   "409":
 *     $ref: "#/components/responses/invalid_state_error"
 *   "422":
 *     $ref: "#/components/responses/invalid_request_error"
 *   "500":
 *     $ref: "#/components/responses/500_error"
 * x-workflow: deleteProductTypesWorkflow
 * x-events:
 *   - name: product-type.deleted
 *     payload: |-
 *       ```ts
 *       [{
 *         id, // The ID of the product type
 *       }]
 *       ```
 *     description: Emitted when product types are deleted.
 *     deprecated: false
 * 
*/

