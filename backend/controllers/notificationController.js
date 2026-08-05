const Notification = require('../models/Notification');

// @desc Get notifications
// @route GET /api/notifications
// @access Private
const getNotifications = async (
  req,
  res,
  next
) => {
  try {
    const {
      page = 1,
      limit = 20,
      isRead,
    } = req.query;

    // SHOW:
    // user notifications
    // + global notifications
    const query = {
      $or: [
        {
          recipient:
            req.user._id,
        },

        {
          recipient: null,
        },
      ],
    };

    // Filter Read / Unread
    if (
      isRead !== undefined
    ) {
      query.isRead =
        isRead === 'true';
    }

    const skip =
      (Number(page) - 1) *
      Number(limit);

    const [
      notifications,
      total,
      unreadCount,
    ] = await Promise.all([
      Notification.find(query)

        .populate(
          'relatedInquiry',
          'inquiryId customerName'
        )

        .populate(
          'relatedProject',
          'projectId projectName'
        )

        .populate(
          'relatedTicket',
          'ticketId title'
        )

        .sort({
          createdAt: -1,
        })

        .skip(skip)

        .limit(Number(limit)),

      Notification.countDocuments(
        query
      ),

      Notification.countDocuments({
        ...query,
        isRead: false,
      }),
    ]);

    res.json({
      success: true,

      data: notifications,

      unreadCount,

      pagination: {
        total,

        page: Number(page),

        pages: Math.ceil(
          total /
            Number(limit)
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc Mark notification as read
// @route PUT /api/notifications/:id/read
// @access Private
const markAsRead = async (
  req,
  res,
  next
) => {
  try {
    const notification =
      await Notification.findByIdAndUpdate(
        req.params.id,
        {
          isRead: true,
        },
        {
          new: true,
        }
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message:
          'Notification not found',
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc Mark all as read
// @route PUT /api/notifications/read-all
// @access Private
const markAllAsRead = async (
  req,
  res,
  next
) => {
  try {
    await Notification.updateMany(
      {
        $or: [
          {
            recipient:
              req.user._id,
          },

          {
            recipient: null,
          },
        ],

        isRead: false,
      },

      {
        isRead: true,
      }
    );

    res.json({
      success: true,
      message:
        'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};