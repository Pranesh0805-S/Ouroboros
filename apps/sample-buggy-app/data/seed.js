// data/seed.js
// Fake in-memory "database" for the sample app. Intentionally simple â€”
// the point of this app is to produce realistic failure patterns, not to
// be a real backend.

// NOTE the bug: user id "3" has no `profile` key at all (simulates a
// record that was created before the `profile` field existed, or a
// partial signup). This is what triggers the null-pointer route.
const users = [
  { id: '1', name: 'Asha Rao', profile: { name: 'Asha Rao', bio: 'Backend engineer' } },
  { id: '2', name: 'Diego Fernandez', profile: { name: 'Diego Fernandez', bio: 'Loves Postgres' } },
  { id: '3', name: 'Priya Menon' }, // <-- no `profile` object (bug trigger)
  { id: '4', name: 'Kwame Boateng', profile: { name: 'Kwame Boateng', bio: 'Frontend + a11y' } },
];

const items = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
}));

module.exports = { users, items };

