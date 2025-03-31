import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { PrivilegedChannel } from '../../services/library/AccessControlService';
import { LibraryService, RelayConfig } from '../../services/library/LibraryService';

interface PrivilegedChannelManagerProps {
  userId: string;
  relays: RelayConfig[];
  privateKey: string;
  isAdmin?: boolean;
}

export const PrivilegedChannelManager: React.FC<PrivilegedChannelManagerProps> = ({
  userId,
  relays,
  privateKey,
  isAdmin = false
}) => {
  const [channels, setChannels] = useState<PrivilegedChannel[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [newMemberAddress, setNewMemberAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const libraryService = new LibraryService(relays, privateKey);

  useEffect(() => {
    loadChannels();
  }, [userId]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const userChannels = await libraryService.getUserPrivilegedChannels(userId);
      setChannels(userChannels);
    } catch (err) {
      setError('Failed to load channels');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!newChannelName.trim()) {
        setError('Channel name is required');
        return;
      }

      if (!newMemberAddress.trim()) {
        setError('Member address is required');
        return;
      }

      // Generate a random encryption key
      const encryptionKey = ethers.hexlify(ethers.randomBytes(32));

      const channel = await libraryService.createPrivilegedChannel(
        newChannelName,
        [userId, newMemberAddress],
        encryptionKey
      );

      setChannels(prev => [...prev, channel]);
      setNewChannelName('');
      setNewMemberAddress('');
    } catch (err) {
      setError('Failed to create channel');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading channels...</div>;
  }

  return (
    <div className="privileged-channel-manager">
      <h2>Privileged Channels</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isAdmin && (
        <div className="create-channel-form">
          <h3>Create New Channel</h3>
          <div className="form-group">
            <label htmlFor="channelName">Channel Name:</label>
            <input
              id="channelName"
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Enter channel name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="memberAddress">Member Address:</label>
            <input
              id="memberAddress"
              type="text"
              value={newMemberAddress}
              onChange={(e) => setNewMemberAddress(e.target.value)}
              placeholder="Enter member address"
            />
          </div>
          <button
            onClick={handleCreateChannel}
            disabled={loading}
            className="create-button"
          >
            {loading ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      )}

      <div className="channels-list">
        <h3>Your Channels</h3>
        {channels.length === 0 ? (
          <p>No channels found</p>
        ) : (
          <ul>
            {channels.map((channel) => (
              <li key={channel.id} className="channel-item">
                <div className="channel-info">
                  <h4>{channel.name}</h4>
                  <p>Created: {new Date(channel.createdAt).toLocaleDateString()}</p>
                  <p>Members: {channel.members.length}</p>
                </div>
                <div className="channel-actions">
                  <button
                    onClick={() => navigator.clipboard.writeText(channel.id)}
                    className="copy-button"
                  >
                    Copy Channel ID
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .privileged-channel-manager {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .error-message {
          color: #dc2626;
          background-color: #fee2e2;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .create-channel-form {
          background-color: #f3f4f6;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }

        .create-button {
          background-color: #3b82f6;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .create-button:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }

        .channels-list {
          margin-top: 30px;
        }

        .channel-item {
          background-color: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .channel-info h4 {
          margin: 0 0 5px 0;
          font-size: 1.1em;
        }

        .channel-info p {
          margin: 5px 0;
          color: #6b7280;
        }

        .copy-button {
          background-color: #f3f4f6;
          color: #374151;
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
        }

        .copy-button:hover {
          background-color: #e5e7eb;
        }
      `}</style>
    </div>
  );
}; 