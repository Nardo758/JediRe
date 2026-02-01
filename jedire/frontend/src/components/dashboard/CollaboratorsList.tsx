import { CollaborationUser } from '@/types';

interface CollaboratorsListProps {
  collaborators: CollaborationUser[];
}

export default function CollaboratorsList({ collaborators }: CollaboratorsListProps) {
  return (
    <div className="space-y-2">
      {collaborators.map((collab) => (
        <div key={collab.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
          {/* Avatar */}
          {collab.avatar ? (
            <img
              src={collab.avatar}
              alt={collab.name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ backgroundColor: collab.color }}
            >
              {collab.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Name */}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{collab.name}</div>
            {collab.cursor && (
              <div className="text-xs text-gray-500">Viewing map</div>
            )}
          </div>

          {/* Status indicator */}
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
      ))}
    </div>
  );
}
