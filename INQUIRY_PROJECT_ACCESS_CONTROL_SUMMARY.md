# Inquiry and Project Access-Control Update

## Scope

This update changes only the Inquiry and Project permission model, plus the shared User Management checklist required to assign those permissions. Other dashboard modules were not given new permissions.

## Universal view access

Every active authenticated user can:

- View the Inquiry list and Inquiry details.
- View the Project list, Project details, activity pages, planning information, completion history, and project documents already exposed by the existing view pages.

`Inquiries - View Inquiry` and `Projects - View Project` are mandatory universal permissions. They are automatically included in the effective Employee Access list and cannot be unchecked in User Management.

This does not make either module public. Authentication is still required.

## Inquiry permissions

The following actions remain individually controlled:

- `Inquiries - Create Inquiry`
- `Inquiries - Edit Inquiry`
- `Inquiries - Follow-up / Reminder`
- `Inquiries - Commercial Submit`

Suggested owner departments: SALES and ESTIMATION.

Inquiry deletion remains removed. No delete permission or DELETE API was restored.

## Project permissions

The following actions are now individually controlled in both frontend and backend:

- `Projects - Create Project`
- `Projects - Edit Project`
- `Projects - Project Planning Grid`
- `Projects - Add Duplicate Planning Grid`
- `Projects - Update Completion %`
- `Projects - Mark Completed`

Suggested owner departments: DESIGN, AUTOMATION, and PRODUCTION.

### Permission behavior

- **Create Project:** create a new project, convert an Inquiry to a Project, and copy a Project.
- **Edit Project:** edit normal project details and manage project documents.
- **Project Planning Grid:** edit planning-grid structure, tasks, assignments, and dates, and run project delay recalculation.
- **Add Duplicate Planning Grid:** add another planning grid.
- **Update Completion %:** change task statuses and completion values.
- **Mark Completed:** complete the project. This is additionally required when a completion update would move the project to 100% / Completed.

A user with only Project View access sees the Project module in read-only mode. Frontend controls are hidden or disabled, and the backend rejects direct unauthorized API calls.

## Department suggestions and employee overrides

- All departments receive Inquiry View and Project View.
- SALES / ESTIMATION receive suggested Inquiry action permissions.
- DESIGN / AUTOMATION / PRODUCTION receive suggested Project action permissions.
- ADMIN retains all Inquiry and Project permissions.
- The saved `employeeAccess` checklist is the final authority for optional actions.

## Delete API status

No active backend HTTP DELETE routes or frontend DELETE API calls exist in the application source. Archive/activate/deactivate operations that use update requests remain unchanged.

## Validation performed

- Frontend production build passed.
- Changed backend files passed Node syntax checks.
- Inquiry and Project route modules loaded successfully.
- Permission assertions passed for universal view access and department suggestions.
- Search confirmed there are no active application DELETE route declarations or frontend DELETE API calls.

Live database workflow testing was not performed.
