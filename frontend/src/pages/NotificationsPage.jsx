import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  Bell,
  CheckCheck,
  Clock,
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
  follow_up: {
    icon: Clock,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },

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

const NotificationsPage = () => {
  const toast = useToast();

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
    useCallback(async () => {
      setLoading(true);

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
        toast.error(
          'Failed to load notifications'
        );
      } finally {
        setLoading(false);
      }
    }, [page, filterRead]);

  useEffect(() => {
    fetchNotifications();
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

  // Priority Badge
  const priorityBadge = {
    High:
      'bg-red-100 text-red-700',

    Medium:
      'bg-amber-100 text-amber-700',

    Low:
      'bg-green-100 text-green-700',
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
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filterRead ===
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
              No follow-ups or notifications
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">

            {notifications.map(
              (notif) => {
                const cfg =
                  typeConfig[
                    notif.type
                  ] ||
                  typeConfig.info;

                const Icon =
                  cfg.icon;

                return (
                  <div
                    key={
                      notif._id
                    }
                    className={`flex items-start gap-4 px-6 py-4 transition-colors ${
                      !notif.isRead
                        ? 'bg-blue-50/40'
                        : ''
                    } ${
                      notif.priority ===
                      'High'
                        ? 'border-l-4 border-red-400'
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
                          className={`text-sm font-medium ${
                            !notif.isRead
                              ? 'text-gray-900'
                              : 'text-gray-700'
                          }`}
                        >
                          {
                            notif.title
                          }
                        </p>

                        <div className="flex flex-shrink-0 items-center gap-1.5">

                          {/* Priority */}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              priorityBadge[
                                notif
                                  .priority
                              ] ||
                              'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {
                              notif.priority
                            }
                          </span>

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
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-1">

                      {/* Mark Read */}
                      {!notif.isRead && (
                        <button
                          onClick={() =>
                            markRead(
                              notif._id
                            )
                          }
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