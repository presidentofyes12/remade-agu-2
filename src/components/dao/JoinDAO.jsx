import React, { useState, useEffect } from 'react';
import UserAgreement from './UserAgreement';

const JoinDAO = ({ daoAddress, userAddress, onJoin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  useEffect(() => {
    const inviteKey = `invite_${daoAddress}_${userAddress}`;
    const storedInvite = localStorage.getItem(inviteKey);

    if (storedInvite) {
      const invite = JSON.parse(storedInvite);
      if (invite.status === 'pending') {
        setAgreementAccepted(true); // If already accepted agreement before
      }
    }
  }, [daoAddress, userAddress]);

  const handleJoin = async () => {
    try {
      setLoading(true);
      setError('');

      const inviteKey = `invite_${daoAddress}_${userAddress}`;
      const storedInvite = localStorage.getItem(inviteKey);

      if (!storedInvite) {
        throw new Error('You must be invited to join this DAO');
      }

      const invite = JSON.parse(storedInvite);
      if (invite.status !== 'pending') {
        throw new Error('This invitation has already been used');
      }

      // Update invite status
      invite.status = 'accepted';
      invite.acceptedAt = Date.now();
      localStorage.setItem(inviteKey, JSON.stringify(invite));

      // Proceed with joining
      await onJoin(daoAddress, userAddress);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAgreementAccept = () => {
    setAgreementAccepted(true);
  };

  if (!agreementAccepted) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <UserAgreement onAccept={handleAgreementAccept} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Join DAO</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <p className="mb-4">
          You have been invited to join this DAO. Click the button below to accept.
        </p>

        <button
          onClick={handleJoin}
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md text-white font-semibold ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Joining...' : 'Join DAO'}
        </button>
      </div>
    </div>
  );
};

export default JoinDAO; 