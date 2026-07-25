const { Client } = require('pg');
const crypto = require('crypto');
const { scrapeGoogleReviews } = require('../scripts/scraper-core.js');

function getDbClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:root@localhost:5432/medusa_store',
  });
}

function getSHA256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function parseRelativeDate(relativeStr) {
  if (!relativeStr) return new Date();
  const now = new Date();
  const lower = relativeStr.toLowerCase();
  const match = lower.match(/(\d+)/);
  const number = match ? parseInt(match[1], 10) : 1;

  if (lower.includes('second')) now.setSeconds(now.getSeconds() - number);
  else if (lower.includes('minute')) now.setMinutes(now.getMinutes() - number);
  else if (lower.includes('hour')) now.setHours(now.getHours() - number);
  else if (lower.includes('day')) now.setDate(now.getDate() - number);
  else if (lower.includes('week')) now.setDate(now.getDate() - (number * 7));
  else if (lower.includes('month')) now.setMonth(now.getMonth() - number);
  else if (lower.includes('year')) now.setFullYear(now.getFullYear() - number);
  
  return now;
}

async function getLocations() {
  const client = getDbClient();
  await client.connect();
  try {
    const res = await client.query('SELECT * FROM google_review_location ORDER BY created_at DESC');
    return res.rows;
  } finally {
    await client.end();
  }
}

async function addLocation({ locationName, placeId, locationUrl }) {
  const client = getDbClient();
  await client.connect();
  try {
    const id = 'loc_' + Date.now();
    const res = await client.query(
      `INSERT INTO google_review_location (id, location_name, place_id, location_url, is_active, sync_status)
       VALUES ($1, $2, $3, $4, true, 'idle') RETURNING *`,
      [id, locationName, placeId || null, locationUrl || null]
    );
    return res.rows[0];
  } finally {
    await client.end();
  }
}

async function deleteLocation(locationId) {
  const client = getDbClient();
  await client.connect();
  try {
    await client.query('DELETE FROM google_review_location WHERE id = $1', [locationId]);
    return true;
  } finally {
    await client.end();
  }
}

async function getReviews({ rating, status, page = 1, limit = 1000 } = {}) {
  const client = getDbClient();
  await client.connect();
  try {
    let query = 'SELECT * FROM google_review WHERE 1=1';
    const params = [];

    if (rating) {
      params.push(rating);
      query += ` AND rating = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY review_time DESC, created_at DESC';

    if (limit && limit > 0) {
      const offset = (page - 1) * limit;
      params.push(limit);
      query += ` LIMIT $${params.length}`;
      params.push(offset);
      query += ` OFFSET $${params.length}`;
    }

    const res = await client.query(query, params);
    const countRes = await client.query('SELECT COUNT(*) FROM google_review');

    return {
      reviews: res.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      limit,
    };
  } finally {
    await client.end();
  }
}

async function deleteReview(reviewId) {
  const client = getDbClient();
  await client.connect();
  try {
    await client.query('DELETE FROM google_review WHERE id = $1', [reviewId]);
    return true;
  } finally {
    await client.end();
  }
}

async function syncAllLocations() {
  const locations = await getLocations();
  const activeLocations = locations.filter(l => l.is_active);

  if (activeLocations.length === 0) {
    return { synced: 0, message: 'No active Google Review locations configured.' };
  }

  let totalScraped = 0;

  for (const loc of activeLocations) {
    const client = getDbClient();
    await client.connect();
    try {
      await client.query("UPDATE google_review_location SET sync_status = 'syncing' WHERE id = $1", [loc.id]);
      
      const scraped = await scrapeGoogleReviews({
        placeId: loc.place_id,
        locationUrl: loc.location_url,
        locationName: loc.location_name,
      });

      let newCount = 0;
      let updatedCount = 0;

      for (const r of scraped) {
        let externalId = r.reviewId;
        if (!externalId || externalId.trim() === '') {
          externalId = getSHA256(r.authorName + r.reviewDate + r.reviewText);
        }

        const existing = await client.query('SELECT id FROM google_review WHERE external_review_id = $1', [externalId]);
        
        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE google_review SET
              rating = $1,
              review_text = $2,
              profile_photo_url = $3,
              updated_at = NOW()
             WHERE id = $4`,
            [r.rating || 5, r.reviewText || '', r.profilePhotoUrl || '', existing.rows[0].id]
          );
          updatedCount++;
        } else {
          const revId = 'rev_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          await client.query(
            `INSERT INTO google_review 
             (id, google_review_location_id, external_review_id, author_name, rating, review_text, review_time, profile_photo_url, review_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published')`,
            [
              revId,
              loc.id,
              externalId,
              r.authorName || 'Anonymous',
              r.rating || 5,
              r.reviewText || '',
              parseRelativeDate(r.reviewDate),
              r.profilePhotoUrl || '',
              r.reviewUrl || '',
            ]
          );
          newCount++;
        }
      }

      totalScraped += scraped.length;

      await client.query(
        "UPDATE google_review_location SET sync_status = 'synced', last_synced_at = NOW(), updated_at = NOW() WHERE id = $1",
        [loc.id]
      );
    } catch (err) {
      console.error(`[GoogleReviewsSync] Error syncing location ${loc.location_name}:`, err);
      await client.query("UPDATE google_review_location SET sync_status = 'failed' WHERE id = $1", [loc.id]);
    } finally {
      await client.end();
    }
  }

  return { synced: totalScraped, message: `Successfully synced ${totalScraped} Google reviews.` };
}

module.exports = {
  getLocations,
  addLocation,
  deleteLocation,
  getReviews,
  deleteReview,
  syncAllLocations,
};
