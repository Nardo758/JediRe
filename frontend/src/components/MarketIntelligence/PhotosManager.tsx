import React, { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// PHOTOS MANAGER
// Add/edit/delete property photos for deals
// ═══════════════════════════════════════════════════════════════

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",blue:"#4A9EFF" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace",display:"'IBM Plex Mono',monospace",label:"'IBM Plex Sans',sans-serif" },
};

interface Photo {
  id: string;
  url: string;
  label: string;
  caption?: string;
  source: string;
  aspect: string;
  addedAt: string;
  updatedAt?: string;
}

interface PhotosManagerProps {
  dealId: string;
  apiBaseUrl?: string;
  onPhotosChange?: (photos: Photo[]) => void;
}

export const PhotosManager: React.FC<PhotosManagerProps> = ({ 
  dealId, 
  apiBaseUrl = "/api/v1",
  onPhotosChange 
}) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoLabel, setNewPhotoLabel] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPhotos();
  }, [dealId]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}/photos`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setPhotos(data.photos || []);
      if (onPhotosChange) onPhotosChange(data.photos || []);
    } catch (err: any) {
      console.error('Error fetching photos:', err);
      setError(err.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newPhotoUrl.trim(),
          label: newPhotoLabel.trim() || 'Property Photo',
          caption: newPhotoCaption.trim() || null,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await fetchPhotos();
      setNewPhotoUrl("");
      setNewPhotoLabel("");
      setNewPhotoCaption("");
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Error adding photo:', err);
      setError(err.message || 'Failed to add photo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/deals/${dealId}/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await fetchPhotos();
    } catch (err: any) {
      console.error('Error deleting photo:', err);
      setError(err.message || 'Failed to delete photo');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: 40,
        color: T.text.muted,
        fontFamily: T.font.mono,
        fontSize: 10,
      }}>
        LOADING PHOTOS...
      </div>
    );
  }

  return (
    <div style={{
      background: T.bg.panel,
      border: `1px solid ${T.border.subtle}`,
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: T.bg.header,
        borderBottom: `1px solid ${T.border.subtle}`,
      }}>
        <div style={{
          fontSize: 10,
          fontFamily: T.font.mono,
          fontWeight: 700,
          color: T.text.white,
          letterSpacing: "0.05em",
        }}>
          📸 PROPERTY PHOTOS
          <span style={{ 
            marginLeft: 8, 
            fontSize: 8, 
            color: T.text.muted,
            fontWeight: 400,
          }}>
            ({photos.length})
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: "4px 10px",
            background: showAddForm ? T.bg.hover : T.bg.active,
            border: `1px solid ${T.border.medium}`,
            borderRadius: 2,
            color: T.text.cyan,
            fontSize: 8,
            fontFamily: T.font.mono,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'CANCEL' : '+ ADD PHOTO'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: 10,
          background: `${T.text.red}10`,
          border: `1px solid ${T.text.red}40`,
          borderRadius: 2,
          margin: 10,
          fontSize: 9,
          fontFamily: T.font.mono,
          color: T.text.red,
        }}>
          {error}
        </div>
      )}

      {/* Add Photo Form */}
      {showAddForm && (
        <form onSubmit={handleAddPhoto} style={{
          padding: 12,
          background: T.bg.panelAlt,
          borderBottom: `1px solid ${T.border.subtle}`,
        }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: 'block',
              fontSize: 8,
              fontFamily: T.font.mono,
              color: T.text.secondary,
              marginBottom: 4,
            }}>
              PHOTO URL *
            </label>
            <input
              type="url"
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              required
              style={{
                width: '100%',
                padding: '6px 8px',
                background: T.bg.input,
                border: `1px solid ${T.border.medium}`,
                borderRadius: 2,
                color: T.text.primary,
                fontSize: 9,
                fontFamily: T.font.mono,
              }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: 'block',
              fontSize: 8,
              fontFamily: T.font.mono,
              color: T.text.secondary,
              marginBottom: 4,
            }}>
              LABEL
            </label>
            <input
              type="text"
              value={newPhotoLabel}
              onChange={(e) => setNewPhotoLabel(e.target.value)}
              placeholder="e.g., Exterior, Pool, Lobby"
              style={{
                width: '100%',
                padding: '6px 8px',
                background: T.bg.input,
                border: `1px solid ${T.border.medium}`,
                borderRadius: 2,
                color: T.text.primary,
                fontSize: 9,
                fontFamily: T.font.mono,
              }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: 'block',
              fontSize: 8,
              fontFamily: T.font.mono,
              color: T.text.secondary,
              marginBottom: 4,
            }}>
              CAPTION (optional)
            </label>
            <input
              type="text"
              value={newPhotoCaption}
              onChange={(e) => setNewPhotoCaption(e.target.value)}
              placeholder="Additional description"
              style={{
                width: '100%',
                padding: '6px 8px',
                background: T.bg.input,
                border: `1px solid ${T.border.medium}`,
                borderRadius: 2,
                color: T.text.primary,
                fontSize: 9,
                fontFamily: T.font.mono,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '6px 12px',
              background: submitting ? T.bg.hover : `linear-gradient(135deg, ${T.text.cyan} 0%, ${T.text.blue} 100%)`,
              border: 'none',
              borderRadius: 2,
              color: T.text.white,
              fontSize: 9,
              fontFamily: T.font.mono,
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
              letterSpacing: "0.05em",
            }}
          >
            {submitting ? 'ADDING...' : 'ADD PHOTO'}
          </button>
        </form>
      )}

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div style={{
          padding: 40,
          textAlign: 'center',
          color: T.text.muted,
          fontSize: 10,
          fontFamily: T.font.mono,
        }}>
          No photos yet. Add your first photo above.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 10,
          padding: 12,
        }}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              style={{
                background: T.bg.panelAlt,
                border: `1px solid ${T.border.subtle}`,
                borderRadius: 3,
                overflow: 'hidden',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.border.medium;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.border.subtle;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                position: 'relative',
                paddingTop: '56.25%', // 16:9 aspect ratio
                background: T.bg.terminal,
                overflow: 'hidden',
              }}>
                <img
                  src={photo.url}
                  alt={photo.label}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: ${T.text.muted}; font-size: 9px; font-family: ${T.font.mono};">
                          IMAGE FAILED TO LOAD
                        </div>
                      `;
                    }
                  }}
                />
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    padding: '3px 6px',
                    background: `${T.text.red}dd`,
                    border: 'none',
                    borderRadius: 2,
                    color: T.text.white,
                    fontSize: 8,
                    fontFamily: T.font.mono,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: 0,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.opacity = '0';
                  }}
                >
                  × DELETE
                </button>
              </div>
              <div style={{ padding: 8 }}>
                <div style={{
                  fontSize: 9,
                  fontFamily: T.font.mono,
                  fontWeight: 600,
                  color: T.text.primary,
                  marginBottom: 3,
                }}>
                  {photo.label}
                </div>
                {photo.caption && (
                  <div style={{
                    fontSize: 8,
                    fontFamily: T.font.mono,
                    color: T.text.muted,
                    lineHeight: 1.3,
                  }}>
                    {photo.caption}
                  </div>
                )}
                <div style={{
                  fontSize: 7,
                  fontFamily: T.font.mono,
                  color: T.text.muted,
                  marginTop: 4,
                }}>
                  {photo.source === 'manual' ? '📝 Manual' : photo.source}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotosManager;
