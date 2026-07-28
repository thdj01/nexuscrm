# Nexus Dashboard Swagger API Files

Generated from the Express routes in the uploaded backend.

## Files

- `nexus-dashboard-openapi.yaml` — recommended for Swagger Editor / SwaggerHub import
- `nexus-dashboard-openapi.json` — equivalent JSON definition
- `api-endpoint-inventory.csv` — searchable endpoint inventory

## Coverage

- **104 API operations**
- JWT bearer authentication
- JSON request bodies
- Inquiry, project, ticket, user and kick-off file uploads
- Query/path parameters
- Request examples for major create operations

## Use in Swagger Editor

1. Start the backend and confirm `http://localhost:5000/api/health` works.
2. Open Swagger Editor or SwaggerHub.
3. Import `nexus-dashboard-openapi.yaml`.
4. Run `POST /api/auth/login`.
5. Copy the returned `token`.
6. Click **Authorize** and paste only the token.
7. Test protected endpoints using **Try it out**.

## Inquiry uploads

For `POST /api/inquiries`, `PUT /api/inquiries/{id}`, and `PATCH /api/inquiries/{id}/status`:

- Choose `application/json` when testing without files.
- Choose `multipart/form-data` when uploading files.
- Put the complete JSON request as text in `_json`.
- Use `attachments` and `bomAttachments` for files.

## Important

The Swagger definition documents what is mounted in `backend/server.js`. Runtime success still depends on MongoDB, environment variables, permissions, seeded users/departments, SMTP credentials, and WhatsApp state.
