import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api, { ratingsAPI } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Star, MessageSquare, ThumbsUp, Calendar, Search, Filter,
  Hotel, Utensils, Bus, Car, Film, Sparkles, Package, Gift,
  Send, Reply, ChevronDown, ChevronUp, User, Clock, TrendingUp,
  MessageCircle, Award, BarChart3, Edit2, Loader2, CheckCircle,
  Flag, EyeOff, Eye, Trash2, AlertTriangle, ShieldAlert, X
} from 'lucide-react';
import { toast } from 'sonner';

const SERVICE_ICONS = {
  hotel: Hotel,
  restaurant: Utensils,
  travel: Bus,
  car_rental: Car,
  cinema: Film,
  laundry: Sparkles,
  package: Package,
  banquet: Gift,
  events: Calendar
};

const SERVICE_COLORS = {
  hotel: '#EC4899',
  restaurant: '#F59E0B',
  travel: '#3B82F6',
  car_rental: '#10B981',
  cinema: '#EF4444',
  laundry: '#06B6D4',
  package: '#6366F1',
  banquet: '#8B5CF6',
  events: '#F97316'
};

// Render star rating
const StarRating = ({ rating, size = 'md', interactive = false, onChange }) => {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
        >
          <Star
            className={`${sizeClass} transition-colors ${
              star <= (hovered || rating)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

// Customer View Component
function CustomerRatingsView() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRating, setEditingRating] = useState(null);
  const [editComment, setEditComment] = useState('');

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    try {
      const response = await ratingsAPI.getMyRatings();
      setRatings(response.data?.ratings || []);
    } catch (error) {
      console.error('Failed to fetch ratings:', error);
      // Mock data for demo
      setRatings([
        {
          id: '1',
          service_name: 'Hilton Douala',
          service_category: 'hotel',
          rating: 5,
          comment: 'Excellent stay! The room was spacious and the staff was incredibly helpful.',
          created_at: '2024-12-15',
          helpful_count: 12,
          operator_response: {
            message: 'Thank you for your wonderful review! We are delighted you enjoyed your stay.',
            responded_at: '2024-12-16',
            responder_name: 'Hotel Manager'
          }
        },
        {
          id: '2',
          service_name: 'La Belle Époque',
          service_category: 'restaurant',
          rating: 4,
          comment: 'Great food, excellent ambiance. The wait time was a bit long but worth it.',
          created_at: '2024-12-10',
          helpful_count: 5
        },
        {
          id: '3',
          service_name: 'Douala → Yaoundé Express',
          service_category: 'travel',
          rating: 5,
          comment: 'Very comfortable bus, arrived on time. Will definitely use again!',
          created_at: '2024-12-05',
          helpful_count: 8
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRating = (rating) => {
    setEditingRating(rating);
    setEditComment(rating.comment);
  };

  const handleSaveEdit = async () => {
    try {
      await ratingsAPI.updateRating(editingRating.id, { comment: editComment });
      setRatings(prev => prev.map(r => r.id === editingRating.id ? { ...r, comment: editComment } : r));
      setEditingRating(null);
      toast.success('Review updated successfully!');
    } catch (error) {
      toast.error('Failed to update review');
    }
  };

  const stats = useMemo(() => {
    if (!ratings.length) return { total: 0, helpful: 0, average: 0 };
    return {
      total: ratings.length,
      helpful: ratings.reduce((sum, r) => sum + (r.helpful_count || 0), 0),
      average: (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    };
  }, [ratings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
          <p className="mt-4 text-slate-600">Loading your reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Star className="h-6 w-6 text-amber-600 fill-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-sm text-slate-600">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <ThumbsUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats.helpful}</p>
                <p className="text-sm text-slate-600">Helpful Votes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Award className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats.average}</p>
                <p className="text-sm text-slate-600">Average Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      {ratings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="h-10 w-10 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No reviews yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              After using a service, come back here to share your experience and help others!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ratings.map((review) => {
            const IconComponent = SERVICE_ICONS[review.service_category] || Package;
            const color = SERVICE_COLORS[review.service_category] || '#64748B';
            
            return (
              <Card key={review.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Color accent bar */}
                    <div className="w-1.5" style={{ backgroundColor: color }}></div>
                    
                    <div className="flex-1 p-6">
                      <div className="flex gap-4">
                        {/* Service Icon */}
                        <div 
                          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <IconComponent className="h-7 w-7" style={{ color }} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-bold text-slate-900 text-lg">{review.service_name}</h3>
                              <div className="flex items-center gap-3 mt-1">
                                <StarRating rating={review.rating} size="sm" />
                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(review.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <Badge 
                              className="capitalize text-xs"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              {review.service_category?.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          {/* Comment */}
                          <p className="text-slate-600 mt-4 leading-relaxed">{review.comment}</p>
                          
                          {/* Operator Response */}
                          {review.operator_response && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg border-l-4 border-[#082c59]">
                              <div className="flex items-center gap-2 mb-2">
                                <Reply className="h-4 w-4 text-[#082c59]" />
                                <span className="font-medium text-[#082c59] text-sm">
                                  Response from {review.operator_response.responder_name}
                                </span>
                                <span className="text-xs text-slate-400">
                                  • {new Date(review.operator_response.responded_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-slate-600 text-sm">{review.operator_response.message}</p>
                            </div>
                          )}
                          
                          {/* Actions */}
                          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
                            <span className="flex items-center gap-1.5 text-sm text-slate-500">
                              <ThumbsUp className="h-4 w-4" />
                              {review.helpful_count || 0} found helpful
                            </span>
                            <button 
                              onClick={() => handleEditRating(review)}
                              className="flex items-center gap-1.5 text-sm text-[#082c59] hover:underline"
                            >
                              <Edit2 className="h-4 w-4" />
                              Edit Review
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingRating} onOpenChange={() => setEditingRating(null)}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Edit Your Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Your Review</label>
              <Textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                className="mt-2"
                rows={4}
                placeholder="Share your experience..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRating(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-[#082c59] hover:bg-[#0a3a75]">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Operator View Component
function OperatorRatingsView() {
  const { user, operatorServiceTypes, operatorType } = useAuth();
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterService, setFilterService] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Determine operator's assigned service types
  const assignedServices = useMemo(() => {
    if (operatorServiceTypes?.length > 0) return operatorServiceTypes;
    if (operatorType) return [operatorType];
    return [];
  }, [operatorServiceTypes, operatorType]);

  useEffect(() => {
    fetchOperatorRatings();
  }, []);

  const fetchOperatorRatings = async () => {
    try {
      // Fetch ratings for services assigned to this operator
      const response = await api.get('/ratings/operator', {
        params: { operator_id: user?.operator_id }
      });
      setRatings(response.data?.ratings || []);
    } catch (error) {
      console.error('Failed to fetch operator ratings:', error);
      // Mock data for demo
      const mockRatings = [
        {
          id: 'r1',
          service_name: 'Hilton Douala',
          service_id: 'hotel_1',
          service_category: 'hotel',
          customer_name: 'John Doe',
          customer_avatar: null,
          rating: 5,
          comment: 'Amazing hotel! Clean rooms, friendly staff, great location. Highly recommend!',
          created_at: '2024-12-20T10:30:00Z',
          helpful_count: 15,
          operator_response: null
        },
        {
          id: 'r2',
          service_name: 'Hilton Douala',
          service_id: 'hotel_1',
          service_category: 'hotel',
          customer_name: 'Marie Claire',
          customer_avatar: null,
          rating: 4,
          comment: 'Very good experience overall. The breakfast buffet could have more variety.',
          created_at: '2024-12-18T14:15:00Z',
          helpful_count: 8,
          operator_response: {
            message: 'Thank you for your feedback! We are working on expanding our breakfast menu.',
            responded_at: '2024-12-19T09:00:00Z',
            responder_name: 'Hotel Management'
          }
        },
        {
          id: 'r3',
          service_name: 'La Belle Époque',
          service_id: 'rest_1',
          service_category: 'restaurant',
          customer_name: 'Pierre Martin',
          customer_avatar: null,
          rating: 5,
          comment: 'Best restaurant in town! The chef is incredibly talented.',
          created_at: '2024-12-15T19:45:00Z',
          helpful_count: 22,
          operator_response: null
        },
        {
          id: 'r4',
          service_name: 'Hilton Douala',
          service_id: 'hotel_1',
          service_category: 'hotel',
          customer_name: 'Sophie Williams',
          customer_avatar: null,
          rating: 3,
          comment: 'The room was nice but the AC was too noisy. Front desk was helpful in resolving.',
          created_at: '2024-12-12T08:20:00Z',
          helpful_count: 5,
          operator_response: null
        }
      ];
      // Filter by assigned services
      const filtered = mockRatings.filter(r => 
        assignedServices.length === 0 || assignedServices.includes(r.service_category)
      );
      setRatings(filtered);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !replyingTo) return;
    
    setSubmittingReply(true);
    try {
      await api.post(`/ratings/${replyingTo.id}/respond`, {
        message: replyText,
        responder_name: user?.full_name || 'Management'
      });
      
      // Update local state
      setRatings(prev => prev.map(r => 
        r.id === replyingTo.id 
          ? { 
              ...r, 
              operator_response: {
                message: replyText,
                responded_at: new Date().toISOString(),
                responder_name: user?.full_name || 'Management'
              }
            }
          : r
      ));
      
      setReplyingTo(null);
      setReplyText('');
      toast.success('Response submitted successfully!');
    } catch (error) {
      toast.error('Failed to submit response');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Filter ratings
  const filteredRatings = useMemo(() => {
    return ratings.filter(r => {
      const matchesSearch = !searchTerm || 
        r.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.comment.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesService = filterService === 'all' || r.service_category === filterService;
      const matchesRating = filterRating === 'all' || r.rating === parseInt(filterRating);
      return matchesSearch && matchesService && matchesRating;
    });
  }, [ratings, searchTerm, filterService, filterRating]);

  // Stats
  const stats = useMemo(() => {
    if (!ratings.length) return { total: 0, average: 0, responded: 0, pending: 0 };
    return {
      total: ratings.length,
      average: (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1),
      responded: ratings.filter(r => r.operator_response).length,
      pending: ratings.filter(r => !r.operator_response).length
    };
  }, [ratings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
          <p className="mt-4 text-slate-600">Loading customer reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-600">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <Star className="h-5 w-5 text-amber-600 fill-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.average}</p>
                <p className="text-xs text-slate-600">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.responded}</p>
                <p className="text-xs text-slate-600">Responded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 rounded-lg">
                <MessageCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                <p className="text-xs text-slate-600">Needs Response</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Services</SelectItem>
                {assignedServices.map(service => (
                  <SelectItem key={service} value={service} className="capitalize">
                    {service.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-36 bg-white">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {filteredRatings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Star className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No reviews found</h3>
            <p className="text-slate-500">
              {searchTerm || filterService !== 'all' || filterRating !== 'all'
                ? 'Try adjusting your filters'
                : 'Customer reviews for your services will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRatings.map((review) => {
            const IconComponent = SERVICE_ICONS[review.service_category] || Package;
            const color = SERVICE_COLORS[review.service_category] || '#64748B';
            const needsResponse = !review.operator_response;
            
            return (
              <Card 
                key={review.id} 
                className={`overflow-hidden transition-all duration-300 ${needsResponse ? 'ring-2 ring-amber-200' : ''}`}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Status bar */}
                    <div 
                      className="w-1.5"
                      style={{ backgroundColor: needsResponse ? '#F59E0B' : '#10B981' }}
                    ></div>
                    
                    <div className="flex-1 p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{review.customer_name}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(review.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className="capitalize text-xs"
                            style={{ backgroundColor: `${color}20`, color }}
                          >
                            <IconComponent className="h-3 w-3 mr-1" />
                            {review.service_name}
                          </Badge>
                          {needsResponse && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                              Needs Response
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Rating & Comment */}
                      <div className="mb-4">
                        <StarRating rating={review.rating} />
                        <p className="text-slate-700 mt-3 leading-relaxed">{review.comment}</p>
                      </div>

                      {/* Existing Response */}
                      {review.operator_response && (
                        <div className="mt-4 p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium text-emerald-700 text-sm">
                              Your Response
                            </span>
                            <span className="text-xs text-slate-500">
                              • {new Date(review.operator_response.responded_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-slate-700 text-sm">{review.operator_response.message}</p>
                        </div>
                      )}

                      {/* Reply Section */}
                      {replyingTo?.id === review.id ? (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write your response to this review..."
                            className="mb-3"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => { setReplyingTo(null); setReplyText(''); }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="sm"
                              onClick={handleSubmitReply}
                              disabled={!replyText.trim() || submittingReply}
                              className="bg-[#082c59] hover:bg-[#0a3a75]"
                            >
                              {submittingReply ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              Submit Response
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-sm text-slate-500">
                            <ThumbsUp className="h-4 w-4" />
                            {review.helpful_count || 0} helpful votes
                          </span>
                          {!review.operator_response && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReplyingTo(review)}
                              className="gap-2"
                            >
                              <Reply className="h-4 w-4" />
                              Respond
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Admin View Component - Shows all ratings across the platform with moderation tools
function AdminRatingsView() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterService, setFilterService] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null);
  const [showModerateDialog, setShowModerateDialog] = useState(false);
  const [moderationAction, setModerationAction] = useState('');
  const [moderationReason, setModerationReason] = useState('');
  const [submittingModeration, setSubmittingModeration] = useState(false);
  
  // Bulk selection state
  const [selectedRatings, setSelectedRatings] = useState(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);

  useEffect(() => {
    fetchAllRatings();
  }, [showFlaggedOnly]);

  const fetchAllRatings = async () => {
    setLoading(true);
    try {
      // Fetch all ratings across the platform
      const response = await api.get('/ratings/all', {
        params: { flagged_only: showFlaggedOnly }
      });
      setRatings(response.data?.ratings || []);
    } catch (error) {
      console.error('Failed to fetch all ratings:', error);
      // Mock data for demo
      setRatings([
        {
          id: 'ar1',
          service_name: 'Hilton Douala',
          service_id: 'hotel_1',
          service_category: 'hotel',
          customer_name: 'John Doe',
          operator_name: 'Hilton Hotels Group',
          rating: 5,
          comment: 'Amazing hotel! Clean rooms, friendly staff, great location.',
          created_at: '2024-12-20T10:30:00Z',
          helpful_count: 15,
          is_flagged: false,
          is_hidden: false,
          operator_response: {
            message: 'Thank you for your wonderful review!',
            responded_at: '2024-12-21T09:00:00Z',
            responder_name: 'Hotel Manager'
          }
        },
        {
          id: 'ar2',
          service_name: 'La Belle Époque',
          service_id: 'rest_1',
          service_category: 'restaurant',
          customer_name: 'Marie Claire',
          operator_name: 'Restaurant Group Douala',
          rating: 4,
          comment: 'Great food and ambiance. Service was a bit slow during peak hours.',
          created_at: '2024-12-19T14:15:00Z',
          helpful_count: 8,
          is_flagged: false,
          is_hidden: false,
          operator_response: null
        },
        {
          id: 'ar3',
          service_name: 'Douala → Yaoundé Express',
          service_id: 'travel_1',
          service_category: 'travel',
          customer_name: 'Pierre Martin',
          operator_name: 'Express Travel Co',
          rating: 5,
          comment: 'Very comfortable bus, arrived on time. Will definitely use again!',
          created_at: '2024-12-18T08:20:00Z',
          helpful_count: 22,
          is_flagged: true,
          is_hidden: false,
          operator_response: null
        },
        {
          id: 'ar4',
          service_name: 'Premium Car Rental',
          service_id: 'car_1',
          service_category: 'car_rental',
          customer_name: 'Sophie Williams',
          operator_name: 'AutoRent Cameroon',
          rating: 3,
          comment: 'Car was okay but could have been cleaner. Good price though.',
          created_at: '2024-12-15T11:45:00Z',
          helpful_count: 5,
          is_flagged: false,
          is_hidden: false,
          operator_response: {
            message: 'We apologize for the inconvenience. We have addressed this with our cleaning team.',
            responded_at: '2024-12-16T10:00:00Z',
            responder_name: 'Operations Manager'
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = (rating, action) => {
    setSelectedRating(rating);
    setModerationAction(action);
    setModerationReason('');
    setShowModerateDialog(true);
  };

  const submitModeration = async () => {
    if (!selectedRating || !moderationAction) return;
    
    setSubmittingModeration(true);
    try {
      await api.post(`/ratings/${selectedRating.id}/moderate`, {
        action: moderationAction,
        reason: moderationReason
      });
      
      // Update local state
      if (moderationAction === 'delete') {
        setRatings(prev => prev.filter(r => r.id !== selectedRating.id));
        toast.success('Rating deleted successfully');
      } else {
        setRatings(prev => prev.map(r => {
          if (r.id !== selectedRating.id) return r;
          return {
            ...r,
            is_flagged: moderationAction === 'flag' ? true : moderationAction === 'unflag' ? false : r.is_flagged,
            is_hidden: moderationAction === 'hide' ? true : moderationAction === 'unhide' ? false : r.is_hidden,
            moderation_notes: moderationReason || r.moderation_notes
          };
        }));
        toast.success(`Rating ${moderationAction}ged successfully`);
      }
      
      setShowModerateDialog(false);
      setSelectedRating(null);
    } catch (error) {
      console.error('Moderation failed:', error);
      toast.error(error.response?.data?.detail || 'Moderation failed');
    } finally {
      setSubmittingModeration(false);
    }
  };

  // Bulk selection handlers
  const handleSelectRating = (ratingId, checked) => {
    setSelectedRatings(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(ratingId);
      } else {
        newSet.delete(ratingId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRatings(new Set(filteredRatings.map(r => r.id)));
    } else {
      setSelectedRatings(new Set());
    }
  };

  const openBulkDialog = (action) => {
    if (selectedRatings.size === 0) {
      toast.error('Please select at least one rating');
      return;
    }
    setBulkAction(action);
    setBulkReason('');
    setShowBulkDialog(true);
  };

  const submitBulkAction = async () => {
    if (selectedRatings.size === 0) return;
    
    setSubmittingBulk(true);
    try {
      const ratingIds = Array.from(selectedRatings);
      
      // Call API for bulk moderation
      await api.post('/ratings/bulk-moderate', {
        rating_ids: ratingIds,
        action: bulkAction,
        reason: bulkReason
      });
      
      // Update local state based on action
      if (bulkAction === 'delete') {
        setRatings(prev => prev.filter(r => !selectedRatings.has(r.id)));
        toast.success(`${selectedRatings.size} rating(s) deleted successfully`);
      } else {
        setRatings(prev => prev.map(r => {
          if (!selectedRatings.has(r.id)) return r;
          return {
            ...r,
            is_flagged: bulkAction === 'flag' ? true : bulkAction === 'unflag' ? false : r.is_flagged,
            is_hidden: bulkAction === 'hide' ? true : bulkAction === 'unhide' ? false : r.is_hidden,
            moderation_notes: bulkReason || r.moderation_notes
          };
        }));
        toast.success(`${selectedRatings.size} rating(s) ${bulkAction}ged successfully`);
      }
      
      setSelectedRatings(new Set());
      setShowBulkDialog(false);
    } catch (error) {
      console.error('Bulk moderation failed:', error);
      toast.error(error.response?.data?.detail || 'Bulk moderation failed');
    } finally {
      setSubmittingBulk(false);
    }
  };

  // Filter ratings
  const filteredRatings = useMemo(() => {
    return ratings.filter(r => {
      const matchesSearch = !searchTerm || 
        r.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.operator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.comment.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesService = filterService === 'all' || r.service_category === filterService;
      const matchesRating = filterRating === 'all' || r.rating === parseInt(filterRating);
      return matchesSearch && matchesService && matchesRating;
    });
  }, [ratings, searchTerm, filterService, filterRating]);

  // Stats
  const stats = useMemo(() => {
    if (!ratings.length) return { total: 0, average: 0, responded: 0, pending: 0, flagged: 0, byRating: {} };
    const byRating = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratings.forEach(r => byRating[r.rating] = (byRating[r.rating] || 0) + 1);
    return {
      total: ratings.length,
      average: (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1),
      responded: ratings.filter(r => r.operator_response).length,
      pending: ratings.filter(r => !r.operator_response).length,
      flagged: ratings.filter(r => r.is_flagged).length,
      byRating
    };
  }, [ratings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
          <p className="mt-4 text-slate-600">Loading all ratings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-600">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <Star className="h-5 w-5 text-amber-600 fill-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.average}</p>
                <p className="text-xs text-slate-600">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.responded}</p>
                <p className="text-xs text-slate-600">Responded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 rounded-lg">
                <MessageCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                <p className="text-xs text-slate-600">Needs Response</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-0 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 rounded-lg">
                <Flag className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.flagged}</p>
                <p className="text-xs text-slate-600">{showFlaggedOnly ? 'Showing Flagged' : 'Flagged'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-0">
          <CardContent className="p-4">
            <div className="text-xs space-y-1">
              {[5,4,3,2,1].map(star => (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-3">{star}★</span>
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${stats.total ? (stats.byRating[star] / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-slate-500">{stats.byRating[star] || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by service, customer, operator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="hotel">Hotels</SelectItem>
                <SelectItem value="restaurant">Restaurants</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="car_rental">Car Rental</SelectItem>
                <SelectItem value="cinema">Cinema</SelectItem>
                <SelectItem value="laundry">Laundry</SelectItem>
                <SelectItem value="events">Events</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-36 bg-white">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Ratings List */}
      {filteredRatings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Star className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No reviews found</h3>
            <p className="text-slate-500">
              {searchTerm || filterService !== 'all' || filterRating !== 'all'
                ? 'Try adjusting your filters'
                : 'No reviews have been submitted yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRatings.map((review) => {
            const IconComponent = SERVICE_ICONS[review.service_category] || Package;
            const color = SERVICE_COLORS[review.service_category] || '#64748B';
            const needsResponse = !review.operator_response;
            
            return (
              <Card key={review.id} className={`overflow-hidden transition-all duration-300 hover:shadow-md ${review.is_flagged ? 'ring-2 ring-orange-300' : ''} ${review.is_hidden ? 'opacity-60' : ''}`}>
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="w-1.5" style={{ backgroundColor: review.is_flagged ? '#F97316' : needsResponse ? '#F59E0B' : '#10B981' }}></div>
                    
                    <div className="flex-1 p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{review.customer_name}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(review.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <Badge className="capitalize text-xs" style={{ backgroundColor: `${color}20`, color }}>
                            <IconComponent className="h-3 w-3 mr-1" />
                            {review.service_name}
                          </Badge>
                          {review.operator_name && (
                            <Badge variant="outline" className="text-xs">
                              {review.operator_name}
                            </Badge>
                          )}
                          {review.is_flagged && (
                            <Badge className="bg-orange-100 text-orange-700 text-xs">
                              <Flag className="h-3 w-3 mr-1" /> Flagged
                            </Badge>
                          )}
                          {review.is_hidden && (
                            <Badge className="bg-slate-100 text-slate-700 text-xs">
                              <EyeOff className="h-3 w-3 mr-1" /> Hidden
                            </Badge>
                          )}
                          {needsResponse && !review.is_flagged && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">Needs Response</Badge>
                          )}
                        </div>
                      </div>

                      {/* Rating & Comment */}
                      <div className="mb-4">
                        <StarRating rating={review.rating} />
                        <p className="text-slate-700 mt-3 leading-relaxed">{review.comment}</p>
                      </div>

                      {/* Operator Response */}
                      {review.operator_response && (
                        <div className="mt-4 p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium text-emerald-700 text-sm">
                              Response from {review.operator_response.responder_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              • {new Date(review.operator_response.responded_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-slate-700 text-sm">{review.operator_response.message}</p>
                        </div>
                      )}

                      {/* Footer with Moderation Tools */}
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm text-slate-500">
                          <ThumbsUp className="h-4 w-4" />
                          {review.helpful_count || 0} helpful votes
                        </span>
                        <div className="flex items-center gap-2">
                          {review.is_flagged ? (
                            <Button variant="outline" size="sm" onClick={() => handleModerate(review, 'unflag')} className="text-green-600 hover:bg-green-50">
                              <CheckCircle className="h-4 w-4 mr-1" /> Unflag
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleModerate(review, 'flag')} className="text-orange-600 hover:bg-orange-50">
                              <Flag className="h-4 w-4 mr-1" /> Flag
                            </Button>
                          )}
                          {review.is_hidden ? (
                            <Button variant="outline" size="sm" onClick={() => handleModerate(review, 'unhide')} className="text-blue-600 hover:bg-blue-50">
                              <Eye className="h-4 w-4 mr-1" /> Show
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleModerate(review, 'hide')} className="text-slate-600 hover:bg-slate-50">
                              <EyeOff className="h-4 w-4 mr-1" /> Hide
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleModerate(review, 'delete')} className="text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Moderation Dialog */}
      <Dialog open={showModerateDialog} onOpenChange={setShowModerateDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              {moderationAction === 'delete' ? 'Delete Rating' : 
               moderationAction === 'flag' ? 'Flag Rating' :
               moderationAction === 'unflag' ? 'Remove Flag' :
               moderationAction === 'hide' ? 'Hide Rating' : 'Show Rating'}
            </DialogTitle>
            <DialogDescription>
              {moderationAction === 'delete' 
                ? 'This action cannot be undone. The rating will be permanently removed.'
                : moderationAction === 'flag'
                ? 'Flag this rating for review. It will remain visible but marked for attention.'
                : moderationAction === 'hide'
                ? 'Hide this rating from public view. It can be restored later.'
                : 'This will update the rating status.'}
            </DialogDescription>
          </DialogHeader>
          {selectedRating && (
            <div className="py-4">
              <div className="p-3 bg-slate-50 rounded-lg mb-4">
                <p className="font-medium text-sm">{selectedRating.service_name}</p>
                <p className="text-sm text-slate-600">by {selectedRating.customer_name}</p>
                <StarRating rating={selectedRating.rating} size="sm" />
              </div>
              {(moderationAction === 'flag' || moderationAction === 'hide' || moderationAction === 'delete') && (
                <div>
                  <label className="text-sm font-medium">Reason (optional)</label>
                  <Textarea
                    value={moderationReason}
                    onChange={(e) => setModerationReason(e.target.value)}
                    placeholder="Add a note about this moderation action..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModerateDialog(false)} disabled={submittingModeration}>
              Cancel
            </Button>
            <Button 
              onClick={submitModeration} 
              disabled={submittingModeration}
              className={moderationAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#082c59] hover:bg-[#0a3a75]'}
            >
              {submittingModeration && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {moderationAction === 'delete' ? 'Delete' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main Ratings Component
export default function Ratings() {
  const { user, isOperatorUser } = useAuth();
  
  const isOperator = user?.role === 'operator' || isOperatorUser;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="ratings-title">
            {isAdmin ? 'All Ratings' : isOperator ? 'Customer Reviews' : 'My Ratings & Reviews'}
          </h1>
          <p className="text-slate-600">
            {isAdmin
              ? 'View and monitor all ratings across the platform'
              : isOperator 
              ? 'Manage and respond to customer feedback for your services'
              : 'Reviews you\'ve left for services you\'ve used'}
          </p>
        </div>
      </div>

      {/* Render appropriate view based on user role */}
      {isAdmin ? <AdminRatingsView /> : isOperator ? <OperatorRatingsView /> : <CustomerRatingsView />}
    </div>
  );
}
