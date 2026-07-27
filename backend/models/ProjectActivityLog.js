const mongoose = require('mongoose');

const projectActivityLogSchema = new mongoose.Schema(
  {
    projectId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName:     { type: String, default: 'System' },
    userAvatar:   { type: String, default: '' },

    actionType:   {
      type: String,
      enum: [
        'created',
        'updated',
        'deleted',
        'status_changed',
        'assignee_changed',
        'end_date_changed',
        'start_date_changed',
        'delay_updated',
        'completed',
        'task_created',
        'task_added',
        'task_updated',
        'task_deleted',
        'task_assigned',
        'task_status_changed',
        'task_completed',
        'commented',
        'whatsapp_sent',
        'whatsapp_failed',
      ],
      required: true,
      index: true,
    },

    fieldChanged: { type: String, default: '' },
    oldValue:     { type: String, default: '' },
    newValue:     { type: String, default: '' },
    description:  { type: String, default: '' },

    // Optional task-level context used by the activity feed and Tasks vs Days graph.
    taskId:        { type: String, default: '', index: true },
    taskTitle:     { type: String, default: '' },
    taskStatus:    { type: String, default: '' },
    gridId:        { type: String, default: '' },
    gridName:      { type: String, default: '' },
    assignedUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedUserName: { type: String, default: '' },
    activityDate:     { type: Date },
  },
  { timestamps: true }
);

projectActivityLogSchema.index({ projectId: 1, createdAt: -1 });
projectActivityLogSchema.index({ projectId: 1, actionType: 1, createdAt: -1 });

module.exports = mongoose.model('ProjectActivityLog', projectActivityLogSchema);