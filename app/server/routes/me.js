const express = require('express');
const { send } = require('./util');

// GET /api/me/schedule  (employees only)
// The employee ID comes from the verified token. There is no ID in the URL, query or body, so an
// employee cannot ask for anyone else. Data comes from the latest saved manager roster.
function createMeRouter({ store, logger }) {
  const router = express.Router();

  router.get('/schedule', async (req, res) => {
    if (!store.isUp()) {
      return send(res, 503, 'UNAVAILABLE', 'Your schedule is unavailable right now (database not reachable).');
    }
    try {
      return res.json(await store.getEmployeeSchedule(req.user.employeeId));
    } catch (err) {
      logger.error('schedule_db_error', { requestId: req.id, errorName: err.name });
      return send(res, 503, 'UNAVAILABLE', 'Your schedule is unavailable right now (database error).');
    }
  });

  return router;
}

module.exports = { createMeRouter };
