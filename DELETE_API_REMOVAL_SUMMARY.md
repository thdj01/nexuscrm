# Delete API Removal Summary

All active HTTP `DELETE` endpoints were removed from the backend, and related frontend API calls and delete controls were removed to prevent broken actions.

## Removed backend endpoints

- `DELETE /api/customers/:id`
- `DELETE /api/departments/:id`
- `DELETE /api/inquiries/:id`
- `DELETE /api/notifications/:id`
- `DELETE /api/projects/:id`
- `DELETE /api/projects/:id/documents/:documentId`
- `DELETE /api/teams/:id`
- `DELETE /api/teams/:id/members/:userId`
- `DELETE /api/tickets/comments/:commentId`
- `DELETE /api/tickets/:id/attachments/:attachmentId`
- `DELETE /api/timesheet/tasks/:id`
- `DELETE /api/timesheet/tasks/:id/archived`
- `DELETE /api/users/:id`

## Frontend cleanup

Delete API calls and corresponding delete controls were removed from Projects, Notifications, Users, Timesheet list/calendar/admin views, and related API service files. Local form actions such as removing an unsaved row, contact, or pending upload were preserved because they do not call a delete API.

Archive and restore functionality was preserved because those operations use `PATCH` endpoints and do not permanently delete records.

## Validation

- All backend JavaScript files passed `node --check`.
- Every backend route module loaded successfully.
- Frontend production build completed successfully with Vite.
- No active `router.delete`, `API.delete`, or HTTP `DELETE` request declaration remains in the application source.
