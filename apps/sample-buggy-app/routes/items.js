// routes/items.js
// BUG PATTERN: Off-by-one / boundary error in pagination
//
// GET /api/items?page=1&pageSize=10
//
// With 23 seeded items and pageSize=10, correct pagination should give:
//   page 1 -> items 1-10
//   page 2 -> items 11-20
//   page 3 -> items 21-23
//
// --- BUG: the slice's start index is computed as (page * pageSize)
// instead of ((page - 1) * pageSize). This shifts every page forward by
// one pageSize, so page 1 skips the first `pageSize` items entirely, and
// the very last page silently comes back empty/short instead of erroring
// (classic boundary bug â€” it doesn't crash, it just quietly returns
// wrong data, which is why it's dangerous).

const express = require('express');
const router = express.Router();
const { items } = require('../data/seed');
const { logError } = require('../logger');

router.get('/', (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 10;

  try {
    // --- BUG: should be (page - 1) * pageSize ---
    const start = page * pageSize;
    const end = start + pageSize;

    const pageItems = items.slice(start, end);

    // Detect + log the symptom: a non-final page that comes back empty
    // or short is a strong signal something's off in the slice math.
    const isLastPossiblePage = start < items.length;
    if (pageItems.length === 0 && isLastPossiblePage) {
      logError({
        route: 'GET /api/items',
        errorType: 'off_by_one',
        error: new Error(
          `Pagination returned 0 items for page=${page}, pageSize=${pageSize} despite ${items.length} total items existing (start=${start}, end=${end})`
        ),
        context: { page, pageSize, totalItems: items.length, start, end },
      });
    }

    return res.json({
      page,
      pageSize,
      totalItems: items.length,
      items: pageItems,
    });
  } catch (err) {
    logError({
      route: 'GET /api/items',
      errorType: 'off_by_one',
      error: err,
      context: { query: req.query },
    });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

