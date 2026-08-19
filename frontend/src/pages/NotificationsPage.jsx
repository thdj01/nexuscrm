import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Bell,
  CheckCheck,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
} from 'lucide-react';

import API from '../api/axios';

import { useToast } from '../context/ToastContext';

import {
  Button,
  Card,
} from '../components/common/FormComponents';

import Spinner from '../components/common/Spinner';

// UPDATED TYPES
const typeConfig = {
  overdue: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-50',
  },

  project_delay: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },

  order_recieved: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-50',
  },

  info: {
    icon: Info,
    color: 'text-gray-500',
    bg: 'bg-gray-50',
  },
};

const getModuleCardClass = (notification) => {
  if (notification.relatedTicket) {
    return notification.isRead
      ? 'border-purple-400 bg-purple-50'
      : 'border-purple-500 bg-purple-100/70';
  }

  if (notification.relatedProject) {
    return notification.isRead
      ? 'border-green-400 bg-green-50'
      : 'border-green-500 bg-green-100/70';
  }

  if (notification.relatedInquiry) {
    return notification.isRead
      ? 'border-blue-400 bg-blue-50'
      : 'border-blue-500 bg-blue-100/70';
  }

  return notification.isRead
    ? 'border-gray-300 bg-gray-50'
    : 'border-gray-400 bg-gray-100/70';
};

const getRelatedId = (relatedRecord) => {
  if (!relatedRecord) return null;
  return typeof relatedRecord === 'string'
    ? relatedRecord
    : relatedRecord._id || null;
};

const getNotificationDestination = (notification) => {
  const ticketId = getRelatedId(notification.relatedTicket);
  if (ticketId) return `/tickets/${ticketId}`;

  const projectId = getRelatedId(notification.relatedProject);
  if (projectId) return `/projects/${projectId}`;

  const inquiryId = getRelatedId(notification.relatedInquiry);
  if (inquiryId) return `/inquiries/${inquiryId}`;

  return null;
};

