// src/components/widgets/ImagePreview.tsx
import React from "react";
import { CloseIcon, FileIcon } from "../icons/Icons";

interface ImagePreviewProps {
  file: File;
  previewUrl: string;
  onRemove: () => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  file,
  previewUrl,
  onRemove,
}) => {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 12px 6px 8px",
        backgroundColor: "#f3f4f6",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        marginBottom: "8px",
        maxWidth: "fit-content",
        position: "relative",
      }}
    >
      {/* set image preview size */}
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: isPdf ? "#FEF3C7" : "#e5e7eb",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isPdf ? (
          <FileIcon />
        ) : (
          <img
            src={previewUrl}
            alt={file.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        )}
      </div>

      {/* file name and size data */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          maxWidth: "180px",
        }}
      >
        <span
          title={file.name}
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#1f2937",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {file.name}
        </span>
        <span style={{ fontSize: "11px", color: "#6b7280" }}>
          {(file.size / 1024).toFixed(0)} KB
        </span>
      </div>

      {/* remove button (X) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove image"
        title="Remove image"
        style={{
          background: "#4b5563",
          border: "none",
          borderRadius: "50%",
          width: "22px",
          height: "22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#ffffff",
          padding: 0,
          marginLeft: "4px",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#1f2937")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#4b5563")}
      >
        <div
          style={{
            width: "12px",
            height: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CloseIcon />
        </div>
      </button>
    </div>
  );
};

export default ImagePreview;
