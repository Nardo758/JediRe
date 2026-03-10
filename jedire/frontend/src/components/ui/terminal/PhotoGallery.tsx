import React, { useState } from 'react';
import { TerminalTheme as T } from './theme';
import { Badge } from './Badge';

interface Photo {
  id: string | number;
  url?: string;
  label?: string;
  aspect?: string;
  color?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  placeholderMode?: boolean;
}

const PhotoPlaceholder: React.FC<{ photo: Photo; size?: "large" | "small" }> = ({ 
  photo, 
  size = "large" 
}) => {
  const isLarge = size === "large";
  const color = photo.color || "#1a2744";
  
  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: color,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid overlay */}
      <div style={{ 
        position: "absolute", 
        inset: 0, 
        opacity: 0.08, 
        background: `repeating-linear-gradient(0deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px)` 
      }} />
      <div style={{ 
        position: "absolute", 
        inset: 0, 
        background: `linear-gradient(135deg, ${color}00 0%, ${color} 50%, ${color}aa 100%)` 
      }} />
      
      {/* Building silhouette */}
      <svg 
        width={isLarge ? 120 : 40} 
        height={isLarge ? 80 : 28} 
        viewBox="0 0 120 80" 
        style={{ opacity: 0.3, position: "relative", zIndex: 1 }}
      >
        <rect x="10" y="20" width="30" height="60" fill={T.text.secondary} />
        <rect x="15" y="25" width="8" height="8" fill={color} />
        <rect x="27" y="25" width="8" height="8" fill={color} />
        <rect x="15" y="38" width="8" height="8" fill={color} />
        <rect x="27" y="38" width="8" height="8" fill={color} />
        <rect x="45" y="10" width="35" height="70" fill={T.text.secondary} />
        <rect x="50" y="15" width="8" height="8" fill={color} />
        <rect x="62" y="15" width="8" height="8" fill={color} />
        <rect x="50" y="28" width="8" height="8" fill={color} />
        <rect x="62" y="28" width="8" height="8" fill={color} />
        <rect x="50" y="41" width="8" height="8" fill={color} />
        <rect x="62" y="41" width="8" height="8" fill={color} />
        <rect x="85" y="30" width="25" height="50" fill={T.text.secondary} />
        <rect x="90" y="35" width="6" height="6" fill={color} />
        <rect x="100" y="35" width="6" height="6" fill={color} />
        <rect x="90" y="46" width="6" height="6" fill={color} />
        <rect x="100" y="46" width="6" height="6" fill={color} />
      </svg>
      
      {isLarge && photo.label && (
        <span style={{ 
          fontSize: 10, 
          fontFamily: T.font.mono, 
          color: `${T.text.secondary}80`, 
          marginTop: 8, 
          position: "relative", 
          zIndex: 1 
        }}>
          {photo.label}
        </span>
      )}
    </div>
  );
};

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ 
  photos, 
  placeholderMode = false 
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const active = photos[activeIdx];

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      gap: 0, 
      background: T.bg.photo, 
      borderRadius: 2, 
      overflow: "hidden", 
      border: `1px solid ${T.border.subtle}` 
    }}>
      {/* Hero Image */}
      <div
        onClick={() => setLightbox(true)}
        style={{ width: "100%", height: 200, cursor: "pointer", position: "relative" }}
      >
        {active.url && !placeholderMode ? (
          <img src={active.url} alt={active.label || "Property"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <PhotoPlaceholder photo={active} size="large" />
        )}
        
        {/* Photo count overlay */}
        <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 4, alignItems: "center" }}>
          <Badge color={T.text.white} bg="#00000099" border="transparent">
            {activeIdx + 1} / {photos.length}
          </Badge>
          <Badge color={T.text.cyan} bg="#00000099" border="transparent">
            EXPAND
          </Badge>
        </div>
        
        {/* Navigation arrows */}
        {activeIdx > 0 && (
          <div 
            onClick={(e) => { e.stopPropagation(); setActiveIdx(activeIdx - 1); }}
            style={{ 
              position: "absolute", 
              left: 6, 
              top: "50%", 
              transform: "translateY(-50%)", 
              width: 24, 
              height: 24, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              background: "#000000aa", 
              borderRadius: 2, 
              cursor: "pointer", 
              color: T.text.white, 
              fontSize: 12, 
              fontFamily: T.font.mono 
            }}
          >
            ‹
          </div>
        )}
        {activeIdx < photos.length - 1 && (
          <div 
            onClick={(e) => { e.stopPropagation(); setActiveIdx(activeIdx + 1); }}
            style={{ 
              position: "absolute", 
              right: 6, 
              top: "50%", 
              transform: "translateY(-50%)", 
              width: 24, 
              height: 24, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              background: "#000000aa", 
              borderRadius: 2, 
              cursor: "pointer", 
              color: T.text.white, 
              fontSize: 12, 
              fontFamily: T.font.mono 
            }}
          >
            ›
          </div>
        )}
      </div>
      
      {/* Thumbnail Strip */}
      <div style={{ display: "flex", gap: 2, padding: 2, background: T.bg.terminal, overflowX: "auto" }}>
        {photos.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setActiveIdx(i)}
            style={{
              width: 52, 
              height: 36, 
              flexShrink: 0, 
              cursor: "pointer",
              border: i === activeIdx ? `1px solid ${T.text.amber}` : `1px solid ${T.border.subtle}`,
              borderRadius: 1, 
              overflow: "hidden", 
              opacity: i === activeIdx ? 1 : 0.6,
              transition: "opacity 0.15s, border-color 0.15s",
            }}
          >
            {p.url && !placeholderMode ? (
              <img src={p.url} alt={p.label || `Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <PhotoPlaceholder photo={p} size="small" />
            )}
          </div>
        ))}
      </div>

      {/* Lightbox overlay */}
      {lightbox && (
        <div 
          onClick={() => setLightbox(false)} 
          style={{
            position: "fixed", 
            inset: 0, 
            zIndex: 9999, 
            background: "#000000ee",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div 
            style={{ width: "80%", maxWidth: 900, height: "70%", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            {active.url && !placeholderMode ? (
              <img src={active.url} alt={active.label || "Property"} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <PhotoPlaceholder photo={active} size="large" />
            )}
            
            <div 
              onClick={() => setLightbox(false)} 
              style={{
                position: "absolute", 
                top: 8, 
                right: 8, 
                width: 28, 
                height: 28,
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                background: "#000000cc", 
                borderRadius: 2, 
                cursor: "pointer",
                color: T.text.white, 
                fontSize: 14, 
                fontFamily: T.font.mono,
              }}
            >
              ×
            </div>
            
            <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
              {photos.map((_, i) => (
                <div 
                  key={i} 
                  onClick={() => setActiveIdx(i)} 
                  style={{
                    width: 8, 
                    height: 8, 
                    borderRadius: "50%", 
                    cursor: "pointer",
                    background: i === activeIdx ? T.text.amber : T.text.muted,
                  }} 
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
