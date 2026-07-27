const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomerCities,
  getCustomer,
  createCustomer,
  updateCustomer,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission, requireAnyPermission } = require('../middleware/permissionMiddleware');
const { CUSTOMER_PERMISSIONS } = require('../constants/permissions');

router.use(protect);

router.route('/')
  .get(requirePermission(CUSTOMER_PERMISSIONS.VIEW), getCustomers)
  .post(requirePermission(CUSTOMER_PERMISSIONS.CREATE), createCustomer);

router.get(
  '/cities',
  requireAnyPermission(
    CUSTOMER_PERMISSIONS.CREATE,
    CUSTOMER_PERMISSIONS.VIEW,
    CUSTOMER_PERMISSIONS.EDIT
  ),
  getCustomerCities
);

router.route('/:id')
  .get(requirePermission(CUSTOMER_PERMISSIONS.VIEW), getCustomer)
  // updateCustomer performs record-aware authorization so the original
  // customer creator can edit their own customer even without global Edit access.
  .put(updateCustomer);

module.exports = router;
