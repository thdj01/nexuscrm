import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Ticket } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import TicketForm from '../components/ticket/TicketForm';
import { fetchTicket } from '../api/ticketService';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/common/Spinner';
import { Card } from '../components/common/FormComponents';
import { StepProgressBar } from '../components/common/FormComponents.extended';
import PageHeader from '../components/common/PageHeader';

const buildSections = (ticketType) => {
  const isRR = ticketType === 'Repairing & Replacement';

  return [
    { id: 'ticket-section-customer', label: 'Customer', color: 'blue' },
    { id: 'ticket-section-info', label: 'Ticket', color: 'orange' },
    { id: 'ticket-section-product', label: 'Product', color: 'purple' },
    isRR
      ? { id: 'ticket-section-rr', label: 'Repair / Replace', color: 'amber' }
      : { id: 'ticket-section-description', label: 'Description', color: 'green' },
  ];
};

const TICKET_STICKY_SCROLL_OFFSET = 125;

const TicketFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const isEdit = Boolean(id);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [activeSection, setActiveSection] = useState(0);
  const [ticketType, setTicketType] = useState('N/A');

  const sections = useMemo(() => buildSections(ticketType), [ticketType]);

  useEffect(() => {
    if (!isEdit) {
      setTicket(null);
      setTicketType('N/A');
      setLoading(false);
      return;
    }

    let active = true;

    const loadTicket = async () => {
      setLoading(true);

      try {
        const data = await fetchTicket(id);

        if (!active) return;

        setTicket(data);
        setTicketType(data?.ticketType || 'N/A');
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
  }, [id, isEdit, navigate, toast]);

  const syncActiveSection = useCallback(() => {
    const markerY = TICKET_STICKY_SCROLL_OFFSET + 80;

    let nextActiveSection = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    sections.forEach((section, index) => {
      const el = document.getElementById(section.id);
      if (!el) return;

      const rect = el.getBoundingClientRect();

      // Pick the section whose card/header is closest to the visible area
      // below the sticky ticket header. This avoids the stepper showing
      // one section behind when the next card is already visible.
      const distance = Math.abs(rect.top - markerY);

      if (distance < smallestDistance) {
        smallestDistance = distance;
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

  const handleSuccess = () => {
    toast.success(isEdit ? 'Ticket updated successfully' : 'Ticket created successfully');
    navigate('/tickets');
  };

  const handleCancel = () => {
    navigate('/tickets');
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isEdit && !ticket) {
    return (
      <Card>
        <div className="p-6 text-center text-sm text-gray-500">
          Ticket not found.
        </div>
      </Card>
    );
  }

  return (
    <div className="fade-in w-full max-w-none space-y-0 pb-0">
      <PageHeader bleed="main" bleedTop={false} contentClassName="px-1 sm:px-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2 transition-colors"
            >
              <ChevronLeft size={16} />
              Back to Tickets
            </button>

            <div className="flex items-center gap-2">
              <Ticket size={18} className="text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">
                {isEdit
                  ? `Edit Ticket${ticket?.ticketId ? ` — ${ticket.ticketId}` : ''}`
                  : 'New Ticket'}
              </h2>
            </div>

            <p className="text-sm text-gray-500 mt-0.5">
              {isEdit
                ? 'Update the ticket details below.'
                : 'Complete all sections. Fields marked * are required.'}
            </p>
          </div>

          <div className="flex w-full justify-end lg:w-auto lg:flex-1">
            <StepProgressBar
              steps={sections.map(({ label, color }) => ({ label, color }))}
              currentStep={activeSection}
              onStepClick={scrollToSection}
            />
          </div>
        </div>
      </PageHeader>

      <TicketForm
        key={isEdit ? ticket?._id : 'new-ticket'}
        initialData={isEdit ? ticket : undefined}
        activeSection={activeSection}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        onTicketTypeChange={setTicketType}
      />
    </div>
  );
};

export default TicketFormPage;