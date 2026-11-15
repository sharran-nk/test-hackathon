const express = require('express');
const rules = require('../rules/index');
const { InputError } = require('../parse/validate');

// POST /api/check  { employees: "<csv>", shifts: "<csv>", leave: "<csv, optional>" }
// Returns the findings and a summary. Saving to MongoDB is added in milestone 4, so
// until then resultId is null and saved is false.
function createCheckRouter(config) {
  const router = express.Router();

  router.post('/check', (req, res, next) => {
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
      res.json({
        resultId: null,
        saved: false,
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
