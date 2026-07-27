const statusColors = {
  // Inquiry statuses
  New: 'bg-green-100 text-green-800',
  'Technical Evaluation': 'bg-blue-100 text-blue-800',
  'Technical BoM Submitted': 'bg-indigo-100 text-indigo-800',
  'Technical BOM Submitted': 'bg-indigo-100 text-indigo-800',
  'BoM Approval Pending': 'bg-sky-100 text-sky-800',
  'Technical BOM Approval': 'bg-sky-100 text-sky-800',
  'Commercial BOM Submission': 'bg-purple-100 text-purple-800',
  'Order Won': 'bg-emerald-100 text-emerald-900',
  'Order Lost': 'bg-red-100 text-red-800',
  'Inquiry Hold': 'bg-yellow-100 text-yellow-800',
  Revision: 'bg-orange-100 text-orange-800',

  // Inquiry legacy statuses
  'In Progress': 'bg-blue-100 text-blue-800',
  'Commercial Discussion': 'bg-purple-100 text-purple-800',
  'Commercial Submit': 'bg-purple-100 text-purple-800',
  'Technical Submit': 'bg-indigo-100 text-indigo-800',
  'Order Received': 'bg-emerald-100 text-emerald-900',
  'Inquiry Lost': 'bg-red-100 text-red-800',

  // Optional legacy fallback
  'Under Discussion': 'bg-blue-100 text-blue-800',
  Negotiation: 'bg-orange-100 text-orange-800',
  'Quotation Submit': 'bg-purple-100 text-purple-800',
  'Order Recieved': 'bg-emerald-100 text-emerald-900',
  'Inq. Lost': 'bg-red-100 text-red-800',

  // Project statuses
  Planning: 'bg-blue-100 text-blue-800',
  Design: 'bg-indigo-100 text-indigo-800',
  Production: 'bg-orange-100 text-orange-800',
  Testing: 'bg-yellow-100 text-yellow-800',
  Dispatch: 'bg-cyan-100 text-cyan-800',
  Installation: 'bg-purple-100 text-purple-800',
  won: 'bg-green-100 text-green-800',

  // Ticket statuses
  Assigned:                'bg-sky-100 text-sky-800',
  Working:                 'bg-violet-100 text-violet-800',
  'Customer Side Pending': 'bg-orange-100 text-orange-800',
  Closed:                  'bg-emerald-100 text-emerald-900',
  Void:                    'bg-gray-200 text-gray-600',

  // Priority
  Critical: 'bg-red-200 text-red-900',
  High: 'bg-red-100 text-red-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-green-100 text-green-800',

  Pending: 'bg-orange-100 text-orange-800',
  Partial: 'bg-blue-100 text-blue-800',

  admin: 'bg-purple-100 text-purple-800',
  estimator: 'bg-blue-100 text-blue-800',
  salesperson: 'bg-green-100 text-green-800',
};
// Display label overrides
const statusLabels = {
  won: 'Achieved Project',

  'Under Discussion': 'Technical Evaluation',
  'In Progress': 'Technical Evaluation',
  'Technical Submit': 'Technical BoM Submitted',
  'Technical BOM Submission': 'Technical BoM Submitted',
  'Technical BoM Submission': 'Technical BoM Submitted',
  'Technical BOM Submitted': 'Technical BoM Submitted',
  'Technical BoM Submitted': 'Technical BoM Submitted',
  'BoM Submitted': 'Technical BoM Submitted',
  'BOM Submitted': 'Technical BoM Submitted',
  'Bom Submitted': 'Technical BoM Submitted',
  'BOM SUBMITTED': 'Technical BoM Submitted',
  Negotiation: 'Commercial BOM Submission',
  'Commercial Discussion': 'Commercial BOM Submission',
  'Commercial Submit': 'Commercial BOM Submission',
  'Technical BOM Approval': 'BoM Approval Pending',
  'Quotation Submit': 'Commercial BOM Submission',
  'Order Received': 'Order Won',
  'Order Recieved': 'Order Won',
  'Inquiry Lost': 'Order Lost',
  'Inq. Lost': 'Order Lost',
};

const statusLabelsByKey = {
  technicalbomsubmission: 'Technical BoM Submitted',
  technicalbomsubmitted: 'Technical BoM Submitted',
  bomsubmitted: 'Technical BoM Submitted',
  technicalbomapproval: 'BoM Approval Pending',
};

const getStatusKey = (status = '') => String(status || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const StatusBadge = ({ status, size = 'xs' }) => {
  const color = statusColors[status] || 'bg-gray-100 text-gray-800';
 const sizeClass = size === 'xs'
  ? 'text-xs px-1.5 py-0 leading-none'
  : 'text-xs px-1.5 py-0 leading-none';
  const label = statusLabels[status] || statusLabelsByKey[getStatusKey(status)] || status;

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${color} ${sizeClass} whitespace-nowrap`}>
      {label}
    </span>
  );
};

export default StatusBadge;
