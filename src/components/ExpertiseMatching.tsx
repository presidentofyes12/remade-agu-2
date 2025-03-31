import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { ExpertiseService } from '../services/expertiseService';
import { KnowledgeDomainService } from '../services/knowledgeDomain';
import { ProposalService } from '../services/proposalService';
import { ExpertiseProfile, BlindReview, ExpertiseEvents } from '../types/expertise';

interface ExpertiseMatchingProps {
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

interface ReviewFormData {
  proposalId: bigint;
  content: string;
  rating: number;
  domainId: bigint;
}

export const ExpertiseMatching: React.FC<ExpertiseMatchingProps> = ({
  provider,
  signer
}) => {
  const [profile, setProfile] = useState<ExpertiseProfile | null>(null);
  const [pseudonym, setPseudonym] = useState('');
  const [reviews, setReviews] = useState<BlindReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    proposalId: BigInt(0),
    content: '',
    rating: 0,
    domainId: BigInt(0)
  });

  const expertiseService = ExpertiseService.getInstance(
    process.env.REACT_APP_LOGIC_ADDRESS || '',
    process.env.REACT_APP_STATE_ADDRESS || '',
    process.env.REACT_APP_VIEW_ADDRESS || '',
    {
      minExpertiseScore: 0.5,
      maxReviewsPerProposal: 5,
      reviewCooldown: BigInt(86400), // 24 hours
      rateLimit: {
        reviewsPerDay: 10,
        proposalsPerDay: 5
      },
      anomalyThresholds: {
        ratingDeviation: 2.0,
        reviewFrequency: 0.1,
        patternSimilarity: 0.8
      }
    },
    provider,
    signer
  );

  const knowledgeDomainService = KnowledgeDomainService.getInstance(
    process.env.REACT_APP_LOGIC_ADDRESS || '',
    {
      minRelevanceScore: 0,
      maxRelevanceScore: 1,
      minInnovationScore: 0,
      maxInnovationScore: 1,
      defaultContributionThreshold: BigInt(1000),
      analyticsUpdateInterval: 300000
    },
    provider,
    signer
  );

  const proposalService = ProposalService.getInstance(
    process.env.REACT_APP_TOKEN_ADDRESS || '',
    process.env.REACT_APP_LOGIC_ADDRESS || '',
    process.env.REACT_APP_STATE_ADDRESS || '',
    process.env.REACT_APP_VIEW_ADDRESS || '',
    provider,
    signer
  );

  useEffect(() => {
    setupEventListeners();
    return () => {
      // Cleanup event listeners
      expertiseService.off('ProfileCreated', handleProfileCreated);
      expertiseService.off('ProfileUpdated', handleProfileUpdated);
      expertiseService.off('ReviewSubmitted', handleReviewSubmitted);
      expertiseService.off('ExpertiseVerified', handleExpertiseVerified);
      expertiseService.off('AnomalyDetected', handleAnomalyDetected);
    };
  }, []);

  const setupEventListeners = () => {
    expertiseService.on('ProfileCreated', handleProfileCreated);
    expertiseService.on('ProfileUpdated', handleProfileUpdated);
    expertiseService.on('ReviewSubmitted', handleReviewSubmitted);
    expertiseService.on('ExpertiseVerified', handleExpertiseVerified);
    expertiseService.on('AnomalyDetected', handleAnomalyDetected);
  };

  const handleProfileCreated = (event: ExpertiseEvents['ProfileCreated']) => {
    if (event.pseudonym === pseudonym) {
      loadProfile();
    }
  };

  const handleProfileUpdated = (event: ExpertiseEvents['ProfileUpdated']) => {
    if (event.pseudonym === pseudonym) {
      loadProfile();
    }
  };

  const handleReviewSubmitted = (event: ExpertiseEvents['ReviewSubmitted']) => {
    if (event.reviewerPseudonym === pseudonym) {
      loadReviews();
    }
  };

  const handleExpertiseVerified = (event: ExpertiseEvents['ExpertiseVerified']) => {
    if (event.pseudonym === pseudonym) {
      loadProfile();
    }
  };

  const handleAnomalyDetected = (event: ExpertiseEvents['AnomalyDetected']) => {
    if (event.pseudonym === pseudonym) {
      setError(`Anomaly detected: ${event.anomalyType}`);
    }
  };

  const loadProfile = async () => {
    try {
      if (!pseudonym) return;
      const profile = await expertiseService.getProfile(pseudonym);
      setProfile(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    }
  };

  const loadReviews = async () => {
    try {
      if (!pseudonym) return;
      const reviews = await expertiseService.getProposalReviews(reviewForm.proposalId);
      setReviews(reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    }
  };

  const handleCreateProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      await expertiseService.createProfile(pseudonym);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExpertise = async (domainId: bigint, score: number) => {
    try {
      setLoading(true);
      setError(null);
      await expertiseService.updateExpertise(pseudonym, domainId, score);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update expertise');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    try {
      setLoading(true);
      setError(null);
      await expertiseService.submitReview(
        reviewForm.proposalId,
        pseudonym,
        reviewForm.content,
        reviewForm.rating,
        reviewForm.domainId
      );
      await loadReviews();
      setReviewForm({
        proposalId: BigInt(0),
        content: '',
        rating: 0,
        domainId: BigInt(0)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading expertise matching system...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="expertise-matching">
      <h2>Expertise Matching System</h2>

      <div className="profile-section">
        <h3>Expert Profile</h3>
        {!profile ? (
          <div className="create-profile">
            <input
              type="text"
              value={pseudonym}
              onChange={e => setPseudonym(e.target.value)}
              placeholder="Enter your pseudonym"
            />
            <button onClick={handleCreateProfile}>Create Profile</button>
          </div>
        ) : (
          <div className="profile-info">
            <p>Pseudonym: {profile.pseudonym}</p>
            <p>Last Update: {new Date(Number(profile.lastUpdate)).toLocaleString()}</p>
            <div className="domain-expertise">
              <h4>Domain Expertise</h4>
              {Array.from(profile.domainExpertise.entries() as Iterable<[bigint, { value: number }]>).map(([domainId, score]) => (
                <div key={domainId.toString()} className="expertise-item">
                  <span>Domain {domainId.toString()}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Number(score.value)}
                    onChange={e => handleUpdateExpertise(domainId, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="review-section">
        <h3>Submit Review</h3>
        <div className="review-form">
          <input
            type="number"
            value={reviewForm.proposalId.toString()}
            onChange={e => setReviewForm({ ...reviewForm, proposalId: BigInt(e.target.value) })}
            placeholder="Proposal ID"
          />
          <input
            type="number"
            value={reviewForm.domainId.toString()}
            onChange={e => setReviewForm({ ...reviewForm, domainId: BigInt(e.target.value) })}
            placeholder="Domain ID"
          />
          <textarea
            value={reviewForm.content}
            onChange={e => setReviewForm({ ...reviewForm, content: e.target.value })}
            placeholder="Review content"
          />
          <input
            type="number"
            min="0"
            max="100"
            value={reviewForm.rating}
            onChange={e => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
            placeholder="Rating (0-100)"
          />
          <button onClick={handleSubmitReview}>Submit Review</button>
        </div>
      </div>

      <div className="reviews-section">
        <h3>Proposal Reviews</h3>
        <div className="reviews-list">
          {reviews.map((review, index) => (
            <div key={index} className="review-item">
              <p>Reviewer: {review.reviewerPseudonym}</p>
              <p>Content: {review.content}</p>
              <p>Rating: {Number(review.rating.value)}</p>
              <p>Timestamp: {new Date(Number(review.timestamp)).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 