import React, { useState } from 'react';

const UserAgreement = ({ onAccept, isInviter = false }) => {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    setAccepted(true);
    onAccept();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">PLATFORM USER AGREEMENT AND DISCLAIMER</h2>
      
      <div className="space-y-4 text-gray-700">
        <p className="font-semibold">By joining this platform, you acknowledge and agree to the following terms:</p>
        
        <section>
          <h3 className="text-xl font-semibold mb-3">Non-Investment Acknowledgment</h3>
          <p className="mb-2">You hereby acknowledge that:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>You have neither been asked to provide, nor have you offered, received, or given anything of value in connection with your use of this platform.</li>
            <li>This platform explicitly does not offer or provide any of the elements that would constitute an "investment contract" under applicable securities laws, specifically:
              <ul className="list-disc pl-5 mt-2">
                <li>No opportunity for investment of money</li>
                <li>No common enterprise structure</li>
                <li>No expectation of profits</li>
                <li>No profits derived from the efforts of others</li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-3">User Verification and Accountability</h3>
          <p className="mb-2">You certify that:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>You personally know the individual who invited you to this platform or the individual whom you are inviting.</li>
            <li>You understand that failure to identify such person(s) when legally required to do so by authorized authorities shall constitute sufficient and reasonable grounds to determine that you are the owner of the account in question.</li>
          </ul>
        </section>

        <p className="mt-4">
          By proceeding to use this platform, you confirm that you have read, understood, and agree to be bound by all terms of this disclaimer.
        </p>

        <div className="mt-6">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="text-gray-700">I accept the terms and conditions</span>
          </label>
        </div>

        <button
          onClick={handleAccept}
          disabled={!accepted}
          className={`mt-4 w-full py-2 px-4 rounded-md text-white font-semibold ${
            accepted
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isInviter ? 'Proceed with Invitation' : 'Accept and Join'}
        </button>
      </div>
    </div>
  );
};

export default UserAgreement; 