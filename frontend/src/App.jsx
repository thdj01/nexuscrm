import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './routes/ProtectedRoute';
import MainLayout from './layouts/MainLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InquiriesPage from './pages/InquiriesPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectActivityPage from './pages/ProjectActivityPage';
import ProjectDocumentPreviewPage from './pages/ProjectDocumentPreviewPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import TicketsPage from './pages/TicketsPage';
import TicketFormPage from './pages/TicketFormPage';
import NotificationsPage from './pages/NotificationsPage';
import UsersPage from './pages/UsersPage';
import DepartmentPage from './pages/DepartmentPage';
import IntegrationSettingsPage from './pages/IntegrationSettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import ElectricalPanelInquiryPage from './pages/ElectricalPanelInquiryPage';
import {
  CUSTOMER_PERMISSIONS,
  INQUIRY_PERMISSIONS,
  PROJECT_PERMISSIONS,
} from './constants/permissions';

import TimesheetPage from './pages/TimesheetPage';
import TimesheetAdminPage from './pages/TimesheetAdminPage';

const TimesheetListView = lazy(() => import('./components/timesheet/TimesheetListView'));
const TimesheetKanbanView = lazy(() => import('./components/timesheet/TimesheetKanbanView'));
const TimesheetCalendarView = lazy(() => import('./components/timesheet/TimesheetCalendarView'));

const ViewFallback = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
  </div>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardPage />} />

              <Route element={<ProtectedRoute permission={INQUIRY_PERMISSIONS.VIEW} />}>
                <Route path="/inquiries" element={<InquiriesPage />} />
                <Route path="/inquiries/:id" element={<ElectricalPanelInquiryPage />} />
              </Route>

              <Route element={<ProtectedRoute permission={INQUIRY_PERMISSIONS.CREATE} />}>
                <Route path="/inquiries/new" element={<ElectricalPanelInquiryPage />} />
              </Route>

              <Route element={<ProtectedRoute permission={INQUIRY_PERMISSIONS.EDIT} />}>
                <Route path="/inquiries/:id/edit" element={<ElectricalPanelInquiryPage />} />
              </Route>

              <Route element={<ProtectedRoute permission={PROJECT_PERMISSIONS.VIEW} />}>
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/projects/:id/activity" element={<ProjectActivityPage />} />
                <Route path="/projects/:id/documents/preview" element={<ProjectDocumentPreviewPage />} />
              </Route>

              <Route element={<ProtectedRoute permission={PROJECT_PERMISSIONS.CREATE} />}>
                <Route path="/projects/new" element={<ProjectDetailPage />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    anyPermissions={[
                      PROJECT_PERMISSIONS.EDIT,
                      PROJECT_PERMISSIONS.PLANNING_GRID,
                      PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
                      PROJECT_PERMISSIONS.UPDATE_COMPLETION,
                      PROJECT_PERMISSIONS.MARK_COMPLETED,
                    ]}
                  />
                }
              >
                <Route path="/projects/:id/edit" element={<ProjectDetailPage />} />
              </Route>
              <Route element={<ProtectedRoute permission={CUSTOMER_PERMISSIONS.VIEW} />}>
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:id" element={<CustomerDetailPage />} />
              </Route>

              <Route element={<ProtectedRoute permission={CUSTOMER_PERMISSIONS.CREATE} />}>
                <Route path="/customers/new" element={<CustomerDetailPage />} />
              </Route>

              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/new" element={<TicketFormPage />} />
              <Route path="/tickets/:id" element={<TicketFormPage />} />
              <Route path="/tickets/:id/edit" element={<TicketFormPage />} />

              <Route path="/notifications" element={<NotificationsPage />} />

              <Route path="/timesheet" element={<TimesheetPage />}>
                <Route path="admin" element={<TimesheetAdminPage />} />
                <Route index element={<Navigate to="kanban" replace />} />
                <Route
                  path="list"
                  element={
                    <Suspense fallback={<ViewFallback />}>
                      <TimesheetListView />
                    </Suspense>
                  }
                />
                <Route
                  path="kanban"
                  element={
                    <Suspense fallback={<ViewFallback />}>
                      <TimesheetKanbanView />
                    </Suspense>
                  }
                />
                <Route
                  path="calendar"
                  element={
                    <Suspense fallback={<ViewFallback />}>
                      <TimesheetCalendarView />
                    </Suspense>
                  }
                />
              </Route>
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route element={<MainLayout />}>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/masters/departments" element={<DepartmentPage />} />
              <Route path="/masters/integrations" element={<IntegrationSettingsPage />} />
            </Route>
          </Route>

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;