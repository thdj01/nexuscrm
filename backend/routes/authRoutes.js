const express = require('express');
const router = express.Router();
const { login, getMe, updateProfile, updateProfileAvatar, changePassword } = require('../controllers/authController');
const { avatarUpload } = require('../utils/avatarUpload');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/profile/avatar', protect, avatarUpload.single('avatar'), updateProfileAvatar);
router.put('/change-password', protect, changePassword);

module.exports = router;
