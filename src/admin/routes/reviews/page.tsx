import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Button, Table, Badge, Input } from "@medusajs/ui";
import { ChatBubble } from "@medusajs/icons";
import { useState, useEffect } from "react";

const ReviewsPage = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [locationUrl, setLocationUrl] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/admin/reviews?limit=1000");
      const data = await res.json();
      setLocations(data.locations || []);
      setReviews(data.reviews || []);
    } catch (err) {
      console.error("Failed to fetch admin reviews data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch("/admin/reviews/sync", { method: "POST" });
      const data = await res.json();
      alert(data.message || "Google reviews sync completed!");
      fetchData();
    } catch (err) {
      alert("Failed to sync Google reviews");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationName || (!placeId && !locationUrl)) {
      alert("Please provide location name and Place ID or URL.");
      return;
    }
    try {
      const res = await fetch("/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_location",
          locationName,
          placeId,
          locationUrl,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setLocationName("");
        setPlaceId("");
        setLocationUrl("");
        fetchData();
      }
    } catch (err) {
      alert("Failed to add place location");
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this place location?")) return;
    try {
      await fetch("/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_location", locationId: id }),
      });
      fetchData();
    } catch (err) {
      alert("Failed to delete location");
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    try {
      await fetch("/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_review", reviewId: id }),
      });
      fetchData();
    } catch (err) {
      alert("Failed to delete review");
    }
  };

  return (
    <div className="flex flex-col gap-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1" className="text-2xl font-bold">
            Reviews Configuration
          </Heading>
          <Text className="text-ui-fg-subtle text-sm mt-1">
            Manage reviews from Google, Facebook, and YouTube to build credibility on our platforms.
          </Text>
        </div>
        <div className="flex items-center gap-x-3">
          <Button variant="secondary" onClick={handleSync} isLoading={syncing}>
            🔄 Sync Google Reviews
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            + Add Place Location
          </Button>
        </div>
      </div>

      {/* Modal for Add Location */}
      {showAddModal && (
        <Container className="p-6 border border-ui-border-base rounded-lg bg-ui-bg-base">
          <Heading level="h2" className="text-lg font-bold mb-4">
            Add New Google Place Location
          </Heading>
          <form onSubmit={handleAddLocation} className="flex flex-col gap-y-4">
            <div>
              <Text className="text-sm font-semibold mb-1">Location Name</Text>
              <Input
                placeholder="e.g. Ocean Student Projects Main Store"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                required
              />
            </div>
            <div>
              <Text className="text-sm font-semibold mb-1">Google Place ID</Text>
              <Input
                placeholder="e.g. ChIJffcyg2UxtTsR3TuXtyeExyQ"
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
              />
            </div>
            <div>
              <Text className="text-sm font-semibold mb-1">Or Google Maps Location URL</Text>
              <Input
                placeholder="e.g. https://www.google.com/maps/place/..."
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-x-3 mt-2">
              <Button variant="secondary" onClick={() => setShowAddModal(false)} type="button">
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save Location
              </Button>
            </div>
          </form>
        </Container>
      )}

      {/* Locations Card */}
      <Container className="p-6 flex flex-col gap-y-4">
        <div>
          <Heading level="h2" className="text-lg font-bold">
            Configured Places / Locations (Google Reviews Sync)
          </Heading>
          <Text className="text-ui-fg-subtle text-xs mt-1">
            Google Reviews sync runs automatically every 3 hours, but you can also manually trigger a sync anytime using the Sync Google Reviews button.
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {loading ? (
            <Text className="text-xs text-ui-fg-subtle">Loading locations...</Text>
          ) : locations.length === 0 ? (
            <Text className="text-xs text-ui-fg-subtle">No locations configured yet.</Text>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="p-5 border rounded-xl bg-ui-bg-subtle flex flex-col justify-between gap-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-x-2">
                      <Text className="font-bold text-sm">{loc.location_name}</Text>
                      <Badge color={loc.is_active ? "green" : "grey"}>
                        {loc.is_active ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </div>
                    <Text className="text-xs text-ui-fg-subtle mt-1 font-mono">
                      Place ID: {loc.place_id || "N/A"}
                    </Text>
                  </div>
                  <Button variant="transparent" size="small" onClick={() => handleDeleteLocation(loc.id)}>
                    🗑️
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t">
                  <div>
                    <Text className="text-ui-fg-muted text-[11px]">Status:</Text>
                    <Badge color={loc.sync_status === "synced" ? "green" : loc.sync_status === "failed" ? "red" : "orange"}>
                      {loc.sync_status?.toUpperCase() || "IDLE"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <Text className="text-ui-fg-muted text-[11px]">Last Synced:</Text>
                    <Text className="font-semibold text-[11px]">
                      {loc.last_synced_at ? new Date(loc.last_synced_at).toLocaleString() : "Never"}
                    </Text>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Container>

      {/* Reviews Table */}
      <Container className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Heading level="h2" className="text-lg font-bold">
            Google Reviews ({reviews.length})
          </Heading>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>AUTHOR</Table.HeaderCell>
              <Table.HeaderCell>RATING</Table.HeaderCell>
              <Table.HeaderCell>REVIEW MESSAGE</Table.HeaderCell>
              <Table.HeaderCell>LINK</Table.HeaderCell>
              <Table.HeaderCell>REVIEW DATE</Table.HeaderCell>
              <Table.HeaderCell>STATUS</Table.HeaderCell>
              <Table.HeaderCell className="text-right">ACTIONS</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell {...({ colSpan: 7 } as any)} className="text-center py-6 text-ui-fg-muted">
                  Loading reviews...
                </Table.Cell>
              </Table.Row>
            ) : reviews.length === 0 ? (
              <Table.Row>
                <Table.Cell {...({ colSpan: 7 } as any)} className="text-center py-6 text-ui-fg-muted">
                  No reviews found.
                </Table.Cell>
              </Table.Row>
            ) : (
              reviews.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell className="flex items-center gap-x-3">
                    {r.profile_photo_url ? (
                      <img src={r.profile_photo_url} alt={r.author_name} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        {r.author_name ? r.author_name.charAt(0) : "A"}
                      </div>
                    )}
                    <Text className="font-medium text-xs">{r.author_name}</Text>
                  </Table.Cell>

                  <Table.Cell>
                    <div className="flex items-center text-amber-500 font-bold text-xs">
                      ⭐ {r.rating}
                    </div>
                  </Table.Cell>

                  <Table.Cell className="max-w-xs">
                    <Text className="text-xs text-ui-fg-subtle line-clamp-2">
                      {r.review_text || "No review message"}
                    </Text>
                  </Table.Cell>

                  <Table.Cell>
                    {r.review_url ? (
                      <a href={r.review_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                        View page
                      </a>
                    ) : (
                      <Text className="text-xs text-ui-fg-muted">-</Text>
                    )}
                  </Table.Cell>

                  <Table.Cell>
                    <Text className="text-xs text-ui-fg-subtle">
                      {r.review_time ? new Date(r.review_time).toLocaleDateString() : "N/A"}
                    </Text>
                  </Table.Cell>

                  <Table.Cell>
                    <Badge color="green">{r.status || "published"}</Badge>
                  </Table.Cell>

                  <Table.Cell className="text-right">
                    <Button variant="transparent" size="small" onClick={() => handleDeleteReview(r.id)}>
                      🗑️
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Reviews",
  icon: ChatBubble,
});

export default ReviewsPage;

