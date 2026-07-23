import React, { useState } from "react";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Button, StatusBadge } from "@medusajs/ui";

const CategoryImageUploader = ({ data }: { data: any }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(data?.metadata?.image_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Upload file using Medusa Uploads API
      const formData = new FormData();
      formData.append("files", file);

      const uploadRes = await fetch("/admin/uploads", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image to media storage.");
      }

      const uploadData = await uploadRes.json();
      const url = uploadData.files[0].url;

      // 2. Save the image URL in the Category metadata
      const updateRes = await fetch(`/admin/product-categories/${data.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata: {
            ...data.metadata,
            image_url: url,
          },
        }),
      });

      if (!updateRes.ok) {
        throw new Error("Failed to save image URL to category metadata.");
      }

      setImageUrl(url);
      
      // Reload page to refresh the admin categories context
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    setIsUploading(true);
    setError(null);

    try {
      // Clear image_url from category metadata
      const updatedMetadata = { ...data.metadata };
      delete updatedMetadata.image_url;

      const updateRes = await fetch(`/admin/product-categories/${data.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata: updatedMetadata,
        }),
      });

      if (!updateRes.ok) {
        throw new Error("Failed to remove image from category metadata.");
      }

      setImageUrl(null);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while removing the image.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Container className="p-6 bg-slate-900 border border-slate-800 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Heading level="h2" className="text-lg font-bold text-slate-100">
            Category Banner / Image
          </Heading>
          <p className="text-xs text-slate-400">
            Manage the category thumbnail display image for your storefront.
          </p>
        </div>
        <StatusBadge color={imageUrl ? "green" : "grey"}>
          {imageUrl ? "Image Active" : "No Image"}
        </StatusBadge>
      </div>

      {imageUrl ? (
        <div className="space-y-4">
          <div className="relative w-48 h-48 border border-slate-700 rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center">
            <img
              src={imageUrl}
              alt="Category Preview"
              className="object-contain w-full h-full"
            />
          </div>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={isUploading}
            size="small"
          >
            {isUploading ? "Removing..." : "Remove Image"}
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-750 hover:border-emerald-500 rounded-lg p-6 flex flex-col items-center justify-center transition-colors">
          <svg
            className="w-12 h-12 text-slate-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <label className="cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold px-4 py-2 rounded-md text-sm transition-colors">
            {isUploading ? "Uploading..." : "Upload Category Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </label>
          <p className="text-xs text-slate-500 mt-2">
            PNG, JPG, WEBP up to 5MB
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 mt-2 font-medium">{error}</p>
      )}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product_category.details.after",
});

export default CategoryImageUploader;
