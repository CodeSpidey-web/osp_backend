const { Client } = require('pg');

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:root@localhost:5432/medusa_store',
  });

  try {
    await client.connect();
    console.log('[DB Setup] Connected to Postgres medusa_store database.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS google_review_location (
        id VARCHAR(255) PRIMARY KEY,
        location_name VARCHAR(255) NOT NULL,
        place_id VARCHAR(255),
        location_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sync_status VARCHAR(50) DEFAULT 'idle',
        last_synced_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS google_review (
        id VARCHAR(255) PRIMARY KEY,
        google_review_location_id VARCHAR(255) REFERENCES google_review_location(id) ON DELETE CASCADE,
        external_review_id VARCHAR(255) UNIQUE,
        author_name VARCHAR(255) NOT NULL,
        rating INT DEFAULT 5,
        review_text TEXT,
        review_time TIMESTAMP WITH TIME ZONE,
        profile_photo_url TEXT,
        review_url TEXT,
        status VARCHAR(50) DEFAULT 'published',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Insert default location if none exists
    const res = await client.query('SELECT COUNT(*) FROM google_review_location');
    if (parseInt(res.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO google_review_location (id, location_name, place_id, is_active, sync_status)
        VALUES ('loc_godigital', 'Godigital Academy - Best AI Digital Marketing Institute', 'ChIJffcyg2UxtTsR3TuXtyeExyQ', true, 'idle')
      `);
      console.log('[DB Setup] Inserted default initial location: Godigital Academy');
    }

    console.log('[DB Setup] Google Review tables created and initialized successfully.');
  } catch (err) {
    console.error('[DB Setup] Error:', err);
  } finally {
    await client.end();
  }
}

setupDatabase();
