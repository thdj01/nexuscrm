# Customer Access-Control Update

## Scope

This update extends the existing Inquiry and Project Employee Access system to the Customer module. No new permissions were applied to Notifications, Timesheet, Tickets, Departments, or other modules.

## Customer permissions

The following action-level permissions are now available:

- `Customers - Create Customer`
- `Customers - View Customer`
- `Customers - Edit Customer`

Customer deletion remains unavailable. No DELETE API or delete button was restored.

## Suggested owner department

SALES receives all three Customer permissions as the department-based suggested access. ADMIN retains all permissions.

For non-admin users, the saved `employeeAccess` checklist remains the final authority. Customer View is not universal in this update.

## Permission behavior

### Create Customer

Allows an employee to:

- Open `/customers/new`.
- Create customers from the Customer page.
- Use embedded New Customer actions in Inquiry, Project, and Ticket forms.

A create-only user can open the new-customer form without being able to browse the Customer list.

### View Customer

Allows an employee to:

- See the Customers sidebar item.
- Open the Customer list and Customer detail pages.
- Load customer records for selection in Inquiry, Project, and Ticket forms.
- Open embedded customer-detail popups.

### Edit Customer

Allows an employee to:

- See Customer edit controls.
- Open existing Customer records in edit mode.
- Submit Customer updates.

Edit Customer automatically includes View Customer because an existing record must be loaded before it can be edited. Removing View Customer also removes Edit Customer in User Management.

## Backend enforcement

Customer routes now require the corresponding permission after JWT authentication:

- `GET /api/customers` -> View Customer
- `GET /api/customers/:id` -> View Customer
- `POST /api/customers` -> Create Customer
- `PUT /api/customers/:id` -> Edit Customer
- `GET /api/customers/cities` -> any Customer Create, View, or Edit permission

Direct unauthorized API requests receive HTTP 403 responses.

## Frontend enforcement

The same permission keys control:

- Customer route access.
- Customer sidebar visibility.
- New Customer button visibility.
- Customer edit button visibility.
- Read-only versus editable Customer detail forms.
- Customer selection, creation, and detail actions embedded in Inquiry, Project, and Ticket forms.
- Customer Employee Access checkboxes in User Management.

## Existing universal permissions

The previous behavior remains unchanged:

- Inquiry View is available to every active authenticated user.
- Project View is available to every active authenticated user.
- Customer View is permission-controlled and suggested for SALES.

## Validation performed

- Frontend production build passed.
- Changed backend files passed Node syntax checks.
- Customer route module loaded successfully.
- Permission assertions passed for SALES defaults, ADMIN access, invalid-key filtering, and Edit-to-View dependency.
- No active application DELETE route or frontend DELETE API call was added.

Live database workflow testing was not performed.
