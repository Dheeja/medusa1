curl -X POST '{backend_url}/admin/draft-orders/{id}/edit/shipping-methods/{action_id}' \
-H 'Authorization: Bearer {access_token}' \
-H 'Content-Type: application/json' \
--data-raw '{
  "shipping_option_id": "{value}"
}'