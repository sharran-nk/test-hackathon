const express = require('express');
const rules = require('../rules/index');
const { InputError, parseRoster } = require('../parse/validate');

// POST /api/check  { employees: "<csv>", shifts: "<csv>", leave: "<csv, optional>" }
// Returns the findings and a summary. If MongoDB is up the check is also saved and the response
// carries saved:true and the resultId; otherwise (or if saving fails) saved:false, resultId:null
// and the findings are returned all the same.
function createCheckRouter(config, { store, logger }) {
  const router = express.Router();

  router.post('/check', async (req, res, next) => {
    try {
      const body = req.body;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new InputError('Request body must be a JSON object with employees, shifts and leave.');
      }
      for (const field of ['employees', 'shifts']) {
        if (typeof body[field] !== 'string') {
          throw new InputError(`Field "${field}" is required and must be a string of CSV text.`);
        }
      }
      if (body.leave !== undefined && body.leave !== null && typeof body.leave !== 'string') {
        throw new InputError('Field "leave" must be a string of CSV text (or left out).');
      }

      const { findings, summary } = rules.runCheck(
        { employees: body.employees, shifts: body.shifts, leave: body.leave || '' },
        { maxFindings: config.maxFindings, minRestHours: config.minRestHours },
      );
      let resultId = null;
      if (store.isUp()) {
        try {
          // The rows kept for saving come from the same parser the rules use (names are dropped on save).
          const parsed = parseRoster({ employees: body.employees, shifts: body.shifts, leave: body.leave || '' });
          const ownerId = store.isValidId(req.user.id) ? req.user.id : undefined;
          resultId = await store.saveCheck({ parsed, summary, findings, ownerId });
        } catch (err) {
          logger.error('save_failed', { requestId: req.id, errorName: err.name }); // name only
        }
      }
      res.json({
        resultId,
        saved: resultId !== null,
        createdAt: new Date().toISOString(),
        summary,
        findings,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createCheckRouter };
