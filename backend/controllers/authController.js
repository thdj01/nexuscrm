const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { buildUploadedAvatarPath, deleteLocalUploadByUrl } = require('../utils/avatarUpload');
const { resolveEffectiveEmployeeAccess } = require('../utils/accessControl');

const buildAuthUser = async (user) => {
  if (!user) return null;

  const plainUser = typeof user.toObject === 'function' ? user.toObject() : user;

  return {
    _id: plainUser._id,
    name: plainUser.name,
    email: plainUser.email,
    role: plainUser.role,
    phone: plainUser.phone || '',
    avatar: plainUser.avatar || '',
    department: plainUser.department || '',
    hodDepartments: plainUser.hodDepartments || [],
    teamId: plainUser.teamId || null,
    reportsTo: plainUser.reportsTo || null,
    employeeAccess: await resolveEffectiveEmployeeAccess(plainUser),
    isActive: plainUser.isActive,
  };
};

const cleanString = (value) =>
  value === undefined || value === null ? '' : String(value).trim();

const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: cleanString(email).toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: await buildAuthUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -passwordResetToken -passwordResetExpires')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: await buildAuthUser(user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user's own profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const name = cleanString(req.body.name);
    const email = cleanString(req.body.email).toLowerCase();
    const phone = cleanString(req.body.phone);

    if (!name) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existingEmailUser = await User.findOne({
      email,
      _id: { $ne: user._id },
    }).select('_id');

    if (existingEmailUser) {
      return res.status(400).json({ success: false, message: 'Email is already used by another user' });
    }

    user.name = name;
    user.email = email;
    user.phone = phone;

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('-password -passwordResetToken -passwordResetExpires')
      .lean();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: await buildAuthUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Upload/update current user's profile photo
// @route   POST /api/auth/profile/avatar
// @access  Private
const updateProfileAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Profile photo is required' });
    }

    const avatar = buildUploadedAvatarPath(req.file);
    const user = await User.findById(req.user._id);

    if (!user) {
      await deleteLocalUploadByUrl(avatar);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousAvatar = user.avatar;
    user.avatar = avatar;
    await user.save();

    if (previousAvatar && previousAvatar !== avatar) {
      await deleteLocalUploadByUrl(previousAvatar);
    }

    const updatedUser = await User.findById(user._id)
      .select('-password -passwordResetToken -passwordResetExpires')
      .lean();

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      user: await buildAuthUser(updatedUser),
    });
  } catch (error) {
    if (req.file) {
      await deleteLocalUploadByUrl(buildUploadedAvatarPath(req.file));
    }
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, getMe, updateProfile, updateProfileAvatar, changePassword };
