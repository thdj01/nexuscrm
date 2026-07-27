# Inquiry Access Control Update

Only the Inquiry permission set from the supplied access matrix has been implemented.

## Inquiry permissions

- `Inquiries - Create Inquiry`
- `Inquiries - View Inquiry`
- `Inquiries - Edit Inquiry`
- `Inquiries - Follow-up / Reminder`
- `Inquiries - Commercial Submit`

`Inquiries - Delete Inquiry` was not restored. All delete APIs remain removed.

## Backend enforcement

- Inquiry list requires View Inquiry.
- Inquiry details require View Inquiry or Edit Inquiry.
- New Inquiry requires Create Inquiry.
- Creating an inquiry directly at a non-New status also requires Edit Inquiry.
- Editing data and changing status require Edit Inquiry.
- Commercial BOM Submission additionally requires Commercial Submit.
- Follow-up reminder read/update actions require Follow-up / Reminder.
- Inquiry kick-off scheduling/completion requires Edit Inquiry.
- Permissions are loaded from the authenticated user's `employeeAccess` field for every request.
- Admin retains all Inquiry permissions.

## Frontend enforcement

- Inquiry sidebar visibility follows View/Create permission.
- Inquiry routes are permission-protected.
- New, Edit, status workflow, commercial submission, follow-up, and kick-off controls are shown only when allowed.
- View-only users receive read-only Inquiry pages.
- User Management contains an Inquiry Employee Access checklist.
- SALES and ESTIMATION receive the complete Inquiry permission set as the suggested default; an admin can change each user's checkboxes individually.

## Existing users

For backward compatibility, users without a saved `employeeAccess` field temporarily receive the suggested Inquiry permissions when they belong to SALES or ESTIMATION. Once an administrator saves their checklist, the saved selection becomes authoritative. An explicitly saved empty list means no Inquiry access.

## Validation completed

- Modified backend files passed `node --check`.
- Inquiry and kick-off routers loaded successfully.
- Inquiry permission helper tests passed for Admin, SALES default, explicit denial, and limited View access.
- Frontend production build passed.
- No HTTP DELETE routes were reintroduced.
