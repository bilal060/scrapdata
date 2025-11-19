const express = require('express');
const router = express.Router();

// Static in-memory jobs list for now; can be replaced with DB later
const jobs = [
  {
    id: 'android-re',
    title: 'Android Reverse Engineer',
    company: 'Shadow Labs',
    location: 'Remote',
    level: 'Senior',
    tags: ['Android', 'Reverse Engineering', 'Security'],
    description:
      'Dissect APKs, trace on-device telemetry, and harden capture agents against tampering.',
  },
  {
    id: 'fullstack-surveillance',
    title: 'Full‑stack Surveillance Engineer',
    company: 'Signal Matrix',
    location: 'Remote / EU',
    level: 'Senior',
    tags: ['Node.js', 'React', 'MongoDB', 'Kotlin'],
    description:
      'Own the pipeline from Android sensors to backend APIs and dashboards, with strong focus on observability.',
  },
  {
    id: 'osint-automation',
    title: 'OSINT Automation Specialist',
    company: 'Recon Works',
    location: 'Hybrid – Dubai',
    level: 'Mid‑Senior',
    tags: ['Python', 'Scraping', 'OSINT'],
    description:
      'Automate scraping and enrichment workflows that merge device data with external intelligence sources.',
  },
];

// GET /api/jobs?search=&location=&tag=
router.get('/', async (req, res) => {
  try {
    const { search, location, tag } = req.query;
    let filtered = jobs.slice();

    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q)
      );
    }

    if (location) {
      const loc = String(location).toLowerCase();
      filtered = filtered.filter((j) =>
        j.location.toLowerCase().includes(loc)
      );
    }

    if (tag) {
      const tagLower = String(tag).toLowerCase();
      filtered = filtered.filter((j) =>
        j.tags.some((t) => t.toLowerCase().includes(tagLower))
      );
    }

    res.json({
      data: filtered,
      totalCount: filtered.length,
    });
  } catch (err) {
    console.error('Error in GET /api/jobs', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


