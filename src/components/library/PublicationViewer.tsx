import React, { useState, useEffect } from 'react';
import { Publication, RelayConfig } from '../../services/library/LibraryService';
import { LibraryService } from '../../services/library/LibraryService';
import { Citation } from '../../services/library/MetadataService';
import { ContentMetadata } from '../../services/library/ContentFingerprintService';
import { PrivilegedChannel } from '../../services/library/AccessControlService';

interface PublicationViewerProps {
  publicationId: string;
  userId: string;
  userAge?: number;
  isAdmin?: boolean;
  relays: RelayConfig[];
  privateKey: string;
  onClose: () => void;
}

export const PublicationViewer: React.FC<PublicationViewerProps> = ({
  publicationId,
  userId,
  userAge,
  isAdmin = false,
  relays,
  privateKey,
  onClose
}) => {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [channels, setChannels] = useState<PrivilegedChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useAdminRelays, setUseAdminRelays] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const libraryService = new LibraryService(relays, privateKey, true, useAdminRelays);

  useEffect(() => {
    const fetchPublication = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check access first
        const access = await libraryService.checkAccess(publicationId, userId, userAge);
        setHasAccess(access);

        if (!access) {
          setError('You do not have access to this publication');
          return;
        }

        // Fetch publication
        const pub = await libraryService.getPublication(publicationId);
        setPublication(pub);

        // Fetch metadata
        const meta = await libraryService.getPublicationMetadata(publicationId);
        setMetadata(meta);

        // Fetch citations
        const citationNetwork = await libraryService.getCitationNetwork(publicationId);
        setCitations(citationNetwork);

        // Fetch user channels if needed
        if (pub.metadata.privilegeLevel === 'privileged') {
          const userChannels = await libraryService.getUserPrivilegedChannels(userId);
          setChannels(userChannels);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch publication');
      } finally {
        setLoading(false);
      }
    };

    fetchPublication();
  }, [publicationId, userId, userAge, useAdminRelays]);

  const handlePublicationSelect = async (id: string) => {
    try {
      const hasAccess = await libraryService.checkAccess(id, userId, userAge);
      if (!hasAccess) {
        setError('You do not have access to this publication');
        return;
      }

      const pub = await libraryService.getPublication(id);
      setPublication(pub);

      // Try to fetch from IPFS if available
      if (pub.metadata.ipfsCid) {
        try {
          const ipfsPub = await libraryService.getPublication(pub.metadata.ipfsCid);
          setPublication(ipfsPub);
        } catch (error) {
          console.warn('Failed to fetch from IPFS, using original publication:', error);
        }
      }
    } catch (error) {
      setError('Failed to fetch publication');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!publication) {
    return <div>Publication not found</div>;
  }

  return (
    <div className="publication-viewer">
      <div className="publication-header">
        <h2>{publication.metadata.title}</h2>
        <button onClick={onClose} className="close-button">Close</button>
      </div>

      {isAdmin && (
        <div className="admin-controls">
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={useAdminRelays}
              onChange={(e) => {
                setUseAdminRelays(e.target.checked);
                libraryService.setUseAdminRelays(e.target.checked);
              }}
            />
            Use Admin Relays
          </label>
          <div className="relay-status">
            Current relays: {libraryService.getRelayConfig().relays.length}
          </div>
        </div>
      )}

      <div className="publication-content">
        <div className="metadata">
          <p>Author: {publication.metadata.author}</p>
          <p>Type: {publication.metadata.mediaType}</p>
          <p>Age Rating: {publication.metadata.ageRating}+</p>
          <p>Privilege Level: {publication.metadata.privilegeLevel}</p>
          {publication.metadata.ipfsCid && (
            <p>
              IPFS Link:{' '}
              <a
                href={`https://ipfs.io/ipfs/${publication.metadata.ipfsCid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ipfs-link"
              >
                View on IPFS
              </a>
            </p>
          )}
        </div>

        <div className="content">
          <pre>{publication.content}</pre>
        </div>

        {citations.length > 0 && (
          <div className="citations">
            <h3>Citations</h3>
            <ul>
              {citations.map((citation, index) => (
                <li key={index} className="citation-item">
                  {citation.type}: {citation.targetHash}
                  {citation.verified && <span className="verified-badge">Verified</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {channels.length > 0 && (
          <div className="privileged-channels">
            <h3>Privileged Channels</h3>
            <ul>
              {channels.map((channel) => (
                <li key={channel.id} className="channel-item">
                  {channel.name} (Created: {new Date(channel.createdAt).toLocaleDateString()})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <style>{`
        .publication-viewer {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .publication-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e5e7eb;
        }

        .publication-header h2 {
          margin: 0;
          font-size: 1.8em;
          color: #1f2937;
        }

        .close-button {
          background-color: #f3f4f6;
          color: #374151;
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
        }

        .close-button:hover {
          background-color: #e5e7eb;
        }

        .admin-controls {
          background-color: #f3f4f6;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .admin-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .relay-status {
          color: #6b7280;
          font-size: 0.9em;
        }

        .metadata {
          background-color: #f9fafb;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .metadata p {
          margin: 5px 0;
          color: #4b5563;
        }

        .ipfs-link {
          color: #3b82f6;
          text-decoration: none;
        }

        .ipfs-link:hover {
          text-decoration: underline;
        }

        .content {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .content pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          margin: 0;
          font-family: inherit;
        }

        .citations, .privileged-channels {
          background-color: #f9fafb;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .citations h3, .privileged-channels h3 {
          margin-top: 0;
          color: #1f2937;
        }

        .citation-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0;
          padding: 8px;
          background-color: white;
          border-radius: 4px;
        }

        .verified-badge {
          background-color: #10b981;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.8em;
        }

        .channel-item {
          padding: 8px;
          background-color: white;
          border-radius: 4px;
          margin: 8px 0;
        }
      `}</style>
    </div>
  );
}; 