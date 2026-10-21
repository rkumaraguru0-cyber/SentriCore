const express = require("express");

const {
  getIncidents,
  getIncidentById,
  acknowledgeIncident,
  resolveIncident,
} = require("../controllers/incidentController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getIncidents);

router.get("/:id", protect, getIncidentById);

router.patch(
  "/:id/acknowledge",
  protect,
  acknowledgeIncident
);

router.patch(
  "/:id/resolve",
  protect,
  resolveIncident
);

module.exports = router;