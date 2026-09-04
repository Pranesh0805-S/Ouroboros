// routes/users.js
// BUG PATTERN: Null Pointer / Undefined Reference
//
// GET /api/users/:id
// Looks up a user and reads user.profile.name directly. Some users
// (see data/seed.js, id "3") don't have a `profile` object, so this
// throws: "Cannot read properties of undefined (reading 'name')"
//
// This mirrors a very common real-world bug: an optional/nullable field
// added later in a schema migration, accessed without an optional-chain
// or existence check somewhere downstream.

const express = require('express');
const router = express.Router();
const { users } = require('../data/seed');
const { logError } = require('../logger');

router.get('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const user = users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // --- BUG: no check that user.profile exists before reading .name ---
    const displayName = user.profile.name;

    return res.json({ id: user.id, displayName });
  } catch (err) {
    logError({
      route: 'GET /api/users/:id',
      errorType: 'null_pointer',
      error: err,
      context: { params: req.params },
    });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