const NotificationsPage = () => {
  const toast = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] =
    useState([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [filterRead, setFilterRead] =
    useState('');

  const [page, setPage] =
    useState(1);

  const [pagination, setPagination] =
    useState({
      total: 0,
      pages: 1,
    });

  // Fetch Notifications
  const fetchNotifications =
    useCallback(async (options = {}) => {
      const silent = options?.silent === true;
      if (!silent) setLoading(true);

      try {
        const params = {
          page,
          limit: 15,
        };

        if (filterRead !== '') {
          params.isRead =
            filterRead;
        }

        const { data } =
          await API.get(
            '/notifications',
            { params }
          );

        setNotifications(
          data.data
        );

        setUnreadCount(
          data.unreadCount
        );

        setPagination(
          data.pagination
        );
      } catch {
        if (!silent) {
          toast.error(
            'Failed to load notifications'
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    }, [page, filterRead]);

  useEffect(() => {
    fetchNotifications();

    const refresh = () => fetchNotifications({ silent: true });
    const intervalId = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    setPage(1);
  }, [filterRead]);

  // Mark Read
  const markRead = async (
    id
  ) => {
    try {
      await API.put(
        `/notifications/${id}/read`
      );

      setNotifications(
        (prev) =>
          prev.map((n) =>
            n._id === id
              ? {
                ...n,
                isRead: true,
              }
              : n
          )
      );

      setUnreadCount((c) =>
        Math.max(0, c - 1)
      );
    } catch {
      toast.error(
        'Failed to mark as read'
      );
    }
  };

  const openNotification = async (notification) => {
    const destination = getNotificationDestination(notification);
    if (!destination) return;

    if (!notification.isRead) {
      await markRead(notification._id);
    }

    navigate(destination);
  };

  // Mark All Read
  const markAllRead = async () => {
    try {
      await API.put(
        '/notifications/read-all'
      );

      setNotifications(
        (prev) =>
          prev.map((n) => ({
            ...n,
            isRead: true,
          }))
      );

      setUnreadCount(0);

      toast.success(
        'All notifications marked as read'
      );
    } catch {
      toast.error(
        'Failed to update notifications'
      );
    }
  };

  return (
    <div className="fade-in space-y-4">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-3">

          <h2 className="text-lg font-semibold text-gray-900">
            Notifications
          </h2>

          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              {
                unreadCount
              }{' '}
              unread
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">

          {/* Refresh */}
          <button
            onClick={
              fetchNotifications
            }
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <RefreshCw size={15} />
          </button>

          {/* Mark All Read */}
          {unreadCount >
            0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={
                  markAllRead
                }
              >
                <CheckCheck
                  size={14}
                />

                Mark all read
              </Button>
            )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">

        {[
          ['', 'All'],
          ['false', 'Unread'],
          ['true', 'Read'],
        ].map(
          ([val, label]) => (
            <button
              key={val}
              onClick={() =>
                setFilterRead(
                  val
                )
              }
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filterRead ===
                  val
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* Notifications */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : notifications.length ===
          0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">

            <Bell
              size={40}
              className="mb-3 opacity-30"
            />

            <p className="text-sm">
              No notifications
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">

            {notifications.map(
              (notif) => {
                const cfg =
                  typeConfig[
                  notif.type
                  ] ||
                  typeConfig.info;

                const Icon =
                  cfg.icon;

                const moduleCardClass =
                  getModuleCardClass(
                    notif
                  );

                const destination =
                  getNotificationDestination(
                    notif
                  );

                return (
                  <div
                    key={
                      notif._id
                    }
                    role={destination ? 'link' : undefined}
                    tabIndex={destination ? 0 : undefined}
                    onClick={destination ? () => openNotification(notif) : undefined}
                    onKeyDown={destination ? (event) => {
                      if (event.currentTarget !== event.target) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openNotification(notif);
                      }
                    } : undefined}
                    title={destination ? 'Open related record' : undefined}
                    className={`flex items-start gap-4 rounded-lg border px-5 py-4 transition-colors ${moduleCardClass} ${destination
                        ? 'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2'
                        : ''
                      }`}
                  >

                    {/* Icon */}
                    <div
                      className={`mt-0.5 flex-shrink-0 rounded-xl p-2.5 ${cfg.bg}`}
                    >
                      <Icon
                        size={18}
                        className={
                          cfg.color
                        }
                      />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">

                      <div className="flex items-start justify-between gap-2">

                        <p
                          className={`text-sm font-medium ${!notif.isRead
                              ? 'text-gray-900'
                              : 'text-gray-700'
                            }`}
                        >
                          {
                            notif.title
                          }
                        </p>

                        <div className="flex flex-shrink-0 items-center gap-1.5">

                          {/* Unread Dot */}
                          {!notif.isRead && (
                            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </div>

                      {/* Message */}
                      <p className="mt-0.5 text-sm text-gray-500">
                        {
                          notif.message
                        }
                      </p>

                      {/* Meta */}
                      <div className="mt-2 flex items-center gap-4">

                        {/* Date */}
                        <span className="text-xs text-gray-400">
                          {new Date(
                            notif.createdAt
                          ).toLocaleString(
                            'en-IN',
                            {
                              day: '2-digit',
                              month:
                                'short',
                              year: 'numeric',

                              hour:
                                '2-digit',

                              minute:
                                '2-digit',
                            }
                          )}
                        </span>

                        {/* Inquiry */}
                        {notif.relatedInquiry && (
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                            Inquiry:{' '}
                            {
                              notif
                                .relatedInquiry
                                .inquiryId
                            }
                          </span>
                        )}

                        {/* Project */}
                        {notif.relatedProject && (
                          <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-600">
                            Project:{' '}
                            {
                              notif
                                .relatedProject
                                .projectId
                            }
                          </span>
                        )}



                        {/* Ticket */}
                        {notif.relatedTicket && (
                          <span className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-600">
                            Ticket:{' '}
                            {
                              notif
                                .relatedTicket
                                .ticketId
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-1">

                      {/* Mark Read */}
                      {!notif.isRead && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            markRead(
                              notif._id
                            );
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                          title="Mark as read"
                        >
                          <CheckCheck
                            size={14}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* Load More */}
        {!loading &&
          pagination.pages >
          1 &&
          page <
          pagination.pages && (
            <div className="border-t border-gray-100 px-6 py-4 text-center">

              <button
                onClick={() =>
                  setPage(
                    (p) => p + 1
                  )
                }
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Load more notifications
              </button>
            </div>
          )}
      </Card>
    </div>
  );
};

export default NotificationsPage;
