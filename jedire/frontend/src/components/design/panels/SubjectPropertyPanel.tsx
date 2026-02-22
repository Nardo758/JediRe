import React, { useState } from 'react';
import { useDesignDashboardStore } from '../../../stores/DesignDashboardStore';
import { ChevronDown, ChevronRight, Edit2, Save, X } from 'lucide-react';

export const SubjectPropertyPanel: React.FC = () => {
  const {
    subjectProperty,
    setSubjectProperty,
    updateSubjectBoundary,
  } = useDesignDashboardStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    apn: '',
    zoning: '',
    acres: 0,
    owner: '',
    maxHeight: 0,
    maxFAR: 0,
    frontSetback: 0,
    rearSetback: 0,
    sideSetback: 0,
  });

  const startEditing = () => {
    if (subjectProperty) {
      setEditForm({
        apn: subjectProperty.parcelDetails.apn,
        zoning: subjectProperty.parcelDetails.zoning,
        acres: subjectProperty.parcelDetails.acres,
        owner: subjectProperty.parcelDetails.owner || '',
        maxHeight: subjectProperty.zoningInfo.maxHeight,
        maxFAR: subjectProperty.zoningInfo.maxFAR,
        frontSetback: subjectProperty.zoningInfo.setbacks.front,
        rearSetback: subjectProperty.zoningInfo.setbacks.rear,
        sideSetback: subjectProperty.zoningInfo.setbacks.side,
      });
    }
    setIsEditing(true);
  };

  const saveEdits = () => {
    if (subjectProperty) {
      setSubjectProperty({
        ...subjectProperty,
        parcelDetails: {
          apn: editForm.apn,
          zoning: editForm.zoning,
          acres: editForm.acres,
          owner: editForm.owner,
        },
        zoningInfo: {
          ...subjectProperty.zoningInfo,
          maxHeight: editForm.maxHeight,
          maxFAR: editForm.maxFAR,
          setbacks: {
            front: editForm.frontSetback,
            rear: editForm.rearSetback,
            side: editForm.sideSetback,
          },
        },
      });
    }
    setIsEditing(false);
  };

  if (!subjectProperty) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="mb-2">No property selected</p>
        <button className="text-blue-600 hover:text-blue-700">
          Draw Property Boundary
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Property Details</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={saveEdits}
                className="p-1 text-green-600 hover:text-green-700"
                title="Save"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 text-red-600 hover:text-red-700"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="p-1 text-gray-600 hover:text-gray-800"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-4">
          {/* Parcel Details */}
          <div>
            <h4 className="text-sm font-medium mb-2">Parcel Details</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600">APN</label>
                <input
                  type="text"
                  value={editForm.apn}
                  onChange={(e) => setEditForm({ ...editForm, apn: e.target.value })}
                  className="w-full px-2 py-1 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Zoning</label>
                <input
                  type="text"
                  value={editForm.zoning}
                  onChange={(e) => setEditForm({ ...editForm, zoning: e.target.value })}
                  className="w-full px-2 py-1 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Acres</label>
                <input
                  type="number"
                  value={editForm.acres}
                  onChange={(e) => setEditForm({ ...editForm, acres: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1 border rounded text-sm"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Owner</label>
                <input
                  type="text"
                  value={editForm.owner}
                  onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                  className="w-full px-2 py-1 border rounded text-sm"
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          {/* Zoning Info */}
          <div>
            <h4 className="text-sm font-medium mb-2">Zoning Requirements</h4>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600">Max Height (ft)</label>
                  <input
                    type="number"
                    value={editForm.maxHeight}
                    onChange={(e) => setEditForm({ ...editForm, maxHeight: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600">Max FAR</label>
                  <input
                    type="number"
                    value={editForm.maxFAR}
                    onChange={(e) => setEditForm({ ...editForm, maxFAR: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 border rounded text-sm"
                    step="0.1"
                  />
                </div>
              </div>
              
              <h5 className="text-xs font-medium mt-2">Setbacks (ft)</h5>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600">Front</label>
                  <input
                    type="number"
                    value={editForm.frontSetback}
                    onChange={(e) => setEditForm({ ...editForm, frontSetback: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600">Rear</label>
                  <input
                    type="number"
                    value={editForm.rearSetback}
                    onChange={(e) => setEditForm({ ...editForm, rearSetback: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600">Side</label>
                  <input
                    type="number"
                    value={editForm.sideSetback}
                    onChange={(e) => setEditForm({ ...editForm, sideSetback: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Parcel Details Display */}
          <div>
            <h4 className="text-sm font-medium mb-2">Parcel Details</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">APN:</span>
                <span className="font-medium">{subjectProperty.parcelDetails.apn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Zoning:</span>
                <span className="font-medium">{subjectProperty.parcelDetails.zoning}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Acres:</span>
                <span className="font-medium">{subjectProperty.parcelDetails.acres}</span>
              </div>
              {subjectProperty.parcelDetails.owner && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Owner:</span>
                  <span className="font-medium">{subjectProperty.parcelDetails.owner}</span>
                </div>
              )}
            </div>
          </div>

          {/* Zoning Info Display */}
          <div>
            <h4 className="text-sm font-medium mb-2">Zoning Requirements</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Max Height:</span>
                <span className="font-medium">{subjectProperty.zoningInfo.maxHeight} ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max FAR:</span>
                <span className="font-medium">{subjectProperty.zoningInfo.maxFAR}</span>
              </div>
              <div className="mt-2">
                <p className="text-xs text-gray-600 mb-1">Setbacks:</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-medium">{subjectProperty.zoningInfo.setbacks.front}ft</div>
                    <div className="text-gray-500">Front</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{subjectProperty.zoningInfo.setbacks.rear}ft</div>
                    <div className="text-gray-500">Rear</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{subjectProperty.zoningInfo.setbacks.side}ft</div>
                    <div className="text-gray-500">Side</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Calculated Stats */}
          <div className="pt-2 border-t">
            <h4 className="text-sm font-medium mb-2">Site Statistics</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Square Feet:</span>
                <span className="font-medium">
                  {(subjectProperty.parcelDetails.acres * 43560).toLocaleString()} SF
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Buildable:</span>
                <span className="font-medium">
                  {(subjectProperty.parcelDetails.acres * 43560 * subjectProperty.zoningInfo.maxFAR).toLocaleString()} SF
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-4 border-t space-y-2">
        <button className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
          Edit Property Boundary
        </button>
        <button className="w-full px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
          Import from County Data
        </button>
      </div>
    </div>
  );
};