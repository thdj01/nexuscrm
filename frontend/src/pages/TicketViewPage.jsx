import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Edit2, Ticket } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchTicket } from '../api/ticketService';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/common/Spinner';
import StatusBadge from '../components/common/StatusBadge';
import { Button, Card } from '../components/common/FormComponents';
import { SectionCard, StepProgressBar } from '../components/common/FormComponents.extended';

const buildSections = (ticketType) => {
  const isRR = ticketType === 'Repairing & Replacement';

  return [
    { id: 'ticket-view-section-customer', label: 'Customer', color: 'blue' },
    { id: 'ticket-view-section-info', label: 'Ticket', color: 'orange' },
    { id: 'ticket-view-section-product', label: 'Product', color: 'purple' },
    isRR
      ? { id: 'ticket-view-section-rr', label: 'Repair / Replace', color: 'amber' }
      : { id: 'ticket-view-section-description', label: 'Description', color: 'green' },
  ];
};

const TICKET_STICKY_SCROLL_OFFSET = 145;

const fmtDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtDateTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getCustomerName = (ticket) =>
  ticket?.customer?.customerName ||
  ticket?.customer?.contactPerson ||
  ticket?.customer?.name ||
  '—';

const getAssignedEngineerName = (ticket) =>
  ticket?.assignedTo?.name ||
  ticket?.assignedTo?.email ||
  'Unassigned';

const ReadOnlyField = ({ label, value, className = '' }) => (
  <div className={className}>
    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
      {label}
    </p>
    <p className="min-h-[22px] text-sm font-medium text-gray-800">
      {value || '—'}
    </p>
  </div>
);

const ReadOnlyText = ({ label, value }) => (
  <div>
    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
      {label}
    </p>
    <div className="min-h-[96px] whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800">
      {value || '—'}
    </div>
  </div>
);

const ComingSoonCard = ({ title }) => (
  <Card>
    <div className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">Coming in Phase 2</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
          Coming Soon
        </span>
      </div>
    </div>
  </Card>
);

const TicketViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(0);

  const ticketType = ticket?.ticketType || 'N/A';
  const isRR = ticketType === 'Repairing & Replacement';
  const sections = useMemo(() => buildSections(ticketType), [ticketType]);

  useEffect(() => {
    let active = true;

    const loadTicket = async () => {
      setLoading(true);

      try {
        const data = await fetchTicket(id);
        if (active) setTicket(data);
      } catch {
        toast.error('Failed to load ticket');
        navigate('/tickets');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTicket();

    return () => {
      active = false;
    };
  }, [id, navigate, toast]);

  const syncActiveSection = useCallback(() => {
    let nextActiveSection = 0;

    sections.forEach((section, index) => {
      const el = document.getElementById(section.id);
      if (!el) return;

      const top = el.getBoundingClientRect().top;

      if (top <= TICKET_STICKY_SCROLL_OFFSET + 20) {
        nextActiveSection = index;
      }
    });

    setActiveSection((prev) => (
      prev === nextActiveSection ? prev : nextActiveSection
    ));
  }, [sections]);

  useEffect(() => {
    const main = document.querySelector('main');

    main?.addEventListener('scroll', syncActiveSection, { passive: true });
    window.addEventListener('scroll', syncActiveSection, { passive: true });

    requestAnimationFrame(syncActiveSection);

    return () => {
      main?.removeEventListener('scroll', syncActiveSection);
      window.removeEventListener('scroll', syncActiveSection);
    };
  }, [syncActiveSection, ticket]);

  const scrollToSection = useCallback((index) => {
    const target = document.getElementById(sections[index]?.id);
    if (!target) return;

    const main = document.querySelector('main');

    if (main) {
      const mainRect = main.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      main.scrollTo({
        top:
          main.scrollTop +
          targetRect.top -
          mainRect.top -
          TICKET_STICKY_SCROLL_OFFSET,
        behavior: 'smooth',
      });
    } else {
      window.scrollTo({
        top:
          window.scrollY +
          target.getBoundingClientRect().top -
          TICKET_STICKY_SCROLL_OFFSET,
        behavior: 'smooth',
      });
    }

    setActiveSection(index);
  }, [sections]);

  const goBack = () => {
    navigate('/tickets');
  };

  const goEdit = () => {
    navigate(`/tickets/${ticket._id}/edit`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <Card>
        <div className="p-6 text-center text-sm text-gray-500">
          Ticket not found.
        </div>
      </Card>
    );
  }

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-5 pb-16">
      <div className="sticky top-0 z-20 -mx-4 border-b border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={goBack}
              className="mb-2 flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
            >
              <ChevronLeft size={16} />
              Back to Tickets
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <Ticket size={18} className="text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Ticket {ticket.ticketId ? `— ${ticket.ticketId}` : ''}
              </h2>
              <StatusBadge status={ticket.status} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span>
                Assigned Engineer:{' '}
                <span className="font-medium text-gray-700">
                  {getAssignedEngineerName(ticket)}
                </span>
              </span>
              <span>
                Created:{' '}
                <span className="font-medium text-gray-700">
                  {fmtDateTime(ticket.createdAt)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={goBack}>
              Back to Tickets
            </Button>
            <Button variant="primary" onClick={goEdit}>
              <Edit2 size={16} />
              Edit Ticket
            </Button>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <StepProgressBar
            steps={sections.map(({ label, color }) => ({ label, color }))}
            currentStep={activeSection}
            onStepClick={scrollToSection}
          />
        </div>
      </div>

      <div id="ticket-view-section-customer" className="scroll-mt-32">
        <SectionCard number="1" title="Customer Information" color="blue" active={activeSection === 0}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ReadOnlyField label="Customer" value={getCustomerName(ticket)} />
            <ReadOnlyField label="Contact Person" value={ticket.customer?.contactPerson || ticket.contactPerson} />
            <ReadOnlyField label="Contact Number" value={ticket.customer?.mobileNumber || ticket.contactNumber} />
          </div>
        </SectionCard>
      </div>

      <div id="ticket-view-section-info" className="scroll-mt-32">
        <SectionCard number="2" title="Ticket Information" color="orange" active={activeSection === 1}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReadOnlyField label="Ticket Type" value={ticket.ticketType || 'N/A'} />
              <ReadOnlyField label="Assigned To" value={getAssignedEngineerName(ticket)} />
            </div>

            <div className={!isRR ? 'grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_260px]' : ''}>
              <ReadOnlyField label="Subject" value={ticket.title} />

              {!isRR && (
                <ReadOnlyField label="Support Type" value={ticket.supportType} />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnlyField label="Source" value={ticket.source} />
              <ReadOnlyField label="Priority" value={ticket.priority} />
              <ReadOnlyField label="Department" value={ticket.department} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnlyField label="Status" value={ticket.status} />
              <ReadOnlyField label="Created Date" value={fmtDateTime(ticket.createdAt)} />
              <ReadOnlyField label="Updated Date" value={fmtDateTime(ticket.updatedAt)} />
            </div>
          </div>
        </SectionCard>
      </div>

      <div id="ticket-view-section-product" className="scroll-mt-32">
        <SectionCard number="3" title="Product Information" color="purple" active={activeSection === 2}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ReadOnlyField label="Product Type" value={ticket.product?.productType || 'N/A'} />
            <ReadOnlyField label="Part Number" value={ticket.product?.partNumber} />
            <ReadOnlyField label="Serial Number" value={ticket.product?.serialNumber} />
          </div>
        </SectionCard>
      </div>

      {!isRR ? (
        <div id="ticket-view-section-description" className="scroll-mt-32">
          <SectionCard number="4" title="Description" color="green" active={activeSection === 3}>
            <div className="space-y-4">
              <ReadOnlyText label="Problem Reported" value={ticket.description} />
              <ReadOnlyText label="Additional Description" value={ticket.additionalDescription} />
              <ReadOnlyText label="Resolution" value={ticket.resolution} />
            </div>
          </SectionCard>
        </div>
      ) : (
        <div id="ticket-view-section-rr" className="scroll-mt-32">
          <SectionCard number="4" title="REPAIRING & REPLACEMENT" color="amber" active={activeSection === 3}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                <ReadOnlyField
                  label="Under Warranty"
                  value={ticket.repairReplacement?.underWarranty ? 'Yes' : 'No'}
                />
                <ReadOnlyField
                  label="Repair Status"
                  value={
                    ticket.repairReplacement?.repairStatus ||
                    ticket.repairReplacement?.rrSolutionStatus
                  }
                />
                <ReadOnlyField
                  label="Replacement Serial Number"
                  value={ticket.repairReplacement?.replacementSerialNumber}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField
                  label="Product Received Date"
                  value={fmtDate(
                    ticket.repairReplacement?.productReceivedDate ||
                    ticket.repairReplacement?.receivedDate
                  )}
                />
                <ReadOnlyField
                  label="Date of Replacement"
                  value={fmtDate(
                    ticket.repairReplacement?.dateOfReplacement ||
                    ticket.repairReplacement?.expectedDispatchDate
                  )}
                />
              </div>

              <ReadOnlyText
                label="Inspection Observation"
                value={ticket.repairReplacement?.inspectionObservation}
              />

              <ReadOnlyText
                label="Additional Description"
                value={ticket.additionalDescription}
              />

              <ReadOnlyText
                label="Resolution"
                value={ticket.resolution}
              />
            </div>
          </SectionCard>
        </div>
      )}

      <ComingSoonCard title="Comments" />
      <ComingSoonCard title="Attachments" />
      <ComingSoonCard title="Activity Timeline" />
    </div>
  );
};

export default TicketViewPage;