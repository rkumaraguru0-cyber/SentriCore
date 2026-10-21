const express = require("express");

const {
  getSecurityEvents,
  acknowledgeSecurityEvent,
  resolveSecurityEvent
} = require("../controllers/securityEventController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getSecurityEvents);

router.patch(
  "/:id/acknowledge",
  protect,
  acknowledgeSecurityEvent
);

router.patch(
  "/:id/resolve",
  protect,
  resolveSecurityEvent
);

module.exports = router;