import React, { useState, useEffect } from 'react';
import { LibraryService, Publication, RelayConfig } from '../../services/library/LibraryService';
import { ContentMetadata } from '../../services/library/ContentFingerprintService';
import { PrivilegedChannel } from '../../services/library/AccessControlService';

interface LibraryDashboardProps {
  userId: string;
  userAge?: number;
  relays: string[];
  privateKey: string;
}

export const LibraryDashboard: React.FC<LibraryDashboardProps> = ({ userId, userAge, relays, privateKey }) => {
  const [libraryService] = useState(() => {
    const relayConfigs: RelayConfig[] = relays.map(url => ({
      url,
      isAdminRelay: false
    }));
    return new LibraryService(relayConfigs, privateKey);
  });
  const [publications, setPublications] = useState<Publication[]>([]);
  const [privilegedChannels, setPrivilegedChannels] = useState<PrivilegedChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPublication, setSelectedPublication] = useState<string | null>(null);
  const [newPublication, setNewPublication] = useState<Partial<Publication>>({
    content: '',
    metadata: {
      title: '',
      author: '',
      mediaType: 'article',
      timestamp: Date.now(),
      ageRating: 0,
      privilegeLevel: 'public'
    }
  });

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userChannels = await libraryService.getUserPrivilegedChannels(userId);
      setPrivilegedChannels(userChannels);
      
      // For now, we'll just show an empty list of publications
      // TODO: Implement proper publication listing with user filtering
      setPublications([]);
    } catch (err) {
      setError('Failed to load user data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPublication = async () => {
    try {
      setLoading(true);
      const publication: Publication = {
        content: newPublication.content || '',
        metadata: {
          title: newPublication.metadata?.title || '',
          author: newPublication.metadata?.author || '',
          mediaType: newPublication.metadata?.mediaType || 'article',
          timestamp: Date.now(),
          ageRating: newPublication.metadata?.ageRating || 0,
          privilegeLevel: newPublication.metadata?.privilegeLevel || 'public'
        }
      };
      await libraryService.addPublication(publication);
      await loadUserData();
      setNewPublication({
        content: '',
        metadata: {
          title: '',
          author: '',
          mediaType: 'article',
          timestamp: Date.now(),
          ageRating: 0,
          privilegeLevel: 'public'
        }
      });
    } catch (err) {
      setError('Failed to add publication');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrivilegedChannel = async (name: string, members: string[]) => {
    try {
      setLoading(true);
      const encryptionKey = Math.random().toString(36).substring(7);
      await libraryService.createPrivilegedChannel(name, members, encryptionKey);
      await loadUserData();
    } catch (err) {
      setError('Failed to create privileged channel');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAge = async (proof: string, verifiedAge: number) => {
    try {
      setLoading(true);
      await libraryService.verifyAge(userId, verifiedAge);
      await loadUserData();
    } catch (err) {
      setError('Failed to verify age');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Library Dashboard</h1>
      <div>
        <h2>Publications</h2>
        <ul>
          {publications.map(pub => (
            <li key={pub.metadata.timestamp}>
              <h3>{pub.metadata.title}</h3>
              <p>Author: {pub.metadata.author}</p>
              <p>Type: {pub.metadata.mediaType}</p>
              <p>Age Rating: {pub.metadata.ageRating}</p>
              <p>Access Level: {pub.metadata.privilegeLevel}</p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Privileged Channels</h2>
        <ul>
          {privilegedChannels.map(channel => (
            <li key={channel.id}>
              <h3>{channel.name}</h3>
              <p>Members: {channel.members.join(', ')}</p>
              <p>Created: {new Date(channel.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}; 