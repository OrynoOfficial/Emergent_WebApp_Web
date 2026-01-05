import { useEffect, useState } from 'react';
import { ratingsAPI } from '../api/client';
import { Star, MessageSquare, ThumbsUp, Calendar, Package } from 'lucide-react';

export default function Ratings() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    try {
      const response = await ratingsAPI.getMyRatings();
      setRatings(response.data?.ratings || []);
    } catch (error) {
      console.error('Failed to fetch ratings:', error);
      // Mock data
      setRatings([
        {
          id: '1',
          service_name: 'Grand Palace Hotel',
          service_category: 'hotel',
          rating: 5,
          comment: 'Excellent stay! The room was spacious and the staff was incredibly helpful.',
          created_at: '2024-06-15',
          helpful_count: 12
        },
        {
          id: '2',
          service_name: 'Tokyo Garden Restaurant',
          service_category: 'restaurant',
          rating: 4,
          comment: 'Great sushi, but the wait time was a bit long.',
          created_at: '2024-06-10',
          helpful_count: 5
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      hotel: '🏨',
      restaurant: '🍽️',
      travel: '🚌',
      car_rental: '🚗',
      event: '🎫',
    };
    return icons[category] || '📦';
  };

  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= rating
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Ratings & Reviews</h1>
        <p className="text-slate-600">Reviews you've left for services you've used</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{ratings.length}</p>
              <p className="text-sm text-slate-500">Total Reviews</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ThumbsUp className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {ratings.reduce((sum, r) => sum + (r.helpful_count || 0), 0)}
              </p>
              <p className="text-sm text-slate-500">Helpful Votes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Star className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {ratings.length > 0
                  ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
                  : '0'}
              </p>
              <p className="text-sm text-slate-500">Average Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : ratings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center mx-auto mb-6 animate-float">
            <MessageSquare className="h-12 w-12 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No reviews yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-6">After using a service, come back here to share your experience and help others!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ratings.map((review, index) => (
            <div 
              key={review.id} 
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  {getCategoryIcon(review.service_category)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{review.service_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {renderStars(review.rating)}
                        <span className="text-sm text-slate-500">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 capitalize">
                      {review.service_category?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-3">{review.comment}</p>
                  <div className="flex items-center gap-4 mt-4">
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <ThumbsUp className="h-4 w-4" />
                      {review.helpful_count || 0} found this helpful
                    </span>
                    <button className="text-sm text-blue-600 hover:underline">
                      Edit Review
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
